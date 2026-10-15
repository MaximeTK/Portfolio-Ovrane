/**
 * Tests sans base réelle : liens suivis, robots, accueil, contexte du chat et routes Illusion (modèles simulés)
 * Lancement : npm run test:illusion
 */
import assert from 'node:assert/strict';
import { parseRedirectPath, REDIRECT_TARGETS, isValidJeton as isValidJetonFront } from '../../Venta/src/lib/redirections.ts';
import { CHAT_UI } from '../../Venta/src/lib/messages.ts';

// Environnement maîtrisé avant tout import du serveur : aucune base, aucun appel OpenAI réel
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'sk-test-local';

const { isValidJeton, isRobotUserAgent } = await import('../src/lib/validators.js');
const { formatCandidatureContext, MISC_MESSAGES } = await import('../src/lib/messages.js');
const { buildVisitorContext } = await import('../src/lib/promptBuilder.js');
const { configureServer } = await import('../src/lib/server/serverConfig.js');
const { setupIllusionRoutes } = await import('../src/routes/illusionRoute.js');
const { setupTrackingRoute } = await import('../src/routes/trackingRoute.js');
const { setupAuthRoutes } = await import('../src/routes/authRoute.js');
const { setupChatRoute } = await import('../src/routes/chatRoute.js');
const { IllusionCandidature } = await import('../src/models/IllusionCandidature.js');
const { IllusionFichier } = await import('../src/models/IllusionFichier.js');
const { RedirectLog } = await import('../src/models/RedirectLog.js');
const { User } = await import('../src/models/User.js');

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`❌ ${name}\n   ${error instanceof Error ? error.message : String(error)}`);
  }
}

const JETON = 'k3f9a0x2m1';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const OFFICE = 'Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.17928; Pro)';

// ========================================
// 1. Liens suivis : cible et jeton (middleware)
// ========================================

await test('analyse des chemins : anciens liens, nouveaux mots-clés, jetons valides ou non', () => {
  const cases = [
    ['/redirectcv', 'cv', null],
    ['/redirectcv-orange', 'cv', null],
    ['/campagne/redirectcv', 'cv', null],
    ['/redirectcvdesign', 'cvdesign', null],
    ['/redirectcvdesign-ubisoft', 'cvdesign', null],
    ['/redirectlinkedin', 'linkedin', null],
    ['/redirectlinkedin-ubisoft', 'linkedin', null],
    ['/redirectlinkedinxyz/abc', 'linkedin', null],
    [`/redirectlinkedin/${JETON}`, 'linkedin', JETON],
    [`/redirectlinkedin/${JETON}/`, 'linkedin', JETON],
    [`/redirectlinkedin/${JETON}/suite`, 'linkedin', JETON],
    [`/redirectgithub/${JETON}`, 'github', JETON],
    ['/redirectgithub', 'github', null],
    [`/redirectportfolio/${JETON}`, 'portfolio', JETON],
    ['/redirectportfolio', 'portfolio', null],
    [`/redirectcv/${JETON}`, 'cv', JETON],
    [`/redirectcvdesign/${JETON}`, 'cvdesign', JETON],
    ['/redirectlinkedin/k3f9a0x2m', 'linkedin', null],
    ['/redirectlinkedin/k3f9a0x2m1x', 'linkedin', null],
    ['/redirectlinkedin/k3f9-0x2m1', 'linkedin', null],
    ['/RedirectLinkedIn/K3F9A0X2M1'.toLowerCase(), 'linkedin', JETON],
  ];
  for (const [path, cible, jeton] of cases) {
    assert.deepEqual(parseRedirectPath(path), { cible, jeton }, path);
  }
  for (const path of ['/', '/orange', '/connexion', `/${JETON}`, '/redirect', '/redirectx']) {
    assert.equal(parseRedirectPath(path), null, path);
  }
});

await test('destinations : anciennes inchangées, GitHub et accueil ajoutés', () => {
  assert.equal(REDIRECT_TARGETS.cvdesign, '/assets/CV_Maxime_Thiong-kay.pdf');
  assert.equal(REDIRECT_TARGETS.cv, '/assets/CV_Maxime_Thiong-kay_Imprimable.pdf');
  assert.equal(REDIRECT_TARGETS.linkedin, 'https://www.linkedin.com/in/maxime-thiong-kay/');
  assert.equal(REDIRECT_TARGETS.github, 'https://github.com/MaximeTK');
  assert.equal(REDIRECT_TARGETS.portfolio, '/');
});

await test('format du jeton identique côté frontend et backend', () => {
  const cases = [[JETON, true], ['0123456789', true], ['K3F9A0X2M1', false], ['k3f9a0x2m', false],
    ['k3f9a0x2m1x', false], ['k3f9a0x2m!', false], ['', false], [null, false], [undefined, false], [1234567890, false]];
  for (const [value, expected] of cases) {
    assert.equal(isValidJetonFront(value), expected, `front ${value}`);
    assert.equal(isValidJeton(value), expected, `back ${value}`);
  }
});

// ========================================
// 2. Détection des robots (backend)
// ========================================

await test('user-agents humains : jamais robots', () => {
  const humans = [
    CHROME,
    `${CHROME} Edg/128.0.2739.42`,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1234',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ];
  for (const ua of humans) assert.equal(isRobotUserAgent(ua), false, ua);
});

await test('scanners, aperçus, crawlers, clients HTTP, sans tête et pré-requête Office : robots', () => {
  const robots = [
    OFFICE,
    'Mozilla/4.0 (compatible; ms-office; MSOffice 16)',
    'Microsoft Office Existence Discovery',
    'Mozilla/5.0 (compatible; SafeLinks)',
    'Mozilla/5.0 (compatible; Proofpoint URL Defense)',
    'Mimecast Link Scanner',
    'Barracuda Sentinel (EE)',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'WhatsApp/2.24.18.80 A',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5 skype-url-preview@microsoft.com',
    'TelegramBot (like TwitterBot)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0 Safari/537.36',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'curl/8.9.1',
    'Wget/1.21.4',
    'python-requests/2.32.3',
    'Python-urllib/3.12',
    'Go-http-client/2.0',
    'okhttp/4.12.0',
    'axios/1.7.7',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0.0.0 Safari/537.36',
    '',
    'unknown',
    undefined,
    null,
  ];
  for (const ua of robots) assert.equal(isRobotUserAgent(ua), true, String(ua));
});

// ========================================
// 3. Accueil et contexte du chat
// ========================================

const CANDIDATURE = {
  jeton: JETON,
  langue: 'fr',
  offre: {
    titre: 'Développeur React',
    entreprise: 'Orange SA',
    lieu: '',
    contrat: 'CDI',
    url: 'https://emploi.example/offre/42',
    description: 'Construire des interfaces React pour la relation client.',
    metiers: ['Dev'],
  },
  entreprise: { nom: 'Orange', secteur: 'Télécoms', site: '', localisation: 'Paris', effectif: '', activite: '' },
  cv: { profil: 'Développeur front-end', competences: ['React', 'TypeScript'], texte: 'Texte complet du CV.' },
  lettre: 'Madame, Monsieur, votre poste React correspond à mon parcours.',
};

await test('message d\'accueil du recruteur (frontend) en français, en anglais, ou vide', () => {
  assert.equal(
    CHAT_UI.recruiterWelcome({ entreprise: 'Orange', poste: 'Développeur React', langue: 'fr' }),
    'Bienvenue ! Vous découvrez la candidature de Maxime au poste « Développeur React » chez Orange. Je vous présente son parcours et ses projets : en quoi puis-je vous aider ?',
  );
  assert.equal(
    CHAT_UI.recruiterWelcome({ entreprise: 'Orange', poste: 'React Developer', langue: 'en' }),
    "Welcome! You are viewing Maxime's application for the React Developer position at Orange. I can walk you through his background and projects: how can I help you?",
  );
  assert.match(CHAT_UI.recruiterWelcome({ entreprise: 'Orange', poste: '', langue: '' }), /candidature de Maxime chez Orange\./);
  assert.equal(CHAT_UI.recruiterWelcome({ entreprise: ' ', poste: '', langue: 'fr' }), '');
});

await test('accueil du backend : avec nom inchangé, sans nom pour un visiteur', () => {
  assert.equal(MISC_MESSAGES.welcomeNew('Max'), 'Bienvenue Max, enchantée de faire votre connaissance. En quoi puis-je vous aider ?');
  assert.equal(MISC_MESSAGES.welcomeBack('Max'), 'Ravie de vous revoir Max, en quoi puis-je vous aider ?');
  assert.equal(MISC_MESSAGES.welcomeNew(), 'Bienvenue, enchantée de faire votre connaissance. En quoi puis-je vous aider ?');
  assert.equal(MISC_MESSAGES.welcomeBack(null), 'Ravie de vous revoir, en quoi puis-je vous aider ?');
});

await test('bloc de contexte : entreprise, poste, pièces, consignes, champs vides omis', () => {
  assert.equal(formatCandidatureContext(null), '');
  const block = formatCandidatureContext(CANDIDATURE);
  assert.match(block, /^VISITEUR RECRUTEUR : le visiteur est un recruteur de l'entreprise Orange pour le poste « Développeur React »/);
  for (const piece of ['Construire des interfaces React', '- Compétences : React, TypeScript', 'Texte complet du CV.',
    'votre poste React correspond', '- Métiers : Dev', '- Localisation : Paris']) {
    assert.ok(block.includes(piece), piece);
  }
  for (const rule of ['saluant le visiteur par son entreprise et le poste', 'venu par le lien du CV', "N'invente rien",
    'en cohérence avec la lettre']) {
    assert.ok(block.includes(rule), rule);
  }
  assert.ok(!block.includes('- Lieu :'), 'champ vide omis');
  assert.match(formatCandidatureContext({ offre: { entreprise: 'Orange SA' } }), /l'entreprise Orange SA pour le poste « non précisé »/);
  // Rangée par Illusion, la lettre est un objet avec son texte et son fichier
  assert.ok(formatCandidatureContext({ ...CANDIDATURE, lettre: { texte: 'Lettre rangée.', fichier: null } }).includes('Lettre rangée.'));
});

await test('contexte visiteur : bloc en tête avec candidature, inchangé sans', () => {
  const profile = { name: null, visitCount: 1, preferences: {} };
  const without = buildVisitorContext(profile);
  const withBlock = buildVisitorContext(profile, CANDIDATURE);
  assert.ok(without.startsWith('UTILISATEUR: Visiteur anonyme'));
  assert.ok(withBlock.startsWith('VISITEUR RECRUTEUR'));
  assert.ok(withBlock.endsWith(without));
});

// ========================================
// 4. Schémas mongoose
// ========================================

await test('User : email absent par défaut (index sparse unique), nom nul', () => {
  const visitor = new User({ id: 'vtest000001' }).toObject();
  assert.equal('email' in visitor, false);
  assert.equal(visitor.name, null);
  assert.equal(visitor.passwordHash, null);
});

await test('RedirectLog : champs facultatifs, jeton indexé, TTL d\'un an conservé', async () => {
  const log = new RedirectLog({ path: '/redirectcv', target: '/x' });
  await log.validate();
  const plain = log.toObject();
  assert.equal('jeton' in plain || 'cible' in plain || 'robot' in plain, false);
  await assert.rejects(new RedirectLog({ path: '/x', target: '/y', cible: 'evil' }).validate(), /cible/);
  assert.equal(RedirectLog.schema.path('timestamp').options.expires, 60 * 60 * 24 * 365);
  const jetonIndex = RedirectLog.schema.indexes().find(([fields]) => fields.jeton === 1);
  assert.ok(jetonIndex, 'index jeton');
  assert.equal(jetonIndex[1].sparse, true);
});

await test('IllusionCandidature et IllusionFichier : collections partagées avec Illusion, jeton unique, sans péremption', () => {
  const indexes = IllusionCandidature.schema.indexes();
  const unique = indexes.find(([fields]) => fields.jeton === 1);
  assert.equal(unique?.[1].unique, true);
  assert.equal(indexes.some(([, options]) => 'expireAfterSeconds' in options), false);
  assert.equal(IllusionCandidature.collection.collectionName, 'illusion_candidatures');
  assert.equal(IllusionFichier.collection.collectionName, 'illusion_fichiers');
  assert.equal(IllusionCandidature.schema.path('lettre.fichier').instance, 'ObjectId');
});

// ========================================
// 5. Routes HTTP avec modèles simulés (aucun accès MongoDB)
// ========================================

const db = { candidatures: new Map(), fichiers: new Map(), logs: [], users: new Map(), calls: [] };
const lean = (value) => ({ lean: async () => value });

IllusionCandidature.findOne = (filter, projection) => {
  db.calls.push({ op: 'candidature.findOne', filter, projection });
  return lean(db.candidatures.get(filter.jeton) ?? null);
};
IllusionFichier.findById = (id, projection) => {
  db.calls.push({ op: 'fichier.findById', id, projection });
  return lean(db.fichiers.get(String(id)) ?? null);
};
RedirectLog.create = async (doc) => {
  const saved = { timestamp: new Date(), ...doc };
  db.logs.push(saved);
  return saved;
};
User.findOne = (filter) => {
  db.calls.push({ op: 'user.findOne', filter });
  const user = db.users.get(filter.id);
  const visitorOnly = 'name' in filter || 'passwordHash' in filter;
  return lean(user && (!visitorOnly || (!user.name && !user.passwordHash)) ? user : null);
};
User.findOneAndUpdate = (filter) => lean(db.users.get(filter.id) ?? null);
User.create = async (doc) => {
  db.calls.push({ op: 'user.create', doc });
  db.users.set(doc.id, { name: null, passwordHash: null, ...doc });
  return doc;
};

const openaiCalls = [];
const fakeOpenAI = {
  responses: {
    create: async (params) => {
      openaiCalls.push(params);
      return { output: [], output_text: 'Bonjour, bienvenue sur le portfolio.' };
    },
  },
};

const { app } = configureServer();
setupChatRoute(app, fakeOpenAI, false);
setupAuthRoutes(app);
setupTrackingRoute(app);
setupIllusionRoutes(app);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    redirect: 'manual',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  const bytes = Buffer.from(await res.arrayBuffer());
  let json = null;
  try { json = JSON.parse(bytes.toString('utf8')); } catch { json = null; }
  return { status: res.status, json, bytes, headers: res.headers };
}

// Ce qu'Illusion range dans la base partagée : la candidature et le PDF de son CV
const FICHIER_CV = '665f1c2b9a1d4e0012345678';
const PDF = Buffer.from('%PDF-1.4 CV de la candidature');
db.candidatures.set(JETON, { ...CANDIDATURE, cv: { ...CANDIDATURE.cv, fichier: FICHIER_CV } });
db.candidatures.set('a1b2c3d4e5', { ...CANDIDATURE, jeton: 'a1b2c3d4e5', entreprise: { nom: '' }, langue: 'en' });
// Lu en lean, un Buffer revient du pilote MongoDB comme un Binary qui porte le contenu dans .buffer
db.fichiers.set(FICHIER_CV, { donnees: { buffer: PDF }, type: 'application/pdf' });

try {
  await test('GET accueil : public, entreprise, poste et langue seulement', async () => {
    const res = await call(`/api/illusion/accueil/${JETON}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { entreprise: 'Orange', poste: 'Développeur React', langue: 'fr' });
    const lookup = db.calls.findLast((c) => c.op === 'candidature.findOne');
    for (const hidden of ['lettre', 'cv', 'offre.description', 'cv.texte']) {
      assert.equal(hidden in lookup.projection, false, hidden);
    }
    assert.equal(res.headers.get('ratelimit-limit'), '120');
    assert.equal((await call('/api/illusion/accueil/K3F9A0X2M1')).status, 404);
    assert.equal((await call('/api/illusion/accueil/zzzzzzzzzz')).status, 404);
    assert.equal((await call('/api/illusion/accueil/trop-long-pour-un-jeton')).status, 404);
  });

  await test("GET accueil : entreprise de l'offre si la fiche est vide", async () => {
    const res = await call('/api/illusion/accueil/a1b2c3d4e5');
    assert.deepEqual(res.json, { entreprise: 'Orange SA', poste: 'Développeur React', langue: 'en' });
  });

  await test('GET cv : le PDF rangé avec la candidature, servi en ligne et jamais mis en cache', async () => {
    const res = await call(`/api/illusion/cv/${JETON}`);
    assert.equal(res.status, 200);
    assert.ok(res.bytes.equals(PDF));
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.equal(res.headers.get('content-disposition'), 'inline; filename="CV.pdf"');
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    const lookup = db.calls.findLast((c) => c.op === 'candidature.findOne');
    assert.deepEqual(lookup.projection, { _id: 0, 'cv.fichier': 1 });
    assert.equal(String(db.calls.findLast((c) => c.op === 'fichier.findById').id), FICHIER_CV);
  });

  await test('GET cv : sans fichier, jeton inconnu ou mal formé en 404, sans lecture pour un jeton mal formé', async () => {
    assert.equal((await call('/api/illusion/cv/a1b2c3d4e5')).status, 404);
    assert.equal((await call('/api/illusion/cv/zzzzzzzzzz')).status, 404);
    const lookups = db.calls.filter((c) => c.op === 'candidature.findOne').length;
    const bad = await call('/api/illusion/cv/K3F9A0X2M1');
    assert.equal(bad.status, 404);
    assert.deepEqual(bad.json, { error: 'CV introuvable' });
    assert.equal(db.calls.filter((c) => c.op === 'candidature.findOne').length, lookups);
  });

  await test('suivi de redirection : cible, jeton et robot calculé par le serveur', async () => {
    const before = db.logs.length;
    const send = (body) => call('/api/tracking/redirect', { method: 'POST', body });
    assert.equal((await send({ path: `/redirectlinkedin/${JETON}`, target: REDIRECT_TARGETS.linkedin, cible: 'linkedin', jeton: JETON, userAgent: OFFICE })).status, 200);
    assert.equal((await send({ path: `/redirectlinkedin/${JETON}`, target: REDIRECT_TARGETS.linkedin, cible: 'linkedin', jeton: JETON, userAgent: CHROME, robot: true })).status, 200);
    assert.equal((await send({ path: '/redirectcv-orange', target: REDIRECT_TARGETS.cv, userAgent: CHROME })).status, 200);
    assert.equal((await send({ path: '/redirectx', target: '/', cible: 'evil', jeton: 'ABC', userAgent: 'curl/8.9.1', robot: false })).status, 200);
    const [office, chrome, legacy, forged] = db.logs.slice(before);
    assert.deepEqual([office.cible, office.jeton, office.robot], ['linkedin', JETON, true]);
    assert.deepEqual([chrome.cible, chrome.jeton, chrome.robot], ['linkedin', JETON, false]);
    assert.deepEqual([legacy.cible, legacy.jeton, legacy.robot, legacy.target], [undefined, undefined, false, REDIRECT_TARGETS.cv]);
    assert.deepEqual([forged.cible, forged.jeton, forged.robot], [undefined, undefined, true]);
  });

  let visitorId = null;

  await test('visiteur : profil créé sans saisie, puis repris ; jamais un compte', async () => {
    const created = await call('/api/auth/visitor', { method: 'POST', body: {} });
    assert.equal(created.status, 200);
    visitorId = created.json.activeUserId;
    assert.match(visitorId, /^v[0-9a-f]{24}$/);
    assert.deepEqual(created.json.userProfile, { name: null, visitCount: 1, isNewUser: true, messageCount: 0 });
    assert.equal(created.json.reply, MISC_MESSAGES.welcomeNew());
    assert.equal('email' in db.calls.findLast((c) => c.op === 'user.create').doc, false);

    const resumed = await call('/api/auth/visitor', { method: 'POST', body: { userId: visitorId } });
    assert.equal(resumed.json.activeUserId, visitorId);
    assert.equal(resumed.json.userProfile.isNewUser, false);
    assert.equal(resumed.json.reply, MISC_MESSAGES.welcomeBack());
    assert.deepEqual(db.calls.findLast((c) => c.op === 'user.findOne').filter, { id: visitorId, name: null, passwordHash: null });

    db.users.set('compte000001', { id: 'compte000001', name: 'Max', passwordHash: 'hash', visitCount: 3 });
    const account = await call('/api/auth/visitor', { method: 'POST', body: { userId: 'compte000001' } });
    assert.notEqual(account.json.activeUserId, 'compte000001');
    assert.equal(account.json.userProfile.isNewUser, true);
  });

  await test('chat : le jeton ajoute le bloc du recruteur en tête du contexte visiteur, après les consignes fixes', async () => {
    const before = openaiCalls.length;
    const send = (extra) => call('/api/chat', { method: 'POST', body: { prompt: 'Quels projets pour ce poste ?', currentUserId: visitorId, ...extra } });

    const withJeton = await send({ jeton: JETON });
    assert.equal(withJeton.status, 200, JSON.stringify(withJeton.json));
    assert.equal(withJeton.json.reply, 'Bonjour, bienvenue sur le portfolio.');
    const [fixe, visiteur] = openaiCalls[before].input;
    assert.equal(fixe.role, 'system');
    assert.equal(visiteur.role, 'system');
    assert.ok(!fixe.content.includes('VISITEUR RECRUTEUR'), 'consignes fixes sans candidature');
    assert.ok(visiteur.content.startsWith("VISITEUR RECRUTEUR : le visiteur est un recruteur de l'entreprise Orange pour le poste « Développeur React »"));
    assert.ok(visiteur.content.includes(CANDIDATURE.lettre));

    const lookups = db.calls.filter((c) => c.op === 'candidature.findOne').length;
    for (const extra of [{}, { jeton: 'zzzzzzzzzz' }, { jeton: 'PAS-UN-JETON' }]) {
      const res = await send(extra);
      assert.equal(res.status, 200);
      assert.equal(openaiCalls.at(-1).input[0].content, fixe.content, 'préfixe identique pour le cache');
      assert.ok(!openaiCalls.at(-1).input[1].content.includes('VISITEUR RECRUTEUR'), JSON.stringify(extra));
    }
    // Seul le jeton bien formé et inconnu interroge la base
    assert.equal(db.calls.filter((c) => c.op === 'candidature.findOne').length, lookups + 1);
  });
} finally {
  server.close();
}

console.log(`\n${passed} réussi(s), ${failures.length} échec(s)`);
if (failures.length) {
  console.log(`Échecs : ${failures.join(' | ')}`);
  process.exitCode = 1;
}
