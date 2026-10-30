/**
 * Suivi : redirections relayées par Next et liens d'arrivée de l'utilisateur
 */
import { RedirectLog, REDIRECT_CIBLES } from '../models/RedirectLog.js';
import { saveVisitedLink } from '../services/utilisateurs.js';
import { noterActivite } from '../services/conservation.js';
import { sendError, requireSession, ipClient, ipTronquee } from '../http.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../messages.js';
import { isNonEmptyString, isValidJeton, isRobotUserAgent } from '../validators.js';
import * as log from '../log.js';

const MAX_LIEN = 2048;

export function setupTrackingRoutes(app) {
  // Cible et jeton viennent du middleware de Next ; robot est toujours calculé ici, jamais reçu
  app.post('/api/tracking/redirect', async (req, res, next) => {
    try {
      const { path, target, userAgent, cible, jeton } = req.body || {};
      if (!isNonEmptyString(path) || !isNonEmptyString(target)) return sendError(res, 400, ERROR_MESSAGES.missingParams);
      const robot = isRobotUserAgent(userAgent);
      await RedirectLog.create({
        path: path.slice(0, MAX_LIEN),
        target: target.slice(0, MAX_LIEN),
        // Tronquée : assez pour repérer un abus, jamais de quoi désigner la machine du recruteur
        ip: ipTronquee(ipClient(req)),
        userAgent: typeof userAgent === 'string' && userAgent ? userAgent.slice(0, 512) : 'unknown',
        cible: REDIRECT_CIBLES.includes(cible) ? cible : undefined,
        jeton: isValidJeton(jeton) ? jeton : undefined,
        robot,
      });
      // Un scanner de messagerie qui suit le lien n'est pas une activité du recruteur
      if (isValidJeton(jeton) && !robot) await noterActivite(jeton);
      log.debug(`[SUIVI] Redirection : ${path} -> ${target}`);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/tracking/visit', requireSession, async (req, res, next) => {
    try {
      const { link } = req.body || {};
      if (!isNonEmptyString(link) || link.length > MAX_LIEN) return sendError(res, 400, ERROR_MESSAGES.trackingInvalidLink);
      // Lien déjà présent, liste pleine ou profil absent : le client reste idempotent
      const enregistre = await saveVisitedLink(req.user.id, link);
      res.json({ success: true, message: enregistre ? SUCCESS_MESSAGES.trackingLinkSaved : SUCCESS_MESSAGES.trackingLinkAlreadySaved });
    } catch (error) {
      next(error);
    }
  });
}
