/**
 * Conversion des messages au format OpenAI Chat Completions (GPT-4o-mini)
 */

/**
 * Convertit les messages au format standard Chat Completions
 * Pour GPT-4o-mini, on utilise directement le format messages standard
 */
export function convertMessagesToChatFormat(messages) {
  return messages.map(msg => {
    // Les messages sont déjà au bon format pour Chat Completions
    // On s'assure juste qu'ils ont les bonnes propriétés
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        content: msg.content,
        tool_call_id: msg.tool_call_id
      };
    }
    
    if (msg.role === 'assistant' && msg.tool_calls) {
      // Pour Chat Completions, content doit être null (pas undefined ni chaîne vide) lors d'un tool_call
      return {
        role: 'assistant',
        content: msg.content === undefined ? null : msg.content,
        tool_calls: msg.tool_calls
      };
    }
    
    return {
      role: msg.role,
      content: msg.content || ''
    };
  });
}

