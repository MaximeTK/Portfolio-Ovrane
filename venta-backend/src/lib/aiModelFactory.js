/**
 * Factory pour sélectionner le bon modèle d'IA (GPT-5 ou GPT-4o-mini)
 */
import { CONSOLE_LOGS, EMOJIS } from './messages.js';

// Import des handlers GPT-5 (API Responses)
import { callOpenAI as callOpenAI_GPT5 } from './openai/callHandler.js';

// Import des handlers GPT-4o-mini (API Chat Completions)
import { callOpenAI as callOpenAI_4O } from './openai4o/callHandler.js';

/**
 * Valide le modèle d'IA sélectionné
 */
function getAIModel() {
  const model = process.env.AI_MODEL?.toLowerCase() || 'gpt5';
  
  if (model !== 'gpt5' && model !== 'gpt4o-mini') {
    console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.backend} Modèle AI_MODEL invalide: "${model}". Utilisation de "gpt5" par défaut.`);
    return 'gpt5';
  }
  
  return model;
}

/**
 * Retourne le handler callOpenAI approprié selon le modèle configuré
 */
export function getAIHandler() {
  const model = getAIModel();
  
  if (model === 'gpt4o-mini') {
    console.log(`${EMOJIS.robot} ${CONSOLE_LOGS.backend} Utilisation du modèle: GPT-4o-mini (Chat Completions API)`);
    return callOpenAI_4O;
  }
  
  console.log(`${EMOJIS.robot} ${CONSOLE_LOGS.backend} Utilisation du modèle: GPT-5-mini (Responses API)`);
  return callOpenAI_GPT5;
}

/**
 * Appelle l'IA avec le modèle configuré
 */
export async function callAI(openai, messages, tools) {
  const handler = getAIHandler();
  return await handler(openai, messages, tools);
}

