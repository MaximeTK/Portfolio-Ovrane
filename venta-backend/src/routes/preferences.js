/**
 * Préférences de l'utilisateur de la session
 */
import { User } from '../models/User.js';
import { saveUserPreference } from '../services/utilisateurs.js';
import { sendError, requireSession } from '../http.js';
import { paletteConnue } from '../services/chat/outils.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../messages.js';

// Chaque préférence n'admet que les valeurs de son catalogue : le fond revient au modèle comme FOND ACTUEL
const PREFERENCES = new Map([['backgroundColor', paletteConnue]]);

export function setupPreferencesRoutes(app) {
  // Lecture seule : ni visite comptée ni IP écrite
  app.get('/api/preferences', requireSession, async (req, res, next) => {
    try {
      const user = await User.findOne({ id: req.user.id }, { _id: 0, preferences: 1 }).lean();
      if (!user) return sendError(res, 404, ERROR_MESSAGES.userNotFound);
      res.json({ success: true, preferences: user.preferences || {} });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/preferences', requireSession, async (req, res, next) => {
    try {
      const { preference, value } = req.body || {};
      const valeur = typeof preference === 'string' && PREFERENCES.has(preference) ? PREFERENCES.get(preference)(value) : null;
      if (!valeur) return sendError(res, 400, ERROR_MESSAGES.badRequest);
      if (!await saveUserPreference(req.user.id, preference, valeur)) return sendError(res, 404, ERROR_MESSAGES.userNotFound);
      res.json({ success: true, message: SUCCESS_MESSAGES.preferencesSaved });
    } catch (error) {
      next(error);
    }
  });
}
