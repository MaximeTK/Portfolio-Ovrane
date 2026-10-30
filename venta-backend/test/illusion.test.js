/**
 * Tests hors ligne d'Illusion : liens suivis, robots, contexte du recruteur, schémas et routes avec la base simulée
 */
import { base, appeler, visiteur, fermer, appelsOpenAI, REPONSE } from './simulation.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { isValidJeton, isRobotUserAgent } from '../src/validators.js';
import { formatCandidatureContext, MISC_MESSAGES } from '../src/messages.js';
import { signerVoix } from '../src/services/voix.js';
import { buildVisitorContext } from '../src/services/chat/generer.js';
import { IllusionCandidature } from '../src/models/IllusionCandidature.js';
import { IllusionFichier } from '../src/models/IllusionFichier.js';
import { RedirectLog } from '../src/models/RedirectLog.js';
import { User } from '../src/models/User.js';

after(fermer);

// Le front est relu à chaque test : une modification en cours de Venta/ n'empêche pas les autres de tourner
const front = async (fichier) => import(new URL(`../../Venta/src/lib/${fichier}`, import.meta.url).href);

const JETON = 'k3f9a0x2m1';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const OFFICE = 'Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.17928; Pro)';

// Lectures de candidatures, pour vérifier projection et absence de requête
const lectures = [];
const findOne = IllusionCandidature.findOne;
IllusionCandidature.findOne = (filtre, projection) => {
  lectures.push({ filtre, projection });
  return findOne(filtre, projection);
};

test('front : chemins des liens suivis, anciens et nouveaux, jetons valides ou non', async () => {
  const { parseRedirectPath } = await front('redirections.ts');
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
  for (const [path, cible, jeton] of cases) assert.deepEqual(parseRedirectPath(path), { cible, jeton }, path);
  for (const path of ['/', '/orange', '/connexion', `/${JETON}`, '/redirect', '/redirectx']) assert.equal(parseRedirectPath(path), null, path);
});

test('front : destinations, anciennes inchangées, GitHub et accueil ajoutés', async () => {
  const { REDIRECT_TARGETS } = await front('redirections.ts');
  assert.equal(REDIRECT_TARGETS.cvdesign, '/assets/CV_Maxime_Thiong-kay.pdf');
  assert.equal(REDIRECT_TARGETS.cv, '/assets/CV_Maxime_Thiong-kay_Imprimable.pdf');
  assert.equal(REDIRECT_TARGETS.linkedin, 'https://www.linkedin.com/in/maxime-thiong-kay/');
  assert.equal(REDIRECT_TARGETS.github, 'https://github.com/MaximeTK');
  assert.equal(REDIRECT_TARGETS.portfolio, '/');
});

test('format du jeton identique côté front et backend', async () => {
  const { isValidJeton: isValidJetonFront } = await front('redirections.ts');
  const cases = [[JETON, true], ['0123456789', true], ['K3F9A0X2M1', false], ['k3f9a0x2m', false],
    ['k3f9a0x2m1x', false], ['k3f9a0x2m!', false], ['', false], [null, false], [undefined, false], [1234567890, false]];
  for (const [value, expected] of cases) {
    assert.equal(isValidJetonFront(value), expected, `front ${value}`);
    assert.equal(isValidJeton(value), expected, `back ${value}`);
  }
});

test('accueil du recruteur en français, en anglais, ou vide, écrit par le serveur', () => {
  assert.equal(
    MISC_MESSAGES.recruiterWelcome({ entreprise: 'Orange', poste: 'Développeur React', langue: 'fr' }),
    'Oh, bienvenue ! Vous êtes de chez Orange, je présume, pour le poste « Développeur React ». Je suis Ovrane, une intelligence artificielle chargée de vous accompagner sur ce portfolio.',
  );
  assert.equal(
    MISC_MESSAGES.recruiterWelcome({ entreprise: 'Orange', poste: 'React Developer', langue: 'en' }),
    "Oh, welcome! You're from Orange, I presume, here about the React Developer position. I'm Ovrane, an AI assistant, and I'll be guiding you through this portfolio.",
  );
  assert.match(MISC_MESSAGES.recruiterWelcome({ entreprise: 'Orange', poste: '', langue: '' }), /Vous êtes de chez Orange, je présume\. Je suis Ovrane/);
  assert.match(MISC_MESSAGES.recruiterWelcome({ entreprise: '', poste: 'Développeur React', langue: 'fr' }), /Vous venez pour le poste « Développeur React », je présume\./);
  assert.equal(MISC_MESSAGES.recruiterWelcome({ entreprise: ' ', poste: '', langue: 'fr' }), '');
});

test('front : la voix découpe en blocs de 4 phrases et de 900 caractères au plus, entre deux phrases', async () => {
  const { splitTextIntoTTSBlocks } = await import(new URL('../../Venta/src/features/oeil/useTTS.ts', import.meta.url).href);
  const courtes = Array.from({ length: 8 }, (_, i) => `Phrase ${i + 1}.`).join(' ');
  assert.deepEqual(splitTextIntoTTSBlocks(courtes).map((b) => b.split('.').length - 1), [4, 4]);
  // Quatre phrases de 250 caractères, 1 003 en tout : refusées par le backend en un seul bloc
  const longues = Array.from({ length: 4 }, () => `${'a'.repeat(249)}.`).join(' ');
  const blocs = splitTextIntoTTSBlocks(longues);
  assert.deepEqual(blocs.map((b) => b.length), [752, 250]);
  assert.equal(blocs.join(' '), longues, 'aucun mot perdu ni coupé');
});

test('user-agents humains : jamais robots', () => {
  const humains = [
    CHROME,
    `${CHROME} Edg/128.0.2739.42`,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1234',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ];
  for (const ua of humains) assert.equal(isRobotUserAgent(ua), false, ua);
});

test('scanners, aperçus, crawlers, clients HTTP, sans tête et pré-requête Office : robots', () => {
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

test('accueil du backend : avec nom inchangé, sans nom pour un visiteur, et toujours annoncé comme une IA', () => {
  assert.equal(MISC_MESSAGES.welcomeNew('Max'), 'Bienvenue Max ! Je suis Ovrane, une intelligence artificielle qui présente le portfolio de Maxime. En quoi puis-je vous aider ?');
  assert.equal(MISC_MESSAGES.welcomeBack('Max'), 'Ravie de vous revoir Max ! Je suis Ovrane, l\'intelligence artificielle de ce portfolio. En quoi puis-je vous aider ?');
  assert.equal(MISC_MESSAGES.welcomeNew(), 'Bienvenue ! Je suis Ovrane, une intelligence artificielle qui présente le portfolio de Maxime. En quoi puis-je vous aider ?');
  assert.equal(MISC_MESSAGES.welcomeBack(null), 'Ravie de vous revoir ! Je suis Ovrane, l\'intelligence artificielle de ce portfolio. En quoi puis-je vous aider ?');
});

test('bloc de contexte : entreprise, poste, pièces, consignes, champs vides omis', () => {
  assert.equal(formatCandidatureContext(null), '');
  const block = formatCandidatureContext(CANDIDATURE);
  assert.match(block, /^VISITEUR RECRUTEUR : le visiteur est un recruteur de l'entreprise Orange pour le poste « Développeur React »/);
  for (const piece of ['Construire des interfaces React', '- Compétences : React, TypeScript', 'Texte complet du CV.',
    'votre poste React correspond', '- Métiers : Dev', '- Localisation : Paris']) {
    assert.ok(block.includes(piece), piece);
  }
  for (const rule of ['saluant le visiteur par son entreprise et le poste', 'venu par le lien du CV', "N'invente rien", 'en cohérence avec la lettre']) {
    assert.ok(block.includes(rule), rule);
  }
  assert.ok(!block.includes('- Lieu :'), 'champ vide omis');
  assert.match(formatCandidatureContext({ offre: { entreprise: 'Orange SA' } }), /l'entreprise Orange SA pour le poste « non précisé »/);
  // Rangée par Illusion, la lettre est un objet avec son texte et son fichier
  assert.ok(formatCandidatureContext({ ...CANDIDATURE, lettre: { texte: 'Lettre rangée.', fichier: null } }).includes('Lettre rangée.'));
});

test('contexte visiteur : bloc en tête avec candidature, inchangé sans', () => {
  const profil = { name: null, visitCount: 1, preferences: {} };
  const sans = buildVisitorContext(profil);
  const avec = buildVisitorContext(profil, CANDIDATURE);
  assert.ok(sans.startsWith('UTILISATEUR: Visiteur anonyme'));
  assert.ok(avec.startsWith('VISITEUR RECRUTEUR'));
  assert.ok(avec.endsWith(sans));
});

test('schémas : email absent par défaut, RedirectLog facultatif avec TTL d\'un an, collections partagées avec Illusion', async () => {
  const profil = new User({ id: 'vtest000001' }).toObject();
  assert.equal('email' in profil, false);
  assert.equal(profil.name, null);
  assert.equal(profil.passwordHash, null);

  const log = new RedirectLog({ path: '/redirectcv', target: '/x' });
  await log.validate();
  const plain = log.toObject();
  assert.equal('jeton' in plain || 'cible' in plain || 'robot' in plain, false);
  await assert.rejects(new RedirectLog({ path: '/x', target: '/y', cible: 'evil' }).validate(), /cible/);
  assert.equal(RedirectLog.schema.path('timestamp').options.expires, undefined, 'pas de TTL : purge par activité');
  const jetonIndex = RedirectLog.schema.indexes().find(([fields]) => fields.jeton === 1);
  assert.equal(jetonIndex?.[1].sparse, true);

  const indexes = IllusionCandidature.schema.indexes();
  assert.equal(indexes.find(([fields]) => fields.jeton === 1)?.[1].unique, true);
  assert.equal(indexes.some(([, options]) => 'expireAfterSeconds' in options), false);
  assert.equal(IllusionCandidature.collection.collectionName, 'illusion_candidatures');
  assert.equal(IllusionFichier.collection.collectionName, 'illusion_fichiers');
  assert.equal(IllusionCandidature.schema.path('lettre.fichier').instance, 'ObjectId');
});

// Ce qu'Illusion range dans la base partagée : la candidature et le PDF de son CV
const FICHIER_CV = '665f1c2b9a1d4e0012345678';
const PDF = Buffer.from('%PDF-1.4 CV de la candidature');
base.candidatures.push({ ...CANDIDATURE, cv: { ...CANDIDATURE.cv, fichier: FICHIER_CV } });
base.candidatures.push({ ...CANDIDATURE, jeton: 'a1b2c3d4e5', entreprise: { nom: '' }, langue: 'en' });
// Lu en lean, un Buffer revient du pilote MongoDB comme un Binary qui porte le contenu dans .buffer
base.fichiers.push({ _id: FICHIER_CV, donnees: { buffer: PDF }, type: 'application/pdf' });

test('GET accueil : entreprise, poste et langue seulement, 404 pour un jeton inconnu ou mal formé', async () => {
  const res = await appeler(`/api/illusion/accueil?jeton=${JETON}`);
  assert.equal(res.status, 200);
  const accueil = { entreprise: 'Orange', poste: 'Développeur React', langue: 'fr' };
  const texte = MISC_MESSAGES.recruiterWelcome(accueil);
  assert.deepEqual(res.json, { ...accueil, texte, voix: signerVoix(texte) }, 'le texte part écrit et signé par le serveur');
  for (const cache of ['lettre', 'cv', 'offre.description', 'cv.texte']) assert.equal(cache in lectures.at(-1).projection, false, cache);
  for (const jeton of ['K3F9A0X2M1', 'zzzzzzzzzz', 'trop-long-pour-un-jeton', '']) {
    assert.equal((await appeler(`/api/illusion/accueil?jeton=${jeton}`)).status, 404, jeton);
  }
  assert.equal((await appeler(`/api/illusion/accueil?jeton=${JETON}&jeton=${JETON}`)).status, 404, 'jeton en tableau');
});

test('GET accueil : entreprise de l\'offre si la fiche est vide', async () => {
  const res = await appeler('/api/illusion/accueil?jeton=a1b2c3d4e5');
  assert.deepEqual({ ...res.json, texte: undefined, voix: undefined }, { entreprise: 'Orange SA', poste: 'Développeur React', langue: 'en', texte: undefined, voix: undefined });
  assert.match(res.json.texte, /^Oh, welcome! You're from Orange SA/);
});

test('GET cv : le PDF rangé avec la candidature, servi en ligne et jamais mis en cache', async () => {
  const res = await appeler(`/api/illusion/cv/${JETON}`);
  assert.equal(res.status, 200);
  assert.ok(res.bytes.equals(PDF));
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.equal(res.headers.get('content-disposition'), 'inline; filename="CV.pdf"');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(lectures.at(-1).projection, { _id: 0, 'cv.fichier': 1 });

  // Un type rangé en base n'est jamais repris : du HTML partirait exécutable sur le domaine du portfolio
  base.candidatures.push({ ...CANDIDATURE, jeton: 'h1h2h3h4h5', cv: { fichier: '665f1c2b9a1d4e0012345679' } });
  base.fichiers.push({ _id: '665f1c2b9a1d4e0012345679', donnees: Buffer.from('<script>alert(1)</script>'), type: 'text/html' });
  assert.equal((await appeler('/api/illusion/cv/h1h2h3h4h5')).headers.get('content-type'), 'application/pdf');
});

test('GET cv : sans fichier ou jeton inconnu en 404, jeton mal formé sans lecture', async () => {
  assert.equal((await appeler('/api/illusion/cv/a1b2c3d4e5')).status, 404);
  assert.equal((await appeler('/api/illusion/cv/zzzzzzzzzz')).status, 404);
  const avant = lectures.length;
  const res = await appeler('/api/illusion/cv/K3F9A0X2M1');
  assert.equal(res.status, 404);
  assert.deepEqual(res.json, { error: 'CV introuvable' });
  assert.equal(lectures.length, avant);
});

test('suivi de redirection : cible, jeton et robot calculés par le serveur, IP du visiteur relayée', async () => {
  const avant = base.logs.length;
  const envoyer = (body, ip) => appeler('/api/tracking/redirect', { method: 'POST', body, ip });
  const linkedin = 'https://www.linkedin.com/in/maxime-thiong-kay/';
  assert.equal((await envoyer({ path: `/redirectlinkedin/${JETON}`, target: linkedin, cible: 'linkedin', jeton: JETON, userAgent: OFFICE }, '203.0.113.7')).status, 200);
  assert.equal((await envoyer({ path: `/redirectlinkedin/${JETON}`, target: linkedin, cible: 'linkedin', jeton: JETON, userAgent: CHROME, robot: true })).status, 200);
  assert.equal((await envoyer({ path: '/redirectcv-orange', target: '/assets/cv.pdf', userAgent: CHROME })).status, 200);
  assert.equal((await envoyer({ path: '/redirectx', target: '/', cible: 'evil', jeton: 'ABC', userAgent: 'curl/8.9.1', robot: false })).status, 200);
  const [office, chrome, ancien, force] = base.logs.slice(avant);
  assert.deepEqual([office.cible, office.jeton, office.robot, office.ip], ['linkedin', JETON, true, '203.0.113.0']);
  assert.deepEqual([chrome.cible, chrome.jeton, chrome.robot], ['linkedin', JETON, false]);
  assert.deepEqual([ancien.cible, ancien.jeton, ancien.robot, ancien.target], [undefined, undefined, false, '/assets/cv.pdf']);
  assert.deepEqual([force.cible, force.jeton, force.robot], [undefined, undefined, true]);
  assert.equal((await envoyer({ path: '/redirectcv' })).status, 400);
});

test('chat : le jeton ajoute le bloc du recruteur en tête du contexte visiteur, après les consignes fixes', async () => {
  const { session } = await visiteur();
  const avant = appelsOpenAI.length;
  const envoyer = (extra) => appeler('/api/chat', { method: 'POST', session, body: { prompt: 'Quels projets pour ce poste ?', ...extra } });

  const avecJeton = await envoyer({ jeton: JETON });
  assert.equal(avecJeton.status, 200, JSON.stringify(avecJeton.json));
  assert.equal(avecJeton.json.reply, REPONSE);
  const [fixe, contexte] = appelsOpenAI[avant].input;
  assert.equal(fixe.role, 'system');
  assert.equal(contexte.role, 'system');
  assert.ok(!fixe.content.includes('VISITEUR RECRUTEUR'), 'consignes fixes sans candidature');
  assert.ok(contexte.content.startsWith("VISITEUR RECRUTEUR : le visiteur est un recruteur de l'entreprise Orange pour le poste « Développeur React »"));
  assert.ok(contexte.content.includes(CANDIDATURE.lettre));

  const lus = lectures.length;
  for (const extra of [{}, { jeton: 'zzzzzzzzzz' }, { jeton: 'PAS-UN-JETON' }]) {
    const res = await envoyer(extra);
    assert.equal(res.status, 200);
    assert.equal(appelsOpenAI.at(-1).input[0].content, fixe.content, 'préfixe identique pour le cache');
    assert.ok(!appelsOpenAI.at(-1).input[1].content.includes('VISITEUR RECRUTEUR'), JSON.stringify(extra));
  }
  // Seul le jeton bien formé et inconnu interroge la base
  assert.equal(lectures.length, lus + 1);
});
