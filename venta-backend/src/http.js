/** Erreurs, secret de service, session et limites de débit des routes */
import crypto from 'crypto';
import net from 'net';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { lireSession } from './services/sessions.js';
import { ERROR_MESSAGES } from './messages.js';
import * as log from './log.js';

export function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

// Comparaison en temps constant : les empreintes ont toujours la même longueur
export function egal(recu, attendu) {
  const empreinte = (valeur) => crypto.createHash('sha256').update(String(valeur)).digest();
  return crypto.timingSafeEqual(empreinte(recu), empreinte(attendu));
}

// Signature sous une clé dérivée du secret de service, une clé par usage
export const signataire = (usage) => (charge) => {
  const cle = crypto.createHmac('sha256', config.serviceSecret).update(`ovrane:${usage}`).digest();
  return crypto.createHmac('sha256', cle).update(charge).digest('base64url');
};

const serviceValide = (req) => Boolean(config.serviceSecret) && egal(req.get('x-ovrane-service') ?? '', config.serviceSecret);

// IP relayée par Next, crue seulement avec le secret de service
export function ipClient(req) {
  const relayee = serviceValide(req) && req.get('x-ovrane-client-ip');
  return net.isIP(relayee || '') ? relayee : req.ip;
}

// Un IPv6 dispose d'un /64 : les limites comptent ce préfixe
function clePourLimite(req) {
  const ip = ipClient(req) || '';
  if (!net.isIPv6(ip) || ip.includes('.')) return ip;
  const [avant, apres] = ip.split('::');
  const debut = avant ? avant.split(':') : [];
  const fin = apres ? apres.split(':') : [];
  const groupes = apres === undefined ? debut : [...debut, ...Array(8 - debut.length - fin.length).fill('0'), ...fin];
  return `${groupes.slice(0, 4).map((groupe) => parseInt(groupe || '0', 16).toString(16)).join(':')}::/64`;
}

// Seul Next appelle le backend
export function requireService(req, res, next) {
  if (serviceValide(req)) return next();
  sendError(res, 401, ERROR_MESSAGES.serviceUnauthorized);
}

export async function requireSession(req, res, next) {
  try {
    const session = await lireSession(req.get('x-ovrane-session'));
    if (!session) return sendError(res, 401, ERROR_MESSAGES.sessionRequired);
    req.user = { id: session.utilisateur };
    next();
  } catch (error) {
    next(error);
  }
}

export function limite(windowMs, limit, keyGenerator = clePourLimite, options = {}) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: ERROR_MESSAGES.tooManyRequests },
    ...options,
  });
}

// Erreur finale journalisée ici, jamais détaillée au client
export function sendInternalError(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.expose && err.status < 500) return sendError(res, err.status, ERROR_MESSAGES.badRequest);
  log.error(`[HTTP] ${req.method} ${req.path} :`, err.message);
  sendError(res, 500, ERROR_MESSAGES.internalServerError);
}
