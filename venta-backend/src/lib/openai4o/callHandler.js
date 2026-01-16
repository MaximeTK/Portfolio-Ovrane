/**
 * Orchestration des appels OpenAI Chat Completions (GPT-4o)
 */
import { OPENAI_4O_CONFIG, CONSOLE_LOGS, EMOJIS } from '../messages.js';
import { convertMessagesToChatFormat } from './messageConverter.js';
import { buildAPIParams } from './apiParams.js';
import { parseOpenAIResponse } from './responseParser.js';
import { executeToolCall } from '../openai/toolExecutor.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function safeParseArgs(toolCall) {
  const raw = toolCall?.function?.arguments;
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
  } catch {
    return {};
  }
}

function shouldShortCircuitAfterTools(responseMessage) {
  const calls = responseMessage?.tool_calls;
  if (!Array.isArray(calls) || calls.length === 0) return false;
  // Cas ciblé: rafale d'uiShowPicture -> on exécute et on renvoie une réponse locale
  // pour éviter un 2e appel OpenAI (pas de surcoût).
  return calls.every((c) => c?.function?.name === 'uiShowPicture');
}

async function executeMergedUiShowPictureCalls(toolCalls) {
  const filenames = [];
  for (const tc of toolCalls) {
    const args = safeParseArgs(tc);
    if (Array.isArray(args.filenames)) {
      filenames.push(...args.filenames);
    } else if (typeof args.filename === 'string' && args.filename.trim()) {
      filenames.push(args.filename);
    }
  }

  // Exécuter UN seul tool call réel (même si le modèle en a demandé plusieurs).
  // Le handler uiShowPicture va pousser plusieurs commandes UI (ShowPicture) en interne.
  const merged = {
    id: toolCalls?.[0]?.id || 'merged-uiShowPicture',
    function: {
      name: 'uiShowPicture',
      arguments: JSON.stringify({ filenames: Array.from(new Set(filenames)).filter(Boolean) })
    }
  };
  return await executeToolCall(merged);
}

async function processToolCalls(responseMessage, messages, calledFunctions) {
  console.log(`${EMOJIS.tool} ${CONSOLE_LOGS.backend} ${CONSOLE_LOGS.openaiWantsToCall} ${responseMessage.tool_calls.length} fonction(s)`);
  
  messages.push({
    role: 'assistant',
    content: responseMessage.content,
    tool_calls: responseMessage.tool_calls
  });
  
  let functionCallCount = 0;
  if (responseMessage.tool_calls.every((c) => c?.function?.name === 'uiShowPicture') && responseMessage.tool_calls.length > 1) {
    const mergedResult = await executeMergedUiShowPictureCalls(responseMessage.tool_calls);
    // On rattache le résultat au 1er tool_call_id, et on fournit des réponses vides pour les autres
    // (pas besoin de ré-exécuter, pas de surcoût).
    messages.push(mergedResult);
    for (let i = 1; i < responseMessage.tool_calls.length; i += 1) {
      const tc = responseMessage.tool_calls[i];
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: 'uiShowPicture',
        content: 'Fusionné: affichage géré par un seul appel uiShowPicture({ filenames: [...] }).'
      });
    }
    const callCount = calledFunctions.get('uiShowPicture') || 0;
    calledFunctions.set('uiShowPicture', callCount + 1);
    functionCallCount += 1;
  } else {
    for (const toolCall of responseMessage.tool_calls) {
      const result = await executeToolCall(toolCall);
      messages.push(result);
      
      const functionName = toolCall.function.name;
      const callCount = calledFunctions.get(functionName) || 0;
      calledFunctions.set(functionName, callCount + 1);
      functionCallCount++;
    }
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
      // Zéro surcoût: si c'est uniquement des uiShowPicture, on exécute et on renvoie une réponse locale,
      // sans rappeler l'API.
      if (shouldShortCircuitAfterTools(responseMessage)) {
        await processToolCalls(responseMessage, messages, calledFunctions);
        return (responseMessage.content && String(responseMessage.content).trim())
          ? String(responseMessage.content).trim()
          : "D'accord — j'affiche les visuels.";
      }

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

