/**
 * Traitement et parsing des réponses OpenAI Chat Completions (GPT-4o-mini)
 */
import { CONSOLE_LOGS, EMOJIS } from '../messages.js';

/**
 * Parse la réponse OpenAI Chat Completions
 */
export function parseOpenAIResponse(response) {
  const choice = response.choices?.[0];
  
  if (!choice) {
    console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.backend} Aucun choice dans la réponse`);
    return { content: null, tool_calls: null };
  }
  
  const message = choice.message;
  
  console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Réponse GPT-4o-mini - Role: ${message.role}, Has content: ${!!message.content}, Has tool_calls: ${!!message.tool_calls}`);
  
  return {
    content: message.content || null,
    tool_calls: message.tool_calls || null
  };
}

