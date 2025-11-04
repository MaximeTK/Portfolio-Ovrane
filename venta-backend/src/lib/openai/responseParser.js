/**
 * Traitement et parsing des réponses OpenAI
 */
import { CONSOLE_LOGS, EMOJIS } from '../messages.js';

/**
 * Extrait le contenu texte de la réponse
 */
function extractTextContent(output) {
  const textOutput = output.find(o => o.type === 'text');
  if (textOutput) {
    const rawContent = textOutput.content || textOutput.text || null;
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} textOutput trouvé, rawContent type:`, typeof rawContent);
    if (rawContent) {
      return typeof rawContent === 'string' ? rawContent : String(rawContent);
    }
  }
  return null;
}

/**
 * Extrait les function calls et les convertit en tool_calls
 */
function extractToolCalls(output) {
  const functionCalls = output.filter(o => o.type === 'function_call');
  if (functionCalls.length > 0) {
    return functionCalls.map(fc => ({
      id: fc.call_id,
      type: 'function',
      function: { name: fc.name, arguments: fc.arguments }
    }));
  }
  return null;
}

/**
 * Parse la réponse OpenAI
 */
export function parseOpenAIResponse(response) {
  const outputTypes = response.output?.map(o => o.type).join(', ') || 'none';
  console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Réponse OpenAI - Types: [${outputTypes}], output_text: "${response.output_text || ''}"`);
  
  let content = null;
  let toolCalls = null;
  
  if (response.output && Array.isArray(response.output)) {
    content = extractTextContent(response.output);
    toolCalls = extractToolCalls(response.output);
  }
  
  // Fallback: utiliser output_text si présent et non vide
  if (!content && response.output_text) {
    const rawOutputText = typeof response.output_text === 'string' 
      ? response.output_text 
      : String(response.output_text);
    if (rawOutputText.trim() !== '') {
      content = rawOutputText;
    }
  }
  
  // Fallback pour les anciens formats de tool_calls
  if (!toolCalls && response.tool_calls) {
    toolCalls = response.tool_calls;
  }
  
  return { content: content, tool_calls: toolCalls };
}

