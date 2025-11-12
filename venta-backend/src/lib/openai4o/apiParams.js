/**
 * Construction des paramètres API OpenAI Chat Completions (GPT-4o-mini)
 */
import { OPENAI_4O_CONFIG, CONSOLE_LOGS, EMOJIS } from '../messages.js';

/**
 * Convertit les tools du format GPT-5 au format Chat Completions
 */
function convertToolsToChatFormat(tools) {
  if (!tools || tools.length === 0) return [];

  return tools.map(tool => {
    if (tool.function) {
      return tool;
    }

    const { type, name, description, parameters } = tool;
    return {
      type: type || 'function',
      function: {
        name,
        description,
        parameters
      }
    };
  });
}

function buildBaseParams(messages) {
  return {
    model: OPENAI_4O_CONFIG.model,
    messages,
    temperature: OPENAI_4O_CONFIG.temperature,
    max_tokens: OPENAI_4O_CONFIG.maxTokens
  };
}

function addToolsToParams(apiParams, tools) {
  if (tools && tools.length > 0) {
    apiParams.tools = convertToolsToChatFormat(tools);
    apiParams.tool_choice = OPENAI_4O_CONFIG.toolChoice;
  }
}

function logParamsDebug(apiParams, messages, functionCallCount, messagesLength) {
  if (functionCallCount === 0 && messagesLength === 2) {
    const debugInfo = {
      model: apiParams.model,
      messages_count: messages.length,
      tools_count: apiParams.tools?.length || 0,
      temperature: apiParams.temperature
    };

    if (apiParams.tools && apiParams.tools.length > 0) {
      debugInfo.tool_format_example = {
        type: apiParams.tools[0].type,
        has_function_property: !!apiParams.tools[0].function
      };
    }

    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Paramètres envoyés (GPT-4o):`, JSON.stringify(debugInfo, null, 2));
  }
}

export function buildAPIParams(messages, tools, functionCallCount, messagesLength) {
  const apiParams = buildBaseParams(messages);
  addToolsToParams(apiParams, tools);
  logParamsDebug(apiParams, messages, functionCallCount, messagesLength);

  return apiParams;
}


