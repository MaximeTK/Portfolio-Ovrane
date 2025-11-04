/**
 * Construction des paramètres API OpenAI Chat Completions (GPT-4o-mini)
 */
import { OPENAI_4O_CONFIG, CONSOLE_LOGS, EMOJIS } from '../messages.js';

/**
 * Convertit les tools du format GPT-5 au format Chat Completions
 * GPT-5 format: { type: "function", name: "...", description: "...", parameters: {...} }
 * Chat Completions format: { type: "function", function: { name: "...", description: "...", parameters: {...} } }
 */
function convertToolsToChatFormat(tools) {
  if (!tools || tools.length === 0) return [];
  
  return tools.map(tool => {
    // Si le tool est déjà au bon format (a une propriété 'function')
    if (tool.function) {
      return tool;
    }
    
    // Sinon, convertir du format GPT-5 au format Chat Completions
    const { type, name, description, parameters } = tool;
    return {
      type: type || "function",
      function: {
        name,
        description,
        parameters
      }
    };
  });
}

/**
 * Crée les paramètres de base pour l'API Chat Completions
 */
function buildBaseParams(messages) {
  return {
    model: OPENAI_4O_CONFIG.model,
    messages: messages,
    temperature: OPENAI_4O_CONFIG.temperature,
    max_tokens: OPENAI_4O_CONFIG.maxTokens,
  };
}

/**
 * Ajoute les tools aux paramètres si disponibles
 */
function addToolsToParams(apiParams, tools) {
  if (tools && tools.length > 0) {
    // Convertir les tools au format Chat Completions
    apiParams.tools = convertToolsToChatFormat(tools);
    apiParams.tool_choice = OPENAI_4O_CONFIG.toolChoice;
  }
}

/**
 * Affiche les paramètres en debug
 */
function logParamsDebug(apiParams, messages, functionCallCount, messagesLength) {
  if (functionCallCount === 0 && messagesLength === 2) {
    const debugInfo = {
      model: apiParams.model,
      messages_count: messages.length,
      tools_count: apiParams.tools?.length || 0,
      temperature: apiParams.temperature
    };
    
    // Afficher un exemple de tool converti pour debug
    if (apiParams.tools && apiParams.tools.length > 0) {
      debugInfo.tool_format_example = {
        type: apiParams.tools[0].type,
        has_function_property: !!apiParams.tools[0].function
      };
    }
    
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Paramètres envoyés (GPT-4o-mini):`, JSON.stringify(debugInfo, null, 2));
  }
}

/**
 * Construit les paramètres pour l'API Chat Completions
 */
export function buildAPIParams(messages, tools, functionCallCount, messagesLength) {
  const apiParams = buildBaseParams(messages);
  addToolsToParams(apiParams, tools);
  logParamsDebug(apiParams, messages, functionCallCount, messagesLength);
  
  return apiParams;
}

