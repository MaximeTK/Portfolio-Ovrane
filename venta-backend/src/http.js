/**
 * Réponses d'erreur, secret de service, session et limites de débit communs aux routes
 */
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

const serviceValide = (req) => Boolean(config.serviceSecret) && egal(req.get('x-ovrane-service') ?? '', config.serviceSecret);

// IP du visiteur relayée par Next, crue seulement avec le secret de service et si c'est bien une IP
export function ipClient(req) {
  const relayee = serviceValide(req) && req.get('x-ovrane-client-ip');
  return net.isIP(relayee || '') ? relayee : req.ip;
}

// Une machine IPv6 dispose de tout un /64 : les limites comptent ce préfixe, pas l'adresse
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

// Erreur finale : journalisée ici, jamais détaillée au client (JSON invalide compris)
export function sendInternalError(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.expose && err.status < 500) return sendError(res, err.status, ERROR_MESSAGES.badRequest);
  log.error(`[HTTP] ${req.method} ${req.path} :`, err.message);
  sendError(res, 500, ERROR_MESSAGES.internalServerError);
}
