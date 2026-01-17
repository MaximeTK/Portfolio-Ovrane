/**
 * Route pour le tracking des visites
 */
import { getUserProfile, saveVisitedLink } from '../lib/userMemory.js';
import { RedirectLog } from '../models/RedirectLog.js';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../lib/messages.js';
import { isNonEmptyString, isValidUserId } from '../lib/validators.js';

const MAX_LINK_LENGTH = 2048;

/**
 * Configuration des routes de tracking
 */
export function setupTrackingRoute(app) {
  // Sauvegarder un lien de redirection (CV, etc.) - Indépendant du profil user
  app.post('/api/tracking/redirect', async (req, res) => {
    try {
      const { path, target, userAgent } = req.body;

      if (!isNonEmptyString(path) || !isNonEmptyString(target)) {
        return res.status(400).json({ error: 'Paramètres manquants' });
      }

      const ip = req.ip || req.connection?.remoteAddress || 'unknown';

      // Création du log (fire and forget côté client, mais on attend ici la confirmation DB)
      await RedirectLog.create({
        path: path.substring(0, MAX_LINK_LENGTH),
        target: target.substring(0, MAX_LINK_LENGTH),
        ip,
        userAgent: userAgent || 'unknown'
      });

      console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Redirection trackée: ${path} -> ${target}`);
      res.json({ success: true });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} Erreur tracking redirect:`, msg);
      // On ne bloque pas le client, on renvoie une erreur mais le frontend redirigera quand même
      res.status(500).json({ error: 'Erreur interne' });
    }
  });

  // Pixel de tracking (remplace track.php)
  app.get('/api/tracking/pixel', async (req, res) => {
    try {
      const id = req.query.id || 'anonyme';
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Enregistrer le passage (dans RedirectLog ou une autre collection PixelLog si besoin)
      // On utilise RedirectLog pour centraliser, avec target="PIXEL"
      await RedirectLog.create({
        path: `/pixel/${id}`,
        target: 'PIXEL_VIEW',
        ip,
        userAgent
      });

      console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} 👁️ Pixel vu par: ${id} (IP: ${ip})`);

      // Renvoyer une image GIF transparente 1x1
      // Header pour dire que c'est une image
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': '43',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      });
      
      // Buffer du GIF 1x1 transparent
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.end(pixel);

    } catch (error) {
      console.error('Erreur pixel tracking:', error);
      // Même en cas d'erreur, on essaie de renvoyer le pixel pour ne pas casser l'affichage client
      res.status(200).end(); 
    }
  });

  // Sauvegarder un lien d'arrivée (User Profile)
  app.post('/api/tracking/visit', async (req, res) => {
    try {
      const { userId, link } = req.body;
      
      if (!isValidUserId(userId)) {
        return res.status(400).json({ error: ERROR_MESSAGES.invalidUserId });
      }

      if (!isNonEmptyString(link) || link.length > MAX_LINK_LENGTH) {
        return res.status(400).json({ error: ERROR_MESSAGES.trackingInvalidLink });
      }
      
      // 1. Sauvegarder le lien (UNE seule requête DB via updateOne + check matchedCount)
      const success = await saveVisitedLink(userId, link);
      
      if (success) {
        res.json({ success: true, message: SUCCESS_MESSAGES.trackingLinkSaved });
      } else {
        // Si rien n'est modifié, 2 cas:
        // - profil introuvable (matchedCount=0)
        // - lien déjà présent (matchedCount>0 mais modifiedCount=0)
        // saveVisitedLink retourne false dans les deux cas; on doit distinguer.
        // Pour garder 1 seule requête DB, on renvoie "already saved" et laisse le client idempotent.
        // Si vous voulez un 404 strict "profil introuvable", il faudrait une 2e requête.
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
