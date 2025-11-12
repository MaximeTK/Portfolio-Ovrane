/**
 * Construction des paramètres API OpenAI
 */
import { OPENAI_CONFIG, CONSOLE_LOGS, EMOJIS } from '../messages.js';

/**
 * Crée les paramètres de base pour l'API
 */
function buildBaseParams(formattedInput) {
  return {
    model: OPENAI_CONFIG.model,
    input: formattedInput,
    reasoning: { effort: OPENAI_CONFIG.reasoningEffort || 'low' },
    text: { verbosity: OPENAI_CONFIG.textVerbosity || 'medium' }
  };
}

/**
 * Ajoute les tools aux paramètres si disponibles
 */
function addToolsToParams(apiParams, tools) {
  if (tools && tools.length > 0) {
    apiParams.tools = tools;
    apiParams.tool_choice = OPENAI_CONFIG.toolChoice;
  }
}

/**
 * Affiche les paramètres en debug
 */
function logParamsDebug(apiParams, formattedInput, functionCallCount, messagesLength) {
  if (functionCallCount === 0 && messagesLength === 2) {
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Paramètres envoyés:`, JSON.stringify({
      model: apiParams.model,
      input_length: formattedInput.length,
      tools_count: apiParams.tools?.length || 0
    }, null, 2));
  }
}

/**
 * Construit les paramètres pour l'API Responses
 */
export function buildAPIParams(formattedInput, tools, functionCallCount, messagesLength) {
  const apiParams = buildBaseParams(formattedInput);
  addToolsToParams(apiParams, tools);
  logParamsDebug(apiParams, formattedInput, functionCallCount, messagesLength);

  return apiParams;
}


