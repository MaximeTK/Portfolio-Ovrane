/**
 * Relais des pages d'Illusion intégrées au site : le compte de la session, le corps brut et la réponse en flux, vers le serveur d'Illusion
 */
import http from 'http';
import https from 'https';
import { pipeline } from 'stream';
import { User } from '../models/User.js';
import { config } from '../config.js';
import { limite, requireService, requireSession, sendError } from '../http.js';
import { ERROR_MESSAGES } from '../messages.js';
import * as log from '../log.js';

// Un fichier de 15 Mo, plafond d'Illusion, pèse 20 Mo en base64, plus son enveloppe JSON
const TAILLE_MAX = 21 * 1024 * 1024;
// Seuls ces en-têtes d'Illusion reviennent au navigateur, ni ses cookies ni rien d'autre ; sa CSP isole le HTML d'un mail reçu
const RENDUS = ['content-type', 'content-disposition', 'content-length', 'content-security-policy'];
// Servi sur le domaine du site, un document actif sans CSP d'Illusion y exécuterait ses scripts
const ACTIF = /^\s*(text\/html|image\/svg\+xml|application\/xhtml\+xml|text\/xml|application\/xml)/i;
// Jamais relayés : la connexion et l'inscription d'Illusion (Ovrane a les siennes, limitées), et le canal du logiciel de bureau
const INTERDITS = [/^POST \/api\/session\/?$/, /^[A-Z]+ \/api\/inscription\/?$/, /^[A-Z]+ \/api\/mains\/(tour|ordre)\/?$/];
// Le chemin comme Illusion le route : %2F y redevient « / » ; un encodage malformé reste tel quel, comme chez lui
const decode = (chemin) => {
  try {
    return decodeURIComponent(chemin);
  } catch {
    return chemin;
  }
};
// Illusion injoignable plutôt qu'en erreur : 503, comme un service à l'arrêt
const INJOIGNABLE = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT']);

// L'e-mail du compte de la session, prouvé par son lien : Illusion connaît ses comptes par leur adresse
async function compte(req, res, next) {
  try {
    const user = await User.findOne({ id: req.user.id }, { _id: 0, email: 1, emailVerifieLe: 1 }).lean();
    if (!user?.email) return sendError(res, 401, ERROR_MESSAGES.illusionAccountRequired);
    if (!user.emailVerifieLe) return sendError(res, 403, ERROR_MESSAGES.illusionEmailNonVerifie);
    req.user.email = user.email;
    next();
  } catch (error) {
    next(error);
  }
}

function relayer(req, res) {
  if (!config.illusion.secret) return sendError(res, 503, ERROR_MESSAGES.illusionUnavailable);
  // L'URL résout les `..` : rien ne sort de l'API d'Illusion
  const cible = new URL(`/api${req.url}`, config.illusion.url);
  if (!cible.pathname.startsWith('/api/')) return sendError(res, 404, ERROR_MESSAGES.notFound);
  if (INTERDITS.some((motif) => motif.test(`${req.method} ${decode(cible.pathname)}`))) return sendError(res, 404, ERROR_MESSAGES.notFound);
  if (Number(req.get('content-length')) > TAILLE_MAX) return sendError(res, 413, ERROR_MESSAGES.illusionTooLarge);

  // Liste blanche : ni cookie, ni Origin, ni Sec-Fetch-*, ni session, ni en-tête du relais venu du client
  const amont = (cible.protocol === 'https:' ? https : http).request(cible, {
    method: req.method,
    headers: {
      ...(req.get('content-type') ? { 'Content-Type': req.get('content-type') } : {}),
      ...(req.get('content-length') ? { 'Content-Length': req.get('content-length') } : {}),
      'X-Ovrane-Service': config.illusion.secret,
      'X-Ovrane-Utilisateur': req.user.email,
    },
    timeout: config.illusion.delai,
  });

  amont.on('timeout', () => amont.destroy(Object.assign(new Error('délai dépassé'), { code: 'ETIMEDOUT' })));
  amont.on('error', (error) => {
    // Réponse déjà partie (413, flux entamé) : seul un flux entamé se coupe
    if (res.headersSent || res.destroyed) {
      if (!res.writableEnded) res.destroy();
      return;
    }
    log.error(`[ILLUSION] ${req.method} ${cible.pathname} :`, error.code || error.message);
    if (INJOIGNABLE.has(error.code)) sendError(res, 503, ERROR_MESSAGES.illusionUnavailable);
    else sendError(res, 502, ERROR_MESSAGES.illusionBadGateway);
  });
  amont.on('response', (reponse) => {
    if (res.headersSent) return reponse.resume();
    res.status(reponse.statusCode);
    for (const nom of RENDUS) if (reponse.headers[nom]) res.setHeader(nom, reponse.headers[nom]);
    if (ACTIF.test(reponse.headers['content-type'] || '') && !reponse.headers['content-security-policy']) {
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    }
    res.setHeader('Cache-Control', 'no-store');
    pipeline(reponse, res, () => {});
  });
  // Le navigateur parti, Illusion n'a plus à répondre
  res.on('close', () => {
    if (!res.writableFinished) amont.destroy();
  });

  // Corps sans longueur annoncée : compté au fil de l'eau, coupé au-delà du plafond, le reste lu pour rien
  let recus = 0;
  req.on('data', (morceau) => {
    recus += morceau.length;
    if (recus <= TAILLE_MAX || res.headersSent) return;
    req.unpipe(amont);
    req.resume();
    amont.destroy();
    sendError(res, 413, ERROR_MESSAGES.illusionTooLarge);
  });
  req.pipe(amont);
}

export function setupIllusionAppRoutes(app) {
  // Sa propre limite par IP, hors de la limite globale : une page interroge Illusion toutes les 1,5 à 5 s, plusieurs fenêtres à la fois
  app.use('/api/illusion/app', limite(15 * 60 * 1000, config.production ? 6000 : 60000), requireService, requireSession, compte, relayer);
}
