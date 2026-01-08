/**
 * Route principale du chat
 */
import { processUserInfo } from '../lib/chat/userProcessor.js';
import { generateResponse } from '../lib/chat/responseGenerator.js';
import { processResponse } from '../lib/chat/responseProcessor.js';
import { getRawConversationHistory } from '../lib/userMemory.js';
import { ERROR_MESSAGES, CONSOLE_LOGS, EMOJIS } from '../lib/messages.js';
import {
  isNonEmptyString,
  isValidUserId,
} from '../lib/validators.js';

/**
 * Valide le prompt de la requête
 */
function validatePrompt(prompt) {
  return isNonEmptyString(prompt);
}

/**
 * Valide la clé API OpenAI
 */
function validateAPIKey() {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Configuration de la route chat
 */
export function setupChatRoute(app, openai, ragInitialized) {
  app.post('/api/chat', async (req, res) => {
    try {
      const { prompt, currentUserId, isEphemeral } = req.body;
      
      if (!validatePrompt(prompt)) {
        console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} ${ERROR_MESSAGES.promptInvalid}`);
        return res.status(400).json({ error: ERROR_MESSAGES.promptRequired });
      }

      const MAX_PROMPT_LENGTH = 4000;
      if (String(prompt).length > MAX_PROMPT_LENGTH) {
        return res.status(413).json({ error: ERROR_MESSAGES.promptTooLong });
      }

      if (currentUserId !== undefined && currentUserId !== null && !isValidUserId(currentUserId)) {
        return res.status(400).json({ error: ERROR_MESSAGES.invalidUserId });
      }
      
      if (!validateAPIKey()) {
        console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} ${ERROR_MESSAGES.openaiKeyMissing}!`);
        return res.status(500).json({ error: ERROR_MESSAGES.openaiKeyMissing });
      }
      
      const safeEphemeral = typeof isEphemeral === 'boolean' ? isEphemeral : false;
      let { userId, userProfile } = await processUserInfo(req, currentUserId);
      
      // Vérification de la limite de messages pour protéger l'API Key
      const MAX_MESSAGES_PER_PROFILE = 50;
      if ((userProfile.messageCount || 0) >= MAX_MESSAGES_PER_PROFILE) {
        console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.backend} Limite atteinte pour ${userProfile.name || userId}`);
        return res.json({
          reply: ERROR_MESSAGES.limitReached,
          commands: [{ command: 'LockInterface', parameter: 'limit_reached' }],
          rawResponse: ERROR_MESSAGES.limitReached,
          userProfile: {
            name: userProfile.name,
            visitCount: userProfile.visitCount,
            isNewUser: userProfile.visitCount === 1,
            isTemporary: userProfile.isTemporary,
            messageCount: userProfile.messageCount
          },
          activeUserId: userId,
          rag: { coverage: [], sources: [], enabled: false },
          tts: { 
            isStaticFile: true,
            staticUrl: '/endmessage.mp3'
          }
        });
      }

      const response = await generateResponse(openai, prompt, userId, userProfile, ragInitialized);
      const result = await processResponse(response, userId, userProfile, prompt, safeEphemeral);
      
      res.json(result);
      
    } catch (error) {
      const isProd = process.env.NODE_ENV === 'production';
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} ${ERROR_MESSAGES.internalServerError}:`, msg);
      res.status(500).json({
        error: ERROR_MESSAGES.internalServerError,
        ...(isProd ? {} : { details: msg }),
      });
    }
  });

  /**
   * Route pour récupérer l'historique des conversations
   */
  app.get('/api/chat/history', async (req, res) => {
    try {
      const { userId, limit = 50, skip = 0 } = req.query;
      
      if (!isValidUserId(userId)) {
        return res.status(400).json({ error: ERROR_MESSAGES.historyUserIdRequired });
      }

      const limitInt = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
      const skipInt = Math.max(0, parseInt(String(skip), 10) || 0);

      // On récupère TOUT l'historique brut (limit large) pour faire la pagination
      // sur les messages individuels et non sur les objets conversations groupés.
      // Cela évite le décalage quand une conversation contient 2 messages (prompt + response).
      const history = await getRawConversationHistory(String(userId), 1000, 0);
      
      // Formater pour le frontend (tableau de messages plat)
      const allMessages = [];
      
      history.forEach(conv => {
        // Priorité à la structure prompt/response (paires)
        if (conv.prompt) {
          allMessages.push({ role: 'user', content: conv.prompt, timestamp: conv.timestamp });
        }
        if (conv.response) {
          // On inclut les commandes pour permettre au frontend de reconstruire l'affichage (images, etc.)
          // si elles n'ont pas été "buit-in" dans le texte lors de la sauvegarde.
          allMessages.push({ 
            role: 'assistant', 
            content: conv.response,
            timestamp: conv.timestamp,
            commands: conv.commands 
          });
        }
        // Fallback pour structure différente (message unique)
        if (!conv.prompt && !conv.response && conv.role && conv.content) {
          allMessages.push({ 
            role: conv.role, 
            content: conv.content, 
            timestamp: conv.timestamp,
            commands: conv.commands
          });
        }
      });
      
      // Appliquer la pagination sur le tableau de messages PLAT
      // Logique : on veut les messages les plus récents moins ceux déjà chargés (skip)
      const total = allMessages.length;
      const start = Math.max(0, total - skipInt - limitInt);
      const end = Math.max(0, total - skipInt);
      
      const pagedMessages = allMessages.slice(start, end);
      
      res.json({ history: pagedMessages });
      
    } catch (error) {
      const isProd = process.env.NODE_ENV === 'production';
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} Erreur récupération historique:`, msg);
      res.status(500).json({
        error: ERROR_MESSAGES.internalServerError,
        ...(isProd ? {} : { details: msg }),
      });
    }
  });
}
