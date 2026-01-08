/**
 * Route pour le tracking des visites
 */
import { getUserProfile, saveVisitedLink } from '../lib/userMemory.js';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../lib/messages.js';
import { isNonEmptyString, isValidUserId } from '../lib/validators.js';

const MAX_LINK_LENGTH = 2048;

/**
 * Configuration des routes de tracking
 */
export function setupTrackingRoute(app) {
  // Sauvegarder un lien d'arrivée
  app.post('/api/tracking/visit', async (req, res) => {
    try {
      const { userId, link } = req.body;
      
      if (!isValidUserId(userId)) {
        return res.status(400).json({ error: ERROR_MESSAGES.invalidUserId });
      }

      if (!isNonEmptyString(link) || link.length > MAX_LINK_LENGTH) {
        return res.status(400).json({ error: ERROR_MESSAGES.trackingInvalidLink });
      }
      
      // 1. S'assurer que l'utilisateur existe / le récupérer
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      const userProfile = await getUserProfile(userId, ip);
      
      if (!userProfile) {
        return res.status(404).json({ error: ERROR_MESSAGES.trackingUserNotFound });
      }
      
      // 2. Sauvegarder le lien
      const success = await saveVisitedLink(userId, link);
      
      if (success) {
        res.json({ success: true, message: SUCCESS_MESSAGES.trackingLinkSaved });
      } else {
        // Ce n'est pas forcément une erreur (ex: lien déjà présent), mais on renvoie OK
        res.json({ success: true, message: SUCCESS_MESSAGES.trackingLinkAlreadySaved });
      }
      
    } catch (error) {
      const isProd = process.env.NODE_ENV === 'production';
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} Erreur tracking visit:`, msg);
      res.status(500).json({
        error: ERROR_MESSAGES.internalServerError,
        ...(isProd ? {} : { details: msg }),
      });
    }
  });
}
