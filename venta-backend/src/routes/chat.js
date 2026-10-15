/**
 * Chat et historique de l'utilisateur de la session
 */
import { IllusionCandidature } from '../models/IllusionCandidature.js';
import { getUserProfile, historique, profilPublic, MAX_MESSAGES } from '../services/utilisateurs.js';
import { generateResponse } from '../services/chat/generer.js';
import { processResponse } from '../services/chat/reponse.js';
import { sendError, requireSession, ipClient, limite } from '../http.js';
import { ERROR_MESSAGES } from '../messages.js';
import { isNonEmptyString, isValidJeton } from '../validators.js';
import * as log from '../log.js';

const MAX_PROMPT = 4000;

// Candidature Illusion du recruteur venu par un lien suivi ; une erreur ne bloque jamais le chat
async function loadCandidature(jeton) {
  if (!isValidJeton(jeton)) return null;
  try {
    return await IllusionCandidature.findOne({ jeton }).lean();
  } catch (error) {
    log.warn(`[CHAT] Candidature Illusion illisible (${jeton}) :`, error.message);
    return null;
  }
}

export function setupChatRoutes(app, openai) {
  // Par session, comptée sur son utilisateur
  const parSession = limite(60 * 1000, 10, (req) => req.user.id);

  app.post('/api/chat', requireSession, parSession, async (req, res, next) => {
    try {
      const { prompt, isEphemeral, jeton } = req.body || {};
      if (!isNonEmptyString(prompt)) return sendError(res, 400, ERROR_MESSAGES.promptRequired);
      if (prompt.length > MAX_PROMPT) return sendError(res, 413, ERROR_MESSAGES.promptTooLong);

      // Le message compte avant l'appel au modèle, éphémère ou non
      const user = await getUserProfile(req.user.id, ipClient(req));
      if (!user) return sendError(res, 401, ERROR_MESSAGES.sessionRequired);
      if (user.messageCount > MAX_MESSAGES) {
        return res.json({
          reply: ERROR_MESSAGES.limitReached,
          commands: [{ command: 'LockInterface', parameter: 'limit_reached' }],
          userProfile: profilPublic(user),
          activeUserId: user.id,
          tts: { isStaticFile: true, staticUrl: '/endmessage.mp3' },
        });
      }

      const ctx = { uiCommands: [] };
      const texte = await generateResponse(openai, prompt, user, await loadCandidature(jeton), ctx);
      res.json(await processResponse(texte, prompt, user, ctx, isEphemeral === true));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/chat/history', requireSession, async (req, res, next) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
      const skip = Math.min(1000, Math.max(0, parseInt(String(req.query.skip), 10) || 0));
      res.json({ history: await historique(req.user.id, limit, skip) });
    } catch (error) {
      next(error);
    }
  });
}
