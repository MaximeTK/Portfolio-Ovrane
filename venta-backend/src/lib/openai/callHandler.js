/**
 * Orchestration des appels OpenAI
 */
import { OPENAI_CONFIG, CONSOLE_LOGS, EMOJIS } from '../messages.js';
import { convertMessagesToInput } from './messageConverter.js';
import { buildAPIParams } from './apiParams.js';
import { parseOpenAIResponse } from './responseParser.js';
import { executeToolCall } from './toolExecutor.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Traite les tool calls de la réponse
 */
async function processToolCalls(responseMessage, messages, calledFunctions) {
  console.log(`${EMOJIS.tool} ${CONSOLE_LOGS.backend} ${CONSOLE_LOGS.openaiWantsToCall} ${responseMessage.tool_calls.length} fonction(s)`);
  
  messages.push({
    role: 'assistant',
    content: responseMessage.content,
    tool_calls: responseMessage.tool_calls
  });
  
  let functionCallCount = 0;
  for (const toolCall of responseMessage.tool_calls) {
    const result = await executeToolCall(toolCall);
    messages.push(result);
    
    const functionName = toolCall.function.name;
    const callCount = calledFunctions.get(functionName) || 0;
    calledFunctions.set(functionName, callCount + 1);
    functionCallCount++;
  }
  
  console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Fonction(s) exécutée(s), rappel de l'API pour obtenir la réponse finale...`);
  await delay(100);
  
  return functionCallCount;
}

/**
 * Génère une réponse par défaut si limite atteinte
 */
function generateDefaultResponse(calledFunctions) {
  if (calledFunctions.has('getAvailableAssets')) {
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Génération d'une réponse par défaut (UI via tools)`);
    return "D'accord — je m'en occupe.";
  }
  return null;
}

/**
 * Appel OpenAI avec gestion des function calls
 */
export async function callOpenAI(openai, messages, tools) {
  let totalFunctionCallCount = 0;
  const maxFunctionCalls = OPENAI_CONFIG.maxFunctionCalls;
  const calledFunctions = new Map();
  
  while (totalFunctionCallCount < maxFunctionCalls) {
    const formattedInput = convertMessagesToInput(messages);
    const apiParams = buildAPIParams(formattedInput, tools, totalFunctionCallCount, messages.length);
    
    if (messages.length > 2) {
      console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Messages dans la conversation: ${messages.length} (system + user + ${messages.length - 2} interaction(s))`);
    }
    
    const response = await openai.responses.create(apiParams);
    const responseMessage = parseOpenAIResponse(response);
    
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const callCount = await processToolCalls(responseMessage, messages, calledFunctions);
      totalFunctionCallCount += callCount;
      continue;
    }
    
    if (responseMessage.content && typeof responseMessage.content === 'string' && responseMessage.content.trim() !== '') {
      console.log(`${EMOJIS.success} ${CONSOLE_LOGS.backend} ${CONSOLE_LOGS.openaiResponseReceived}`);
      return responseMessage.content;
    }
    
    if (responseMessage.content) {
      console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.backend} Contenu reçu mais invalide (type: ${typeof responseMessage.content}):`, responseMessage.content);
    } else {
      console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.backend} Réponse sans contenu ni tool_calls, sortie de la boucle`);
    }
    break;
  }
  
  if (totalFunctionCallCount >= maxFunctionCalls) {
    console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.backend} ${CONSOLE_LOGS.openaiFunctionCallLimitReached}`);
    return generateDefaultResponse(calledFunctions);
  }
  
  return null;
}

