/**
 * Conversion des messages au format OpenAI Responses API
 */

/**
 * Filtre les messages assistant avec tool_calls
 */
function shouldFilterMessage(msg) {
  return msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0;
}

/**
 * Convertit un message tool en format user
 */
function convertToolMessage(msg) {
  return {
    role: 'user',
    content: `[RÉSULTAT DE LA FONCTION ${msg.name}]\n${msg.content}`
  };
}

/**
 * Convertit un message standard
 */
function convertStandardMessage(msg) {
  return {
    role: msg.role,
    content: msg.content || ''
  };
}

/**
 * Convertit les messages au format 'input' requis par l'API Responses
 */
export function convertMessagesToInput(messages) {
  return messages
    .filter(msg => !shouldFilterMessage(msg))
    .map(msg => {
      if (msg.role === 'tool') {
        return convertToolMessage(msg);
      }
      return convertStandardMessage(msg);
    });
}

