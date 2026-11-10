/** Tests hors ligne du relais d'Illusion : session, en-têtes, flux, pannes */
import { base, visiteur, fermer, SECRET } from './simulation.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import http from 'http';
import { once } from 'node:events';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { ERROR_MESSAGES } from '../src/messages.js';
import { User } from '../src/models/User.js';
import { reinitialiser } from '../src/services/reinitialisation.js';

const SECRET_ILLUSION = 'secret-illusion-de-test';
const MO = 1024 * 1024;
const FICHIER = crypto.randomBytes(3 * MO);

// Faux serveur d'Illusion : garde chaque requête et répond selon le chemin
const recues = [];
const illusion = http.createServer((req, res) => {
  const morceaux = [];
  req.on('data', (morceau) => morceaux.push(morceau));
  req.on('end', () => {
    recues.push({ method: req.method, url: req.url, headers: req.headers, corps: Buffer.concat(morceaux) });
    if (req.url.startsWith('/api/lent')) return;
    if (req.url.startsWith('/api/coupe')) return req.socket.destroy();
    if (req.url.startsWith('/api/fichier')) {
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': "attachment; filename*=UTF-8''cv%20%C3%A9t%C3%A9.pdf",
        'Content-Length': FICHIER.length, 'Set-Cookie': 'illusion_session=x; HttpOnly', 'X-Interne': 'oui' });
      return res.end(FICHIER);
    }
    if (req.url.startsWith('/api/mail')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "sandbox; default-src 'none'; img-src data:" });
      return res.end('<p>Bonjour</p>');
    }
    if (req.url.startsWith('/api/hostile')) {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'none'" });
      return res.end('<meta http-equiv="refresh" content="0;url=https://evil.example">');
    }
    if (req.url.startsWith('/api/nomme') || req.url.startsWith('/api/en-ligne')) {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'none'",
        'Content-Disposition': req.url.startsWith('/api/nomme') ? 'attachment; filename="mail.html"' : 'inline' });
      return res.end('<p>Bonjour</p>');
    }
    if (req.url.startsWith('/api/page')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<script>alert(1)</script>');
    }
    if (req.url.startsWith('/api/type?')) {
      res.writeHead(200, { 'Content-Type': new URL(req.url, 'http://illusion').searchParams.get('t') });
      return res.end('<x/>');
    }
    if (req.url.startsWith('/api/refus')) {
      res.writeHead(422, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ detail: [{ type: 'missing', loc: ['body', 'url'], msg: 'Field required' }] }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'illusion_session=x' });
    res.end(JSON.stringify({ ok: true, taille: Buffer.concat(morceaux).length }));
  });
});
illusion.listen(0, '127.0.0.1');
await once(illusion, 'listening');
const ILLUSION_URL = `http://127.0.0.1:${illusion.address().port}`;
Object.assign(config.illusion, { url: ILLUSION_URL, secret: SECRET_ILLUSION });

// Une instance à soi pour envoyer des chemins bruts, que fetch normaliserait
const relais = createApp({ openai: {} }).listen(0, '127.0.0.1');
await once(relais, 'listening');
after(() => {
  fermer();
  relais.close();
  illusion.closeAllConnections();
  illusion.close();
});

// Un compte avec e-mail et sa session
const SESSION = crypto.randomBytes(32).toString('base64url');
base.users.push({ id: 'cillusion01', name: 'Essai', nameNormalized: 'essai', email: 'essai@exemple.test', emailVerifieLe: new Date(), visitCount: 1, conversations: [] });
base.sessions.push({ _id: crypto.createHash('sha256').update(SESSION).digest('hex'), utilisateur: 'cillusion01',
  creeLe: new Date(), vuLe: new Date(), expireLe: new Date(Date.now() + 3600 * 1000) });

// Requête comme Next la relaie ; un tableau part sans longueur annoncée
function envoyer(chemin, { methode = 'GET', session = SESSION, secret = SECRET, entetes = {}, corps } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: relais.address().port, path: chemin, method: methode,
      headers: { ...(secret ? { 'X-Ovrane-Service': secret } : {}), ...(session ? { 'X-Ovrane-Session': session } : {}), ...entetes },
    }, (res) => {
      const morceaux = [];
      res.on('data', (morceau) => morceaux.push(morceau));
      res.on('end', () => {
        const bytes = Buffer.concat(morceaux);
        let json = null;
        try {
          json = JSON.parse(bytes.toString('utf8'));
        } catch {
          json = null;
        }
        resolve({ status: res.statusCode, headers: res.headers, bytes, json });
      });
    });
    req.on('error', reject);
    if (Array.isArray(corps)) {
      for (const morceau of corps) req.write(morceau);
      req.end();
    } else req.end(corps);
  });
}

test('relais Illusion : 401 sans secret, sans session ou pour un visiteur, sans rien demander à Illusion', async () => {
  const avant = recues.length;
  const sansSecret = await envoyer('/api/illusion/app/candidatures', { secret: null });
  assert.deepEqual([sansSecret.status, sansSecret.json], [401, { error: ERROR_MESSAGES.serviceUnauthorized }]);
  const sansSession = await envoyer('/api/illusion/app/candidatures', { session: null });
  assert.deepEqual([sansSession.status, sansSession.json], [401, { error: ERROR_MESSAGES.sessionRequired }]);
  const inconnue = await envoyer('/api/illusion/app/candidatures', { session: crypto.randomBytes(32).toString('base64url') });
  assert.equal(inconnue.status, 401);
  const { session } = await visiteur();
  const anonyme = await envoyer('/api/illusion/app/candidatures', { session });
  assert.deepEqual([anonyme.status, anonyme.json], [401, { error: ERROR_MESSAGES.illusionAccountRequired }]);
  assert.equal(recues.length, avant);
});

test('relais Illusion : méthode, chemin, requête et compte relayés ; cookies, origine et en-têtes du relais venus du client jamais', async () => {
  const res = await envoyer('/api/illusion/app/candidatures/7/piece?etat=PRETE&n=2', {
    entetes: { Cookie: 'illusion_session=vol; ovrane_session=vol', Origin: 'https://attaquant.example', 'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'cors', 'X-Ovrane-Utilisateur': 'pirate@exemple.test', 'X-Illusion-Jeton': 'vol', 'X-Ovrane-Client-Ip': '198.51.100.4' },
  });
  assert.equal(res.status, 200);
  const recue = recues.at(-1);
  assert.deepEqual([recue.method, recue.url], ['GET', '/api/candidatures/7/piece?etat=PRETE&n=2']);
  assert.equal(recue.headers['x-ovrane-service'], SECRET_ILLUSION, 'le secret du relais, jamais celui de Next');
  assert.equal(recue.headers['x-ovrane-utilisateur'], 'essai@exemple.test');
  for (const nom of ['cookie', 'origin', 'sec-fetch-site', 'sec-fetch-mode', 'x-ovrane-session', 'x-illusion-jeton', 'x-ovrane-client-ip']) {
    assert.equal(recue.headers[nom], undefined, nom);
  }
  assert.equal(res.headers['set-cookie'], undefined, 'un cookie d\'Illusion ne revient jamais au navigateur');
  assert.equal(res.headers['cache-control'], 'no-store');
  for (const methode of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await envoyer('/api/illusion/app/offres/1', { methode })).status, 200, methode);
    assert.deepEqual([recues.at(-1).method, recues.at(-1).url], [methode, '/api/offres/1']);
  }
});

test('relais Illusion : corps brut bien au-delà de la limite JSON, type gardé ; 15 Mo en base64 passent, 413 au-delà, annoncés ou non', async () => {
  const json = Buffer.from(JSON.stringify({ nature: 'cv', nom: 'cv.pdf', contenu: crypto.randomBytes(15 * MO).toString('base64') }));
  const res = await envoyer('/api/illusion/app/pieces-lettre', { methode: 'POST', entetes: { 'Content-Type': 'application/json' }, corps: json });
  assert.deepEqual([res.status, res.json.taille], [200, json.length]);
  assert.ok(recues.at(-1).corps.equals(json));
  assert.equal(recues.at(-1).headers['content-type'], 'application/json');
  const brut = crypto.randomBytes(MO);
  const enMorceaux = await envoyer('/api/illusion/app/brut', { methode: 'PUT', entetes: { 'Content-Type': 'application/octet-stream' }, corps: [brut, brut] });
  assert.equal(enMorceaux.status, 200);
  assert.ok(recues.at(-1).corps.equals(Buffer.concat([brut, brut])), 'corps sans longueur annoncée relayé tel quel');

  const avant = recues.length;
  const annonce = await envoyer('/api/illusion/app/pieces-lettre', { methode: 'POST', corps: Buffer.alloc(22 * MO) });
  assert.deepEqual([annonce.status, annonce.json], [413, { error: ERROR_MESSAGES.illusionTooLarge }]);
  assert.equal(recues.length, avant, 'refusé avant d\'appeler Illusion');
  const sansLongueur = await envoyer('/api/illusion/app/pieces-lettre', { methode: 'POST', corps: Array.from({ length: 22 }, () => Buffer.alloc(MO)) });
  assert.deepEqual([sansLongueur.status, sansLongueur.json], [413, { error: ERROR_MESSAGES.illusionTooLarge }]);
});

test('relais Illusion : réponse en flux avec son statut, son type, son nom et sa longueur ; erreur et CSP d\'Illusion telles quelles', async () => {
  const fichier = await envoyer('/api/illusion/app/fichier');
  assert.equal(fichier.status, 200);
  assert.ok(fichier.bytes.equals(FICHIER));
  assert.equal(fichier.headers['content-type'], 'application/pdf');
  assert.equal(fichier.headers['content-disposition'], "attachment; filename*=UTF-8''cv%20%C3%A9t%C3%A9.pdf");
  assert.equal(fichier.headers['content-length'], String(FICHIER.length));
  assert.equal(fichier.headers['set-cookie'], undefined);
  assert.equal(fichier.headers['x-interne'], undefined);

  const refus = await envoyer('/api/illusion/app/refus', { methode: 'POST' });
  assert.deepEqual([refus.status, refus.json], [422, { detail: [{ type: 'missing', loc: ['body', 'url'], msg: 'Field required' }] }]);
  assert.equal((await envoyer('/api/illusion/app/mail')).headers['content-security-policy'], "sandbox; default-src 'none'; img-src data:");
  // Isolé par sandbox, il s'affiche ; sinon, il se télécharge
  assert.equal((await envoyer('/api/illusion/app/mail')).headers['content-disposition'], undefined);
  const hostile = await envoyer('/api/illusion/app/hostile');
  assert.equal(hostile.headers['content-disposition'], 'attachment');
  assert.equal((await envoyer('/api/illusion/app/nomme')).headers['content-disposition'], 'attachment; filename="mail.html"');
  assert.equal((await envoyer('/api/illusion/app/en-ligne')).headers['content-disposition'], 'attachment');
  assert.equal(hostile.headers['content-security-policy'], "default-src 'none'");
  // Sans CSP d'Illusion, une page active ne s'exécute pas sur le domaine du site
  assert.equal((await envoyer('/api/illusion/app/page')).headers['content-security-policy'], "sandbox; default-src 'none'");
  assert.equal((await envoyer('/api/illusion/app/candidatures')).headers['content-security-policy'], undefined);
  // Tout type XML que le navigateur rend en document, XSL compris ; le reste non
  for (const [type, isole] of [['application/rss+xml', true], ['application/atom+xml', true], ['text/xsl', true], ['application/xaml+xml', true],
    ['application/vnd.foo+xml; charset=utf-8', true], ['image/svg+xml', true], ['application/pdf', false], ['text/plain', false], ['application/xmlx', false]]) {
    const res = await envoyer(`/api/illusion/app/type?t=${encodeURIComponent(type)}`);
    assert.equal(res.headers['content-security-policy'], isole ? "sandbox; default-src 'none'" : undefined, type);
  }
});

test('relais Illusion : 503 coupé, injoignable ou muet au-delà du délai, 502 réponse interrompue', async () => {
  const essayer = async (reglage, chemin = '/api/illusion/app/candidatures') => {
    const avant = { ...config.illusion };
    Object.assign(config.illusion, reglage);
    try {
      return await envoyer(chemin);
    } finally {
      Object.assign(config.illusion, avant);
    }
  };
  const coupe = await essayer({ secret: '' });
  assert.deepEqual([coupe.status, coupe.json], [503, { error: ERROR_MESSAGES.illusionUnavailable }]);
  const injoignable = await essayer({ url: 'http://127.0.0.1:1' });
  assert.deepEqual([injoignable.status, injoignable.json], [503, { error: ERROR_MESSAGES.illusionUnavailable }]);
  const muet = await essayer({ delai: 200 }, '/api/illusion/app/lent');
  assert.deepEqual([muet.status, muet.json], [503, { error: ERROR_MESSAGES.illusionUnavailable }]);
  const interrompue = await envoyer('/api/illusion/app/coupe');
  assert.deepEqual([interrompue.status, interrompue.json], [502, { error: ERROR_MESSAGES.illusionBadGateway }]);
});

test('relais Illusion : rien ne sort de son API, même par des segments `..`', async () => {
  const avant = recues.length;
  for (const chemin of ['/api/illusion/app/../../auth/compte', '/api/illusion/app/%2e%2e/%2e%2e/connexion', '/api/illusion/app/..']) {
    const res = await envoyer(chemin);
    assert.deepEqual([res.status, res.json], [404, { error: ERROR_MESSAGES.notFound }], chemin);
  }
  assert.equal(recues.length, avant);
});

test('relais Illusion : sa propre limite, hors de la limite globale des autres routes', async () => {
  const ip = { 'X-Ovrane-Client-Ip': '203.0.113.50' };
  const restant = async () => Number((await envoyer('/api/auth/compte', { entetes: ip })).headers['ratelimit-remaining']);
  const avant = await restant();
  for (let i = 0; i < 5; i++) {
    const res = await envoyer('/api/illusion/app/candidatures', { entetes: ip });
    assert.equal(res.headers['ratelimit-limit'], '60000');
  }
  assert.equal(await restant(), avant - 1, 'les requêtes d\'Illusion ne comptent pas dans la limite globale');
});

test('relais Illusion : une adresse non vérifiée n\'ouvre rien, sans rien demander à Illusion', async () => {
  const avant = recues.length;
  const jeton = crypto.randomBytes(32).toString('base64url');
  base.users.push({ id: 'cnonverifie', name: 'Non', nameNormalized: 'non', email: 'non@exemple.test', visitCount: 1, conversations: [] });
  base.sessions.push({ _id: crypto.createHash('sha256').update(jeton).digest('hex'), utilisateur: 'cnonverifie',
    creeLe: new Date(), vuLe: new Date(), expireLe: new Date(Date.now() + 3600 * 1000) });
  const refus = await envoyer('/api/illusion/app/candidatures', { session: jeton });
  assert.deepEqual([refus.status, refus.json], [403, { error: ERROR_MESSAGES.illusionEmailNonVerifie }]);
  assert.equal(recues.length, avant);
});

// Une session neuve du compte, pour ne pas fermer celle des autres tests
function sessionNeuve(utilisateur) {
  const jeton = crypto.randomBytes(32).toString('base64url');
  base.sessions.push({ _id: crypto.createHash('sha256').update(jeton).digest('hex'), utilisateur,
    creeLe: new Date(), vuLe: new Date(), expireLe: new Date(Date.now() + 3600 * 1000) });
  return jeton;
}

test('relais Illusion : un compte vérifié se lit une fois par rafale, un refus se relit à chaque appel', async (t) => {
  const lecture = t.mock.method(User, 'findOne');
  const session = sessionNeuve('cillusion01');
  const reponses = await Promise.all(Array.from({ length: 5 }, () => envoyer('/api/illusion/app/rafale', { session })));
  assert.deepEqual(reponses.map((r) => r.status), [200, 200, 200, 200, 200]);
  assert.equal((await envoyer('/api/illusion/app/rafale', { session })).status, 200);
  assert.equal(recues.at(-1).headers['x-ovrane-utilisateur'], 'essai@exemple.test');
  assert.equal(lecture.mock.callCount(), 1);

  base.users.push({ id: 'cattente', name: 'Attente', nameNormalized: 'attente', email: 'attente@exemple.test', visitCount: 1, conversations: [] });
  const attente = sessionNeuve('cattente');
  assert.equal((await envoyer('/api/illusion/app/rafale', { session: attente })).status, 403);
  base.users.find((u) => u.id === 'cattente').emailVerifieLe = new Date();
  assert.equal((await envoyer('/api/illusion/app/rafale', { session: attente })).status, 200, 'vérifiée : ouvert aussitôt');
});

test('relais Illusion : déconnexion et nouveau mot de passe ferment aussitôt le relais', async () => {
  base.users.push({ id: 'cfermeture', name: 'Fermeture', nameNormalized: 'fermeture', email: 'fermeture@exemple.test', emailVerifieLe: new Date(), visitCount: 1, conversations: [] });
  const session = sessionNeuve('cfermeture');
  assert.equal((await envoyer('/api/illusion/app/rafale', { session })).status, 200);
  assert.equal((await envoyer('/api/auth/logout', { methode: 'POST', session, entetes: { 'Content-Type': 'application/json' }, corps: '{}' })).status, 200);
  const fermee = await envoyer('/api/illusion/app/rafale', { session });
  assert.deepEqual([fermee.status, fermee.json], [401, { error: ERROR_MESSAGES.sessionRequired }]);

  const autre = sessionNeuve('cfermeture');
  assert.equal((await envoyer('/api/illusion/app/rafale', { session: autre })).status, 200);
  const lien = crypto.randomBytes(32).toString('base64url');
  base.reinitialisations.push({ _id: crypto.createHash('sha256').update(lien).digest('hex'), utilisateur: 'cfermeture',
    creeLe: new Date(), expireLe: new Date(Date.now() + 60 * 1000) });
  assert.equal(await reinitialiser(lien, 'nouveau-mot-de-passe'), true);
  assert.equal((await envoyer('/api/illusion/app/rafale', { session: autre })).status, 401);
});

test('relais Illusion : ni connexion, ni inscription, ni canal du logiciel de bureau ; la lecture du compte passe', async () => {
  const avant = recues.length;
  for (const [methode, chemin] of [['POST', '/api/illusion/app/session'], ['POST', '/api/illusion/app/inscription'],
    ['GET', '/api/illusion/app/inscription'], ['POST', '/api/illusion/app/mains/tour'], ['POST', '/api/illusion/app/mains%2Fordre'],
    ['POST', '/api/illusion/app/mains/tour//'], ['POST', '/api/illusion/app/session%2F%2F'], ['POST', '/api/illusion/app/x/..%2Fsession'],
    ['POST', '/api/illusion/app/mains/x/..%2Ftour'], ['GET', '/api/illusion/app/x//y'], ['GET', '/api/illusion/app/x/.%2Fy']]) {
    const corps = methode === 'GET' ? {} : { entetes: { 'Content-Type': 'application/json' }, corps: '{}' };
    assert.equal((await envoyer(chemin, { methode, ...corps })).status, 404, `${methode} ${chemin}`);
  }
  assert.equal(recues.length, avant, 'rien n\'atteint Illusion');
  assert.equal((await envoyer('/api/illusion/app/session')).status, 200);
  assert.equal(recues.at(-1).url, '/api/session');
  // Un identifiant encodé qui porte « // » (Message-ID en base64) passe tel quel
  assert.equal((await envoyer('/api/illusion/app/mails/fil/CA%2B%2F%2Fx%40mail')).status, 200);
  assert.equal(recues.at(-1).url, '/api/mails/fil/CA%2B%2F%2Fx%40mail');
});

test('relais Illusion : le même plafond par compte que par IP, plusieurs IP ne le multiplient pas', async () => {
  const session = sessionNeuve('cillusion01');
  const restant = async (ip) => Number((await envoyer('/api/illusion/app/candidatures', { session, entetes: { 'X-Ovrane-Client-Ip': ip } })).headers['ratelimit-remaining']);
  const premier = await restant('203.0.113.71');
  assert.equal(await restant('203.0.113.72'), premier - 1, 'compté pour le compte, IP neuve ou non');
});

test('relais Illusion : le compte du serveur s\'ouvre avec un second facteur seul ; en production, tout compte s\'il n\'est pas déclaré', async () => {
  const serveur = base.users.find((u) => u.id === 'cillusion01');
  base.users.push({ id: 'cautre2f', name: 'Autre', nameNormalized: 'autre2f', email: 'autre2f@exemple.test', emailVerifieLe: new Date(), visitCount: 1, conversations: [] });
  const statut = async (utilisateur) => (await envoyer('/api/illusion/app/candidatures', { session: sessionNeuve(utilisateur) })).status;
  config.illusion.compteServeur = 'essai@exemple.test';
  try {
    const avant = recues.length;
    const refus = await envoyer('/api/illusion/app/candidatures', { session: sessionNeuve('cillusion01') });
    assert.deepEqual([refus.status, refus.json], [403, { error: ERROR_MESSAGES.illusionDeuxiemeFacteur }]);
    assert.equal(recues.length, avant, 'rien n\'atteint Illusion');
    assert.equal(await statut('cautre2f'), 200, 'un autre compte n\'en a pas besoin');
    serveur.deuxiemeFacteur = { activeLe: new Date() };
    assert.equal(await statut('cillusion01'), 200);
    config.illusion.compteServeur = '';
    config.production = true;
    assert.equal(await statut('cautre2f'), 403, 'compte du serveur non déclaré : tout compte');
    assert.equal(await statut('cillusion01'), 200);
  } finally {
    config.illusion.compteServeur = '';
    config.production = false;
    delete serveur.deuxiemeFacteur;
  }
});
