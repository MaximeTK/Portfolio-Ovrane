/**
 * Route principale du chat
 */
import { processUserInfo } from '../lib/chat/userProcessor.js';
import { generateResponse } from '../lib/chat/responseGenerator.js';
import { processResponse } from '../lib/chat/responseProcessor.js';
import { getRawConversationHistory } from '../lib/userMemory.js';
import { ERROR_MESSAGES, CONSOLE_LOGS, EMOJIS } from '../lib/messages.js';

/**
 * Valide le prompt de la requête
 */
function validatePrompt(prompt) {
  return prompt && typeof prompt === 'string';
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
      
      if (!validateAPIKey()) {
        console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} ${ERROR_MESSAGES.openaiKeyMissing}!`);
        return res.status(500).json({ error: ERROR_MESSAGES.openaiKeyMissing });
      }
      
      let { userId, userProfile } = await processUserInfo(req, currentUserId);
      const response = await generateResponse(openai, prompt, userId, userProfile, ragInitialized);
      const result = await processResponse(response, userId, userProfile, prompt, isEphemeral);
      
      res.json(result);
      
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} ERREUR:`, error);
      res.status(500).json({ error: ERROR_MESSAGES.internalServerError, details: error.message });
    }
  });

  /**
   * Route pour récupérer l'historique des conversations
   */
  app.get('/api/chat/history', async (req, res) => {
    try {
      const { userId, limit = 50, skip = 0 } = req.query;
      
      if (!userId) {
        return res.status(400).json({ error: 'UserId required' });
      }

      const history = await getRawConversationHistory(userId, parseInt(limit), parseInt(skip));
      
      // Formater pour le frontend (tableau de messages)
      const formattedHistory = [];
      
      history.forEach(conv => {
        if (conv.prompt) {
          formattedHistory.push({ role: 'user', content: conv.prompt, timestamp: conv.timestamp });
        }
        if (conv.response) {
          formattedHistory.push({ role: 'assistant', content: conv.response, timestamp: conv.timestamp });
        }
        // Fallback pour structure différente
        if (!conv.prompt && !conv.response && conv.role && conv.content) {
          formattedHistory.push({ role: conv.role, content: conv.content, timestamp: conv.timestamp });
        }
      });
      
      res.json({ history: formattedHistory });
      
    } catch (error) {
      console.error('❌ Erreur récupération historique:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la récupération de l\'historique' });
    }
  });
}
