/**
 * Route principale du chat
 */
import { processUserInfo } from '../lib/chat/userProcessor.js';
import { generateResponse } from '../lib/chat/responseGenerator.js';
import { processResponse } from '../lib/chat/responseProcessor.js';
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
      const { prompt, currentUserId } = req.body;
      
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
      const result = await processResponse(response, userId, userProfile, prompt);
      
      res.json(result);
      
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} ERREUR:`, error);
      res.status(500).json({ error: ERROR_MESSAGES.internalServerError, details: error.message });
    }
  });
}
