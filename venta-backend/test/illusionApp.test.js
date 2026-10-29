/**
 * Tests hors ligne du relais des pages d'Illusion : session et compte, en-têtes filtrés, corps brut, réponse en flux, plafond, pannes et limite propre
 */
import { base, visiteur, fermer, SECRET } from './simulation.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import http from 'http';
import { once } from 'node:events';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { ERROR_MESSAGES } from '../src/messages.js';

const SECRET_ILLUSION = 'secret-illusion-de-test';
const MO = 1024 * 1024;
const FICHIER = crypto.randomBytes(3 * MO);

// Faux serveur d'Illusion : il garde chaque requête reçue et répond selon le chemin
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
    if (req.url.startsWith('/api/page')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<script>alert(1)</script>');
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
base.users.push({ id: 'cillusion01', name: 'Essai', nameNormalized: 'essai', email: 'essai@exemple.test', visitCount: 1, conversations: [] });
base.sessions.push({ _id: crypto.createHash('sha256').update(SESSION).digest('hex'), utilisateur: 'cillusion01',
  creeLe: new Date(), vuLe: new Date(), expireLe: new Date(Date.now() + 3600 * 1000) });

// Requête comme Next la relaie ; un tableau part morceau par morceau, sans longueur annoncée
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
  // Sans CSP d'Illusion, une page active ne s'exécute pas sur le domaine du site
  assert.equal((await envoyer('/api/illusion/app/page')).headers['content-security-policy'], "sandbox; default-src 'none'");
  assert.equal((await envoyer('/api/illusion/app/candidatures')).headers['content-security-policy'], undefined);
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
