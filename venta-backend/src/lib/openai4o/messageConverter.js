/**
 * Conversion des messages au format OpenAI Chat Completions (GPT-4o)
 */

export function convertMessagesToChatFormat(messages) {
  return messages.map(msg => {
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        content: msg.content,
        tool_call_id: msg.tool_call_id
      };
    }

    if (msg.role === 'assistant' && msg.tool_calls) {
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


