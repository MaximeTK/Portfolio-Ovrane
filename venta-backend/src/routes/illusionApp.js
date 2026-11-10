/** Relais des pages d'Illusion : compte de session, corps brut, flux */
import http from 'http';
import https from 'https';
import { pipeline } from 'stream';
import { config } from '../config.js';
import { limite, requireService, sendError } from '../http.js';
import { compteDeSession } from '../services/sessions.js';
import { ERROR_MESSAGES } from '../messages.js';
import * as log from '../log.js';

// 15 Mo (plafond d'Illusion) pèsent 20 Mo en base64, plus l'enveloppe JSON
const TAILLE_MAX = 21 * 1024 * 1024;
// Seuls ces en-têtes reviennent au navigateur ; la CSP isole le HTML d'un mail
const RENDUS = ['content-type', 'content-disposition', 'content-length', 'content-security-policy'];
// Sur le domaine du site, un document actif sans CSP exécuterait ses scripts
const ACTIF = /^\s*(text\/html|text\/xsl|text\/xml|application\/xml|[a-z-]+\/[a-z0-9.-]*\+xml)\s*(;|$)/i;
// Jamais relayés : connexion et inscription d'Illusion, canal du logiciel
const INTERDITS = [/^POST \/api\/session\/*$/, /^[A-Z]+ \/api\/inscription\/*$/, /^[A-Z]+ \/api\/mains\/(tour|ordre)\/*$/];
// Chemin routé comme Illusion : %2F redevient « / », encodage malformé gardé
const decode = (chemin) => {
  try {
    return decodeURIComponent(chemin);
  } catch {
    return chemin;
  }
};
// Illusion injoignable plutôt qu'en erreur : 503, comme un service à l'arrêt
const INJOIGNABLE = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT']);

// E-mail du compte de session, prouvé par son lien : Illusion les connaît ainsi
async function compte(req, res, next) {
  try {
    const { session, user } = await compteDeSession(req.get('x-ovrane-session'));
    if (!session) return sendError(res, 401, ERROR_MESSAGES.sessionRequired);
    if (!user?.email) return sendError(res, 401, ERROR_MESSAGES.illusionAccountRequired);
    if (!user.emailVerifieLe) return sendError(res, 403, ERROR_MESSAGES.illusionEmailNonVerifie);
    // Compte du serveur (en production, tout compte s'il n'est pas déclaré)
    const exige = config.illusion.compteServeur ? user.email === config.illusion.compteServeur : config.production;
    if (exige && !user.deuxiemeFacteur?.activeLe) return sendError(res, 403, ERROR_MESSAGES.illusionDeuxiemeFacteur);
    req.user = { id: session.utilisateur, email: user.email };
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
  const chemin = decode(cible.pathname);
  // Ni « // » brut, ni segment « . » ou « .. » une fois décodé
  if (cible.pathname.includes('//') || /(^|\/)\.\.?(\/|$)/.test(chemin)) return sendError(res, 404, ERROR_MESSAGES.notFound);
  if (INTERDITS.some((motif) => motif.test(`${req.method} ${chemin}`))) return sendError(res, 404, ERROR_MESSAGES.notFound);
  if (Number(req.get('content-length')) > TAILLE_MAX) return sendError(res, 413, ERROR_MESSAGES.illusionTooLarge);

  // Liste blanche : ni cookie, Origin, Sec-Fetch-*, session ni en-tête du client
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
    if (ACTIF.test(reponse.headers['content-type'] || '')) {
      const csp = reponse.headers['content-security-policy'];
      if (!csp) res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
      // Sans sandbox, un mail hostile s'afficherait seul sous l'URL du site
      else if (!csp.includes('sandbox') && !/^\s*attachment/i.test(reponse.headers['content-disposition'] || '')) res.setHeader('Content-Disposition', 'attachment');
    }
    res.setHeader('Cache-Control', 'no-store');
    pipeline(reponse, res, () => {});
  });
  // Le navigateur parti, Illusion n'a plus à répondre
  res.on('close', () => {
    if (!res.writableFinished) amont.destroy();
  });

  // Corps sans longueur : compté au fil de l'eau, coupé au plafond
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
  // Limite propre par IP : une page interroge Illusion toutes les 1,5 à 5 s
  const plafond = config.production ? 6000 : 60000;
  // Le même plafond par compte : plusieurs IP ne le multiplient pas
  app.use('/api/illusion/app', limite(15 * 60 * 1000, plafond), requireService, compte, limite(15 * 60 * 1000, plafond, (req) => req.user.id), relayer);
}
