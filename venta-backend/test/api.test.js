/**
 * Tests hors ligne de l'API : secret de service, sessions, identifiants du client ignorés, limites, concurrence et erreurs
 */
import { base, appeler, visiteur, fermer, modele, appelsOpenAI, REPONSE, SECRET } from './simulation.js';
import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import { spawnSync } from 'child_process';
import bcrypt from 'bcryptjs';
import { Session } from '../src/models/Session.js';
import { MAX_MESSAGES } from '../src/services/utilisateurs.js';
import { purger } from '../src/services/conservation.js';
import { ipClient } from '../src/http.js';
import { VOIX_ACCUEIL } from '../src/services/tts.js';
import { config } from '../src/config.js';
import { ERROR_MESSAGES, MISC_MESSAGES } from '../src/messages.js';

const repondreParDefaut = modele.repondre;
after(fermer);
afterEach(() => {
  modele.repondre = repondreParDefaut;
});

const UN_JOUR = 24 * 3600 * 1000;
const sha256 = (valeur) => crypto.createHash('sha256').update(valeur).digest('hex');
const profil = (id) => base.users.find((user) => user.id === id);
const chat = (session, prompt, extra = {}) => appeler('/api/chat', { method: 'POST', session, body: { prompt, ...extra } });
const attendre = () => new Promise((resolve) => setImmediate(resolve));

// Compte avec mot de passe, haché à un coût réduit pour les tests
function compte(nom, motDePasse) {
  const user = { id: `c${crypto.randomBytes(8).toString('hex')}`, name: nom, nameNormalized: nom.toLowerCase(), email: `${nom.toLowerCase()}@exemple.fr`,
    passwordHash: bcrypt.hashSync(motDePasse, 4), visitCount: 2, messageCount: 0, conversations: [] };
  base.users.push(user);
  return user;
}

test('secret de service : 401 partout sans lui ou avec un faux, sonde publique', async () => {
  const routes = [['POST', '/api/auth/visitor'], ['POST', '/api/auth/login'], ['POST', '/api/auth/register'], ['POST', '/api/auth/logout'],
    ['POST', '/api/chat'], ['GET', '/api/chat/history'], ['GET', '/api/preferences'], ['POST', '/api/preferences'], ['POST', '/api/tracking/visit'],
    ['POST', '/api/tracking/redirect'], ['POST', '/api/tts'], ['GET', '/api/illusion/accueil?jeton=k3f9a0x2m1'], ['GET', '/api/illusion/cv/k3f9a0x2m1'],
    ['GET', '/api/admin/users'], ['GET', '/api/assets'], ['GET', '/api/tracking/pixel?id=campagne'], ['GET', '/api/inconnue']];
  for (const [method, chemin] of routes) {
    for (const secret of [null, 'mauvais-secret', `${SECRET}x`, SECRET.slice(0, -1), SECRET.toUpperCase()]) {
      const res = await appeler(chemin, { method, secret, body: method === 'POST' ? {} : undefined });
      assert.equal(res.status, 401, `${method} ${chemin} ${secret}`);
      assert.deepEqual(res.json, { error: ERROR_MESSAGES.serviceUnauthorized });
    }
  }
  const sante = await appeler('/health', { secret: null });
  assert.equal(sante.status, 503, 'aucune base dans les tests');
  assert.deepEqual(Object.keys(sante.json).sort(), ['db', 'rag', 'status', 'timestamp']);
  assert.deepEqual(sante.json.db, { connected: false });
  assert.deepEqual(sante.json.rag, { initialized: false, passages: 0 });
  assert.deepEqual((await appeler('/api/inconnue')).json, { error: ERROR_MESSAGES.notFound }, '404 en JSON avec le secret');

  // Sans secret, l'IP annoncée n'est pas crue (la limite de débit passe avant le secret)
  const requete = (secret) => ({ ip: '127.0.0.1', get: (nom) => ({ 'x-ovrane-service': secret, 'x-ovrane-client-ip': '198.51.100.9' })[nom.toLowerCase()] });
  assert.equal(ipClient(requete(undefined)), '127.0.0.1');
  assert.equal(ipClient(requete('mauvais-secret')), '127.0.0.1');
  assert.equal(ipClient(requete(SECRET)), '198.51.100.9');
});

test('activité : un clic humain ou le retour du recruteur la montent, un robot non', async () => {
  const ancienne = new Date(Date.now() - 200 * UN_JOUR);
  base.candidatures.push({ jeton: 'act1vite01', envoyee_le: ancienne, activite_le: ancienne, offre: { titre: 'Dev' } });
  const candidature = () => base.candidatures.find((c) => c.jeton === 'act1vite01');
  const clic = (userAgent) => appeler('/api/tracking/redirect', { method: 'POST', body: { path: '/redirectlinkedin/act1vite01', target: 'https://linkedin', cible: 'linkedin', jeton: 'act1vite01', userAgent } });

  assert.equal((await clic('Mozilla/5.0 (compatible; Googlebot/2.1)')).status, 200);
  assert.equal(candidature().activite_le, ancienne, 'un robot ne compte pas');
  await clic('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36');
  assert.ok(candidature().activite_le > ancienne, 'clic humain');

  candidature().activite_le = ancienne;
  assert.equal((await appeler('/api/illusion/accueil?jeton=act1vite01')).status, 200);
  assert.ok(candidature().activite_le > ancienne, 'retour sur le site');
});

test('conservation : 90 jours sans activité, visiteurs supprimés, comptes allégés, clics selon leur candidature', async () => {
  const maintenant = Date.now();
  const vieux = new Date(maintenant - 91 * UN_JOUR);
  const recent = new Date(maintenant - 10 * UN_JOUR);
  base.users.push(
    { id: 'vpurge-vieux', lastVisit: vieux, conversations: [{ prompt: 'a' }] },
    { id: 'vpurge-recent', lastVisit: recent, conversations: [{ prompt: 'b', timestamp: vieux }] },
    { id: 'cpurge-vieux', email: 'vieux@exemple.fr', lastVisit: vieux, conversations: [{ prompt: 'c' }], visitedLinks: ['/x'], ipHashes: ['h'] },
  );
  base.candidatures.push(
    { jeton: 'purgeact01', envoyee_le: vieux, activite_le: recent },
    { jeton: 'purgeold01', envoyee_le: vieux, activite_le: vieux },
  );
  base.logs.push(
    { path: '/redirectcv/purgeact01', jeton: 'purgeact01', timestamp: vieux },
    { path: '/redirectcv/purgeold01', jeton: 'purgeold01', timestamp: recent },
    { path: '/redirectcv/purgegone1', jeton: 'purgegone1', timestamp: recent },
    { path: '/redirectgithub', timestamp: vieux },
    { path: '/redirectlinkedin', timestamp: recent },
  );

  const bilan = await purger(maintenant);
  const ids = base.users.map((u) => u.id);
  assert.ok(!ids.includes('vpurge-vieux') && ids.includes('vpurge-recent'), 'visiteur inactif supprimé, actif gardé avec ses conversations');
  assert.equal(profil('vpurge-recent').conversations.length, 1);
  assert.deepEqual([profil('cpurge-vieux').conversations, profil('cpurge-vieux').visitedLinks, profil('cpurge-vieux').ipHashes], [[], [], []]);
  assert.equal(profil('cpurge-vieux').email, 'vieux@exemple.fr', 'le compte reste');
  const chemins = base.logs.map((l) => l.path);
  assert.ok(chemins.includes('/redirectcv/purgeact01'), 'vieux clic d\'une candidature encore active : gardé');
  assert.ok(!chemins.includes('/redirectcv/purgeold01'), 'clic récent d\'une candidature inactive : supprimé');
  assert.ok(!chemins.includes('/redirectcv/purgegone1'), 'candidature effacée par Illusion : ses clics partent');
  assert.ok(!chemins.includes('/redirectgithub') && chemins.includes('/redirectlinkedin'), 'sans candidature : sa propre date');
  assert.equal(bilan.visiteursSupprimes >= 1 && bilan.clicsSupprimes >= 3, true);
});

test('session requise : 401 sans session, ou avec un jeton inconnu, expiré ou mal formé, sans appeler le modèle', async () => {
  const expire = crypto.randomBytes(32).toString('base64url');
  base.sessions.push({ _id: sha256(expire), utilisateur: 'vexpire0001', creeLe: new Date(0), vuLe: new Date(0), expireLe: new Date(Date.now() - 1000) });
  const appels = appelsOpenAI.length;
  const routes = [['POST', '/api/chat', { prompt: 'Bonjour' }], ['GET', '/api/chat/history'], ['GET', '/api/preferences'],
    ['POST', '/api/preferences', { preference: 'backgroundColor', value: 'ocean' }], ['POST', '/api/tts', { text: 'Bonjour' }],
    ['POST', '/api/tracking/visit', { link: 'https://exemple.fr' }]];
  for (const session of [undefined, 'nimporte', crypto.randomBytes(32).toString('base64url'), expire]) {
    for (const [method, chemin, body] of routes) {
      const res = await appeler(chemin, { method, body, session });
      assert.equal(res.status, 401, `${method} ${chemin} ${session}`);
      assert.deepEqual(res.json, { error: ERROR_MESSAGES.sessionRequired });
    }
  }
  assert.equal(appelsOpenAI.length, appels);
});

test('visiteur : jeton opaque stocké haché, valable 30 jours, repris sans nouvelle session', async () => {
  const cree = await appeler('/api/auth/visitor', { method: 'POST', body: {} });
  assert.equal(cree.status, 200);
  const { jeton, expireLe } = cree.json.session;
  assert.match(jeton, /^[A-Za-z0-9_-]{43}$/);
  assert.match(cree.json.activeUserId, /^v[0-9a-f]{24}$/);
  assert.deepEqual(cree.json.userProfile, { name: null, visitCount: 1, isNewUser: true, messageCount: 0 });
  assert.equal(cree.json.reply, MISC_MESSAGES.welcomeNew());
  assert.deepEqual(cree.json.tts, { isStaticFile: true, staticUrl: VOIX_ACCUEIL.nouveau.url });
  assert.equal(base.sessions.find((s) => s.utilisateur === cree.json.activeUserId)._id, sha256(jeton));
  assert.ok(!JSON.stringify(base.sessions).includes(jeton), 'jeton jamais stocké en clair');
  const jours = (new Date(expireLe) - Date.now()) / UN_JOUR;
  assert.ok(jours > 29.9 && jours <= 30, `${jours} jours`);

  const repris = await appeler('/api/auth/visitor', { method: 'POST', session: jeton, body: { ancienId: 'vautre000000' } });
  assert.equal(repris.json.activeUserId, cree.json.activeUserId);
  assert.equal('session' in repris.json, false);
  assert.equal(repris.json.userProfile.isNewUser, false);
  assert.equal(repris.json.reply, MISC_MESSAGES.welcomeBack());
  assert.deepEqual(repris.json.tts, { isStaticFile: true, staticUrl: VOIX_ACCUEIL.retour.url });
  for (const { url } of Object.values(VOIX_ACCUEIL)) {
    assert.ok(fs.existsSync(new URL(`../../Venta/public${url}`, import.meta.url)), `${url} absent : npm run voix:accueil`);
  }
});

test('session : prolongée au plus une fois par jour à l\'usage', async () => {
  const { id, session } = await visiteur();
  const doc = base.sessions.find((s) => s.utilisateur === id);
  const { vuLe, expireLe } = doc;
  await appeler('/api/chat/history', { session });
  assert.deepEqual([doc.vuLe, doc.expireLe], [vuLe, expireLe], 'pas d\'écriture le même jour');
  doc.vuLe = new Date(Date.now() - 2 * UN_JOUR);
  doc.expireLe = new Date(Date.now() + UN_JOUR);
  assert.equal((await appeler('/api/chat/history', { session })).status, 200);
  assert.ok(doc.expireLe - Date.now() > 29 * UN_JOUR);
  assert.ok(Date.now() - doc.vuLe < 60_000);
});

test('migration ancienId : un ancien visiteur repris une seule fois, jamais un compte ni un identifiant calculable ou déjà affiché', async () => {
  const [ancien, compteV, mailV, nommeV] = ['a1', 'b2', 'c3', 'd4'].map((motif) => `v${motif.repeat(12)}`);
  base.users.push({ id: ancien, visitCount: 3, messageCount: 2, conversations: [] });
  const migre = await appeler('/api/auth/visitor', { method: 'POST', body: { ancienId: ancien } });
  assert.equal(migre.json.activeUserId, ancien);
  assert.match(migre.json.session.jeton, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(migre.json.userProfile, { name: null, visitCount: 3, isNewUser: false, messageCount: 2 });

  const recent = await visiteur();
  base.users.push({ id: compteV, passwordHash: 'hash', visitCount: 1 });
  base.users.push({ id: mailV, email: 'mail@exemple.fr', visitCount: 1 });
  base.users.push({ id: nommeV, name: 'Ancien', nameNormalized: 'ancien', visitCount: 4 });
  // Ancien format anonyme : sha256 de l'IP et du user-agent, calculable par un tiers
  base.users.push({ id: '0123456789abcdef', visitCount: 2 });
  const refuses = [ancien, recent.id, compte('Max', 'mot-de-passe-de-max').id, compteV, mailV, nommeV, '0123456789abcdef', [ancien], { $ne: null }];
  for (const ancienId of refuses) {
    const res = await appeler('/api/auth/visitor', { method: 'POST', body: { ancienId } });
    assert.equal(res.status, 200);
    assert.notEqual(res.json.activeUserId, typeof ancienId === 'string' ? ancienId : ancien, JSON.stringify(ancienId));
    assert.equal(res.json.userProfile.isNewUser, true, JSON.stringify(ancienId));
  }
});

test('inscription puis connexion : rotation de la session, déconnexion qui la révoque', async () => {
  const v = await visiteur();
  const inscrit = await appeler('/api/auth/register', { method: 'POST', session: v.session,
    body: { pseudo: 'Lea', email: 'lea@exemple.fr', password: 'un-mot-de-passe-long', inviteCode: 'invitation-de-test' } });
  assert.equal(inscrit.status, 200, JSON.stringify(inscrit.json));
  assert.deepEqual(inscrit.json.userProfile, { name: 'Lea', visitCount: 1, isNewUser: true, messageCount: 0 });
  const lea = base.users.find((user) => user.name === 'Lea');
  assert.ok(lea.passwordHash.startsWith('$2') && !lea.passwordHash.includes('un-mot-de-passe-long'));
  const s1 = inscrit.json.session.jeton;
  assert.equal((await appeler('/api/chat/history', { session: v.session })).status, 401, 'session du visiteur révoquée');
  assert.equal((await appeler('/api/chat/history', { session: s1 })).status, 200);

  const connecte = await appeler('/api/auth/login', { method: 'POST', session: s1, body: { identifier: ' LEA@exemple.fr', password: 'un-mot-de-passe-long' } });
  assert.equal(connecte.status, 200, JSON.stringify(connecte.json));
  assert.equal(connecte.json.activeUserId, lea.id);
  assert.equal(connecte.json.reply, MISC_MESSAGES.welcomeBack('Lea'));
  assert.equal(connecte.json.userProfile.isNewUser, false);
  const s2 = connecte.json.session.jeton;
  const reprisNomme = await appeler('/api/auth/visitor', { method: 'POST', session: s2, body: {} });
  assert.deepEqual([reprisNomme.json.reply, 'tts' in reprisNomme.json], [MISC_MESSAGES.welcomeBack('Lea'), false], 'accueil nommé : pas de voix pré-générée');
  assert.equal((await appeler('/api/chat/history', { session: s1 })).status, 401, 'ancienne session révoquée');

  assert.deepEqual((await appeler('/api/auth/logout', { method: 'POST', session: s2 })).json, { deconnexion: true });
  assert.equal((await appeler('/api/chat/history', { session: s2 })).status, 401, 'session révoquée');
  assert.deepEqual((await appeler('/api/auth/logout', { method: 'POST' })).json, { deconnexion: true });
});

test('connexion et inscription : même message que le compte existe ou non, mot de passe de 12 à 128 caractères', async () => {
  compte('Zoe', 'mot-de-passe-de-zoe');
  const inconnu = await appeler('/api/auth/login', { method: 'POST', body: { identifier: 'personne', password: 'mot-de-passe-de-zoe' } });
  const mauvais = await appeler('/api/auth/login', { method: 'POST', body: { identifier: 'zoe', password: 'mauvais-mot-de-passe' } });
  for (const res of [inconnu, mauvais]) assert.deepEqual([res.status, res.json], [401, { error: ERROR_MESSAGES.invalidCredentials }]);
  assert.equal((await appeler('/api/auth/login', { method: 'POST', body: { identifier: { $ne: null }, password: { $ne: null } } })).status, 401);

  const inscrire = (body) => appeler('/api/auth/register', { method: 'POST',
    body: { pseudo: 'Nouveau', email: 'nouveau@exemple.fr', password: 'un-mot-de-passe-long', inviteCode: 'invitation-de-test', ...body } });
  for (const password of ['x'.repeat(11), 'x'.repeat(129), 123456789012]) {
    assert.deepEqual((await inscrire({ password })).json, { error: ERROR_MESSAGES.passwordLength }, String(password));
  }
  assert.equal((await inscrire({ inviteCode: 'invitation-de-tesT' })).status, 403);
  assert.deepEqual((await inscrire({ pseudo: 'zoe' })).json, { error: ERROR_MESSAGES.accountTaken });
  assert.deepEqual((await inscrire({ email: 'ZOE@exemple.fr' })).json, { error: ERROR_MESSAGES.accountTaken });
});

test('limite de connexion : 10 essais par IP et 10 par identifiant sur 15 minutes', async () => {
  const essai = (identifier, ip) => appeler('/api/auth/login', { method: 'POST', ip, body: { identifier, password: 'mauvais-mot-de-passe' } });
  for (let i = 0; i < 10; i += 1) assert.equal((await essai(`cible${i}`, '198.51.100.1')).status, 401);
  const bloque = await essai('autre', '198.51.100.1');
  assert.deepEqual([bloque.status, bloque.json], [429, { error: ERROR_MESSAGES.tooManyRequests }]);
  assert.equal((await essai('autre', '198.51.100.2')).status, 401, 'une autre IP passe');

  for (let i = 0; i < 10; i += 1) assert.equal((await essai('victime', `198.51.101.${i}`)).status, 401);
  assert.equal((await essai(' VICTIME', '198.51.102.1')).status, 429, 'même identifiant depuis une nouvelle IP');
});

test('visiteurs : 30 créations par heure et par IP, la reprise par session ne compte pas', async () => {
  const ip = '198.51.103.1';
  const premier = await appeler('/api/auth/visitor', { method: 'POST', body: {}, ip });
  for (let i = 1; i < 30; i += 1) assert.equal((await appeler('/api/auth/visitor', { method: 'POST', body: {}, ip })).status, 200);
  assert.equal((await appeler('/api/auth/visitor', { method: 'POST', body: {}, ip })).status, 429);
  const repris = await appeler('/api/auth/visitor', { method: 'POST', body: {}, ip, session: premier.json.session.jeton });
  assert.equal(repris.status, 200);
  assert.equal(repris.json.activeUserId, premier.json.activeUserId);
});

test('identifiants du client ignorés : seule la session désigne l\'utilisateur', async () => {
  const a = await visiteur();
  const b = await visiteur();
  const userB = profil(b.id);
  userB.conversations = [{ prompt: 'secret de B', response: 'réponse à B', timestamp: new Date() }];
  userB.preferences = { backgroundColor: 'rose' };

  assert.deepEqual((await appeler(`/api/chat/history?userId=${b.id}&currentUserId=${b.id}`, { session: a.session })).json, { history: [] });
  const prefs = await appeler('/api/preferences', { method: 'POST', session: a.session, body: { preference: 'backgroundColor', value: 'ocean', currentUserId: b.id, userId: b.id } });
  assert.equal(prefs.status, 200);
  assert.equal(profil(a.id).preferences.backgroundColor, 'ocean');
  assert.equal(userB.preferences.backgroundColor, 'rose');
  assert.deepEqual((await appeler(`/api/preferences?userId=${b.id}`, { session: a.session })).json, { success: true, preferences: { backgroundColor: 'ocean' } });
  assert.equal((await appeler(`/api/preferences/${b.id}`, { session: a.session })).status, 404, 'ancienne route par identifiant retirée');

  await appeler('/api/tracking/visit', { method: 'POST', session: a.session, body: { link: 'https://exemple.fr/a', userId: b.id } });
  assert.deepEqual(profil(a.id).visitedLinks, ['https://exemple.fr/a']);
  assert.deepEqual(userB.visitedLinks, []);

  const res = await chat(a.session, 'Bonjour', { currentUserId: b.id, userId: b.id });
  assert.equal(res.json.activeUserId, a.id);
  assert.ok(!JSON.stringify(appelsOpenAI.at(-1).input).includes('secret de B'));
});

test('deux chats simultanés gardent chacun les commandes de leurs outils', async () => {
  const a = await visiteur();
  const b = await visiteur();
  let liberer;
  const chevauchement = new Promise((resolve) => { liberer = resolve; });
  let premiersTours = 0;
  modele.repondre = async ({ input }) => {
    const dernier = input.at(-1).content;
    if (dernier.startsWith('[RÉSULTAT')) return { output: [], output_text: 'Fond changé.' };
    // Chaque premier tour attend que l'autre ait commencé : les deux requêtes sont en vol en même temps
    premiersTours += 1;
    if (premiersTours === 2) liberer();
    await chevauchement;
    const paletteId = dernier.includes('premier') ? 'ocean' : 'rouge';
    return { output: [{ type: 'function_call', name: 'uiSetBackground', arguments: JSON.stringify({ paletteId }), call_id: paletteId }], output_text: '' };
  };
  const [ra, rb] = await Promise.all([chat(a.session, 'premier'), chat(b.session, 'second')]);
  assert.deepEqual(ra.json.commands, [{ command: 'SetBackground', parameter: 'ocean' }]);
  assert.deepEqual(rb.json.commands, [{ command: 'SetBackground', parameter: 'rouge' }]);
  assert.equal(profil(a.id).preferences.backgroundColor, 'ocean');
  assert.equal(profil(b.id).preferences.backgroundColor, 'rouge');
});

test('chat : message compté avant le modèle, éphémère compris ; au-delà de 50, interface verrouillée sans appel', async () => {
  const { id, session } = await visiteur();
  const user = profil(id);
  const ok = await chat(session, 'Bonjour', { isEphemeral: true });
  assert.deepEqual(Object.keys(ok.json).sort(), ['activeUserId', 'commands', 'reply', 'userProfile']);
  assert.equal(user.messageCount, 1);
  assert.equal(user.conversations.length, 0, 'éphémère non enregistré');
  await chat(session, 'Encore');
  await attendre();
  assert.equal(user.messageCount, 2);
  assert.deepEqual(user.conversations.map((c) => [c.prompt, c.response]), [['Encore', REPONSE]]);

  user.messageCount = MAX_MESSAGES - 1;
  const appels = appelsOpenAI.length;
  assert.equal((await chat(session, 'Le dernier')).json.reply, REPONSE);
  for (const prompt of ['De trop', 'Encore de trop']) {
    const bloque = await chat(session, prompt, { isEphemeral: true });
    assert.equal(bloque.json.reply, ERROR_MESSAGES.limitReached);
    assert.deepEqual(bloque.json.commands, [{ command: 'LockInterface', parameter: 'limit_reached' }]);
    assert.deepEqual(bloque.json.tts, { isStaticFile: true, staticUrl: '/endmessage.mp3' });
  }
  assert.equal(appelsOpenAI.length, appels + 1, 'le modèle n\'est plus appelé une fois la limite atteinte');
  assert.equal(user.messageCount, MAX_MESSAGES + 1, 'compteur plafonné');
});

test('chat : visite comptée une fois par heure, IP gardée en empreinte seulement', async () => {
  const { id, session } = await visiteur();
  const user = profil(id);
  await appeler('/api/chat', { method: 'POST', session, ip: '203.0.113.50', body: { prompt: 'Bonjour' } });
  assert.equal(user.visitCount, 1, 'moins d\'une heure après l\'arrivée');
  user.lastVisit = new Date(Date.now() - 2 * 3600 * 1000);
  const res = await appeler('/api/chat', { method: 'POST', session, ip: '203.0.113.50', body: { prompt: 'Rebonjour' } });
  assert.equal(user.visitCount, 2);
  assert.equal(res.json.userProfile.visitCount, 2);
  assert.ok(user.ipHashes.includes(sha256('203.0.113.50').slice(0, 16)));
  assert.ok(!JSON.stringify(user).includes('203.0.113.50'));
});

test('préférences : la lecture n\'écrit rien, l\'écriture n\'accepte que backgroundColor en texte court', async () => {
  const { id, session } = await visiteur();
  const user = profil(id);
  user.lastVisit = new Date(0);
  const avant = JSON.stringify(user);
  assert.deepEqual((await appeler('/api/preferences', { session })).json, { success: true, preferences: {} });
  assert.equal(JSON.stringify(user), avant);
  for (const body of [{ preference: 'theme', value: 'x' }, { preference: 'backgroundColor', value: { $set: 1 } }, { preference: 'backgroundColor', value: 'x'.repeat(65) }, {}]) {
    assert.equal((await appeler('/api/preferences', { method: 'POST', session, body })).status, 400, JSON.stringify(body));
  }
});

test('historique : paginé depuis la fin, en messages à plat', async () => {
  const { id, session } = await visiteur();
  profil(id).conversations = Array.from({ length: 30 }, (_, i) => ({ prompt: `q${i}`, response: `r${i}`, timestamp: new Date(i) }));
  const page = async (limit, skip) => (await appeler(`/api/chat/history?limit=${limit}&skip=${skip}`, { session })).json.history.map((m) => m.content);
  assert.deepEqual(await page(4, 0), ['q28', 'r28', 'q29', 'r29']);
  assert.deepEqual(await page(3, 1), ['q28', 'r28', 'q29']);
  assert.deepEqual(await page(100, 55), ['q0', 'r0', 'q1', 'r1', 'q2']);
  assert.deepEqual(await page(2, 5000), []);
  assert.equal((await page('abc', -3)).length, 50);
});

test('liens d\'arrivée : sans doublon, 100 au plus', async () => {
  const { id, session } = await visiteur();
  const envoyer = (link) => appeler('/api/tracking/visit', { method: 'POST', session, body: { link } });
  await envoyer('https://exemple.fr/1');
  await envoyer('https://exemple.fr/1');
  assert.deepEqual(profil(id).visitedLinks, ['https://exemple.fr/1']);
  profil(id).visitedLinks = Array.from({ length: 100 }, (_, i) => `https://exemple.fr/${i}`);
  assert.equal((await envoyer('https://exemple.fr/de-trop')).json.success, true);
  assert.equal(profil(id).visitedLinks.length, 100);
  assert.equal((await envoyer('x'.repeat(2049))).status, 400);
});

test('fond : demande explicite appliquée et retenue sans appel d\'outil, jamais pour une question', async () => {
  const { id, session } = await visiteur();
  assert.deepEqual((await chat(session, 'Mets le fond en gris ciel')).json.commands, [{ command: 'SetBackground', parameter: 'gris_ciel' }]);
  assert.equal(profil(id).preferences.backgroundColor, 'gris_ciel');
  assert.deepEqual((await chat(session, 'Quelles palettes de fond sont disponibles ?')).json.commands, []);
  assert.deepEqual((await chat(session, 'maintenant en écarlate')).json.commands, []);
});

test('erreurs : JSON invalide en 400, erreur interne en 500, sans détail ni pile', async () => {
  const invalide = await appeler('/api/auth/login', { method: 'POST', body: '{"identifier":' });
  assert.deepEqual([invalide.status, invalide.json], [400, { error: ERROR_MESSAGES.badRequest }]);
  const { session } = await visiteur();
  modele.repondre = async () => {
    throw new Error('panne détaillée du modèle');
  };
  const res = await chat(session, 'Bonjour');
  assert.deepEqual([res.status, res.json], [500, { error: ERROR_MESSAGES.internalServerError }]);
});

test('TTS : texte de 1 000 caractères au plus, audio du fournisseur sans Markdown ni lien', async () => {
  const { session } = await visiteur();
  const dire = (body) => appeler('/api/tts', { method: 'POST', session, body });
  assert.equal((await dire({ text: 'a'.repeat(1001) })).status, 413);
  assert.equal((await dire({})).status, 400);
  const audio = await dire({ text: 'Bonjour **Max**, voir https://exemple.fr' });
  assert.equal(audio.status, 200);
  assert.equal(audio.headers.get('content-type'), 'audio/mpeg');
  assert.equal(audio.headers.get('x-tts-provider'), 'openai');
  assert.equal(audio.bytes.toString(), 'audio:Bonjour Max, voir un lien');
});

test('TTS : Cartesia en premier, sans langue imposée ; refusé (crédits épuisés), OpenAI prend le relais', async () => {
  const { session } = await visiteur();
  const fetchReel = globalThis.fetch;
  const envois = [];
  let statut = 200;
  config.tts.cartesiaKey = 'cle-de-test';
  // Seuls les appels à Cartesia sont simulés ; ceux du test vers le serveur local passent
  globalThis.fetch = (url, init) => {
    if (!String(url).startsWith('https://api.cartesia.ai/')) return fetchReel(url, init);
    envois.push(JSON.parse(init.body));
    return Promise.resolve(new Response(statut === 200 ? 'mp3-cartesia' : '{}', { status: statut }));
  };
  try {
    const dire = () => appeler('/api/tts', { method: 'POST', session, body: { text: 'Bonjour **Max**' } });
    const cartesia = await dire();
    assert.equal(cartesia.headers.get('x-tts-provider'), 'cartesia');
    assert.equal(cartesia.bytes.toString(), 'mp3-cartesia');
    assert.deepEqual([envois[0].transcript, envois[0].model_id, 'language' in envois[0]], ['Bonjour Max', 'sonic-3.6', false]);
    statut = 402;
    const relais = await dire();
    assert.equal(relais.headers.get('x-tts-provider'), 'openai');
    assert.equal(envois.length, 2);
  } finally {
    globalThis.fetch = fetchReel;
    config.tts.cartesiaKey = '';
  }
});

test('schéma Session : collection sessions, effacée par MongoDB à expireLe', () => {
  assert.equal(Session.collection.collectionName, 'sessions');
  assert.equal(Session.schema.indexes().find(([champs]) => champs.expireLe === 1)?.[1].expireAfterSeconds, 0);
});

test('IP relayée : une IPv6 compte pour son /64, une valeur qui n\'est pas une IP est ignorée', async () => {
  const essai = (ip) => appeler('/api/auth/login', { method: 'POST', ip, body: { identifier: `ipv6-${ip}`, password: 'mauvais-mot-de-passe' } });
  for (let i = 1; i <= 10; i += 1) assert.equal((await essai(`2001:db8:5:6::${i.toString(16)}`)).status, 401);
  assert.equal((await essai('2001:0db8:0005:0006:ffff:1:2:3')).status, 429, 'même /64, autre écriture');
  assert.equal((await essai('2001:db8:5:7::1')).status, 401, 'autre /64');

  await appeler('/api/tracking/redirect', { method: 'POST', ip: 'pas-une-ip', body: { path: '/redirectcv', target: '/cv.pdf' } });
  assert.notEqual(base.logs.at(-1).ip, 'pas-une-ip');
});

test('connexion : pseudo aux espaces multiples, retrouvé comme à l\'inscription', async () => {
  const inscrit = await appeler('/api/auth/register', { method: 'POST',
    body: { pseudo: 'Jean  Pierre', email: 'jp@exemple.fr', password: 'un-mot-de-passe-long', inviteCode: 'invitation-de-test' } });
  assert.equal(inscrit.status, 200, JSON.stringify(inscrit.json));
  const connecte = await appeler('/api/auth/login', { method: 'POST', body: { identifier: 'jean  pierre', password: 'un-mot-de-passe-long' } });
  assert.equal(connecte.json.activeUserId, inscrit.json.activeUserId);
  assert.equal((await appeler('/api/auth/register', { method: 'POST',
    body: { pseudo: 'X', email: `${'a.'.repeat(200)}@exemple.fr`, password: 'un-mot-de-passe-long', inviteCode: 'invitation-de-test' } })).status, 400);
});

test('configuration : le serveur refuse de démarrer sans NODE_ENV connu ni secret en production', () => {
  const demarrer = (env) => spawnSync(process.execPath, ['src/server.js'], { cwd: new URL('..', import.meta.url), env: { ...process.env, ...env }, encoding: 'utf8', timeout: 20_000 });
  for (const [env, attendu] of [[{ NODE_ENV: '' }, 'NODE_ENV'], [{ NODE_ENV: 'staging' }, 'NODE_ENV'], [{ NODE_ENV: 'production', SERVICE_SECRET: '' }, 'SERVICE_SECRET']]) {
    const { status, stderr } = demarrer(env);
    assert.equal(status, 1, JSON.stringify(env));
    assert.ok(stderr.includes(attendu), stderr);
  }
});
