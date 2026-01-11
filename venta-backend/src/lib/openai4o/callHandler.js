/**
 * Orchestration des appels OpenAI Chat Completions (GPT-4o)
 */
import { OPENAI_4O_CONFIG, CONSOLE_LOGS, EMOJIS } from '../messages.js';
import { convertMessagesToChatFormat } from './messageConverter.js';
import { buildAPIParams } from './apiParams.js';
import { parseOpenAIResponse } from './responseParser.js';
import { executeToolCall } from '../openai/toolExecutor.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

function generateDefaultResponse(calledFunctions) {
  if (calledFunctions.has('getAvailableColors')) {
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Génération d'une réponse par défaut (UI via tools)`);
    return "D'accord — je m'en occupe.";
  }

  if (calledFunctions.has('getAvailableAssets')) {
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Génération d'une réponse par défaut (UI via tools)`);
    return "D'accord — je m'en occupe.";
  }

  return null;
}

export async function callOpenAI(openai, messages, tools) {
  let totalFunctionCallCount = 0;
  const maxFunctionCalls = OPENAI_4O_CONFIG.maxFunctionCalls;
  const calledFunctions = new Map();
  
  while (totalFunctionCallCount < maxFunctionCalls) {
    const chatMessages = convertMessagesToChatFormat(messages);
    const apiParams = buildAPIParams(chatMessages, tools, totalFunctionCallCount, messages.length);
    
    if (messages.length > 2) {
      console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Messages dans la conversation: ${messages.length} (system + user + ${messages.length - 2} interaction(s))`);
      
      if (totalFunctionCallCount > 0) {
        const lastMessages = chatMessages.slice(-3);
        console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} 3 derniers messages envoyés à l'API:`);
        lastMessages.forEach((msg, idx) => {
          const preview = msg.content ? msg.content.substring(0, 150) : '(null)';
          console.log(`   ${idx + 1}. role="${msg.role}" ${msg.tool_calls ? 'has_tool_calls=true' : ''} ${msg.tool_call_id ? `tool_call_id="${msg.tool_call_id}"` : ''}`);
          console.log(`      content: ${preview}${msg.content && msg.content.length > 150 ? '...' : ''}`);
        });
      }
    }
    
    const response = await openai.chat.completions.create(apiParams);
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

