/**
 * Orchestration des appels OpenAI
 */
import { OPENAI_CONFIG, CONSOLE_LOGS, EMOJIS } from '../messages.js';
import { convertMessagesToInput } from './messageConverter.js';
import { buildAPIParams } from './apiParams.js';
import { parseOpenAIResponse } from './responseParser.js';
import { executeToolCall } from './toolExecutor.js';
import { debug } from '../log.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function stableStringify(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') {
    return typeof value === 'string' ? value.toLowerCase().trim() : String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map((k) => `${k}:${stableStringify(value[k])}`);
  return `{${parts.join(',')}}`;
}

function toolCallKey(toolCall) {
  const name = String(toolCall?.function?.name ?? '').trim();
  const argsRaw = String(toolCall?.function?.arguments ?? '');
  let args = {};
  try {
    args = argsRaw ? JSON.parse(argsRaw) : {};
  } catch {
    args = { _raw: argsRaw };
  }
  return `${name}::${stableStringify(args)}`;
}

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
  const merged = {
    id: toolCalls?.[0]?.id || 'merged-uiShowPicture',
    function: {
      name: 'uiShowPicture',
      arguments: JSON.stringify({ filenames: Array.from(new Set(filenames)).filter(Boolean) })
    }
  };
  return await executeToolCall(merged);
}

/**
 * Traite les tool calls de la réponse
 */
async function processToolCalls(responseMessage, messages, calledFunctions, seenToolCalls) {
  debug(`${EMOJIS.tool} ${CONSOLE_LOGS.backend} ${CONSOLE_LOGS.openaiWantsToCall} ${responseMessage.tool_calls.length} fonction(s)`);
  
  messages.push({
    role: 'assistant',
    content: responseMessage.content,
    tool_calls: responseMessage.tool_calls
  });
  
  let functionCallCount = 0;
  // Fusion anti-spam: plusieurs uiShowPicture -> un seul call exécuté
  if (responseMessage.tool_calls.every((c) => c?.function?.name === 'uiShowPicture') && responseMessage.tool_calls.length > 1) {
    const mergedResult = await executeMergedUiShowPictureCalls(responseMessage.tool_calls);
    messages.push(mergedResult);
    for (let i = 1; i < responseMessage.tool_calls.length; i += 1) {
      const tc = responseMessage.tool_calls[i];
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: 'uiShowPicture',
        content: 'Fusionné: affichage géré par un seul appel uiShowPicture({ filenames: [...] }).',
      });
    }
    const functionName = 'uiShowPicture';
    const callCount = calledFunctions.get(functionName) || 0;
    calledFunctions.set(functionName, callCount + 1);
    functionCallCount += 1;
  } else for (const toolCall of responseMessage.tool_calls) {
    const key = toolCallKey(toolCall);
    if (seenToolCalls.has(key)) {
      // Anti-boucle: répondre au tool call sans le ré-exécuter.
      // Cela empêche les répétitions "Pico Logo" / "Pico logo" etc. de consommer tout le budget.
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content:
          `Résultat déjà fourni pour cet appel (${toolCall.function.name}). ` +
          `N'appelle pas à nouveau ce tool avec les mêmes arguments. Passe à l'étape suivante.`,
      });
    } else {
      seenToolCalls.add(key);
      const result = await executeToolCall(toolCall);
      messages.push(result);
      // On ne compte que les appels réellement exécutés (sinon on recrée la limite artificiellement).
      functionCallCount++;
    }
    
    const functionName = toolCall.function.name;
    const callCount = calledFunctions.get(functionName) || 0;
    calledFunctions.set(functionName, callCount + 1);
  }
  
  debug(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Fonction(s) exécutée(s), rappel de l'API pour obtenir la réponse finale...`);
  await delay(100);
  
  return functionCallCount;
}

/**
 * Génère une réponse par défaut si limite atteinte
 */
function generateDefaultResponse(calledFunctions) {
  if (calledFunctions.has('getAvailableAssets')) {
    debug(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Génération d'une réponse par défaut (UI via tools)`);
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
  const seenToolCalls = new Set();
  
  while (totalFunctionCallCount < maxFunctionCalls) {
    const formattedInput = convertMessagesToInput(messages);
    const apiParams = buildAPIParams(formattedInput, tools, totalFunctionCallCount, messages.length);
    
    if (messages.length > 2) {
      debug(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Messages dans la conversation: ${messages.length} (system + user + ${messages.length - 2} interaction(s))`);
    }
    
    const response = await openai.responses.create(apiParams);
    const responseMessage = parseOpenAIResponse(response);
    
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // Zéro surcoût: si c'est uniquement des uiShowPicture, on exécute et on renvoie une réponse locale,
      // sans rappeler l'API.
      if (shouldShortCircuitAfterTools(responseMessage)) {
        await processToolCalls(responseMessage, messages, calledFunctions, seenToolCalls);
        return (responseMessage.content && typeof responseMessage.content === 'string' && responseMessage.content.trim() !== '')
          ? responseMessage.content.trim()
          : "D'accord — j'affiche les visuels.";
      }
      const callCount = await processToolCalls(responseMessage, messages, calledFunctions, seenToolCalls);
      totalFunctionCallCount += callCount;
      continue;
    }
    
    if (responseMessage.content && typeof responseMessage.content === 'string' && responseMessage.content.trim() !== '') {
      debug(`${EMOJIS.success} ${CONSOLE_LOGS.backend} ${CONSOLE_LOGS.openaiResponseReceived}`);
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

