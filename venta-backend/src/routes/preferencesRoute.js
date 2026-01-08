/**
 * Route pour gérer les préférences utilisateur
 */
import { getUserProfile, saveUserPreference } from '../lib/userMemory.js';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../lib/messages.js';
import { isNonEmptyString, isValidUserId } from '../lib/validators.js';

const ALLOWED_PREFERENCES = new Set(['backgroundColor']);

/**
 * Configuration des routes de préférences
 */
export function setupPreferencesRoute(app) {
  // Sauvegarder une préférence
  app.post('/api/preferences', async (req, res) => {
    try {
      const { currentUserId, preference, value } = req.body;
      
      if (!isValidUserId(currentUserId)) {
        return res.status(400).json({ error: ERROR_MESSAGES.invalidUserId });
      }

      if (!isNonEmptyString(preference) || !ALLOWED_PREFERENCES.has(preference)) {
        return res.status(400).json({ error: ERROR_MESSAGES.badRequest });
      }

      if (value === undefined) {
        return res.status(400).json({ error: ERROR_MESSAGES.preferencesMissingParams });
      }
      
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      
      const userProfile = await getUserProfile(currentUserId, ip);
      
      if (!userProfile) {
        return res.status(404).json({ error: ERROR_MESSAGES.preferencesUserNotFound });
      }
      
      const success = await saveUserPreference(currentUserId, preference, value);
      
      if (success) {
        console.log(`${EMOJIS.success} ${CONSOLE_LOGS.backend} Préférence "${preference}" sauvegardée pour ${userProfile.name || currentUserId}`);
        res.json({ success: true, message: SUCCESS_MESSAGES.preferencesSaved });
      } else {
        res.status(500).json({ error: ERROR_MESSAGES.preferencesSaveError });
      }
      
    } catch (error) {
      const isProd = process.env.NODE_ENV === 'production';
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} Erreur sauvegarde préférence:`, msg);
      res.status(500).json({
        error: ERROR_MESSAGES.internalServerError,
        ...(isProd ? {} : { details: msg }),
      });
    }
  });
  
  // Charger les préférences
  app.get('/api/preferences/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!isValidUserId(userId)) {
        return res.status(400).json({ error: ERROR_MESSAGES.preferencesUserIdMissing });
      }
      
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      const userProfile = await getUserProfile(userId, ip);
      
      if (!userProfile) {
        return res.status(404).json({ error: ERROR_MESSAGES.preferencesUserNotFound });
      }
      
      res.json({ 
        success: true, 
        preferences: userProfile.preferences || {} 
      });
      
    } catch (error) {
      const isProd = process.env.NODE_ENV === 'production';
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} Erreur chargement préférences:`, msg);
      res.status(500).json({
        error: ERROR_MESSAGES.internalServerError,
        ...(isProd ? {} : { details: msg }),
      });
    }
  });
}

