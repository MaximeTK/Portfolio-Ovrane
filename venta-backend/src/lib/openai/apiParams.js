/**
 * Construction des paramètres API OpenAI
 */
import { OPENAI_CONFIG, CONSOLE_LOGS, EMOJIS } from '../messages.js';

/**
 * Résout la configuration modèle, environnement prioritaire sur le code.
 *
 * Lu à l'appel et non au chargement du module : dans server.js, les imports
 * sont évalués avant dotenv.config(), donc un process.env lu au niveau module
 * serait vide en local.
 */
export function resolveModelConfig() {
  return {
    model: process.env.OPENAI_MODEL || OPENAI_CONFIG.model,
    effort: process.env.OPENAI_REASONING_EFFORT || OPENAI_CONFIG.reasoningEffort || 'medium',
    verbosity: process.env.OPENAI_TEXT_VERBOSITY || OPENAI_CONFIG.textVerbosity || 'medium',
  };
}

/**
 * Crée les paramètres de base pour l'API
 */
function buildBaseParams(formattedInput) {
  const { model, effort, verbosity } = resolveModelConfig();
  return {
    model,
    input: formattedInput,
    reasoning: { effort },
    text: { verbosity }
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


