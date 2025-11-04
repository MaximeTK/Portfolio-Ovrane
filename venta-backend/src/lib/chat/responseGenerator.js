/**
 * Génération de réponses avec OpenAI
 */
import { buildRAGContextForPrompt, buildSystemPrompt } from '../promptBuilder.js';
import { callAI } from '../aiModelFactory.js';
import { tools } from './toolsConfig.js';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES, MISC_MESSAGES } from '../messages.js';

/**
 * Vérifie si une réponse est valide
 */
function isValidResponse(rawResponse) {
  return rawResponse && typeof rawResponse === 'string' && rawResponse.trim() !== '';
}

/**
 * Génère une réponse de repli
 */
function generateFallbackResponse(prompt) {
  const lower = (prompt || '').toLowerCase();
  const asksBackgroundChange = lower.includes('fond') || lower.includes('background') || lower.includes("arrière-plan");
  const mentionsEcarlate = lower.includes('écarlate') || lower.includes('ecarlate');
  
  if (asksBackgroundChange && mentionsEcarlate) {
    return "Je change le fond en écarlate. /SetBackground ecarlate";
  }
  
  return MISC_MESSAGES.defaultResponse;
}

/**
 * Génère une réponse avec OpenAI
 */
export async function generateResponse(openai, prompt, userId, userProfile, ragInitialized) {
  const { ragContext, ragSources, ragCoverage } = await buildRAGContextForPrompt(prompt, ragInitialized);
  const systemPrompt = buildSystemPrompt(userProfile, userId, ragContext, ragCoverage);
  
  console.log(`\n📤 ${CONSOLE_LOGS.backend} ===== ENVOI À CHATGPT =====`);
  console.log(`🤖 ${CONSOLE_LOGS.openaiModelInfo}`);
  console.log(`📋 ${CONSOLE_LOGS.openaiSystemPrompt}`, systemPrompt.substring(0, 200) + '...');
  console.log(`💬 ${CONSOLE_LOGS.openaiUserPrompt}`, prompt);
  console.log(`${EMOJIS.loading} ${CONSOLE_LOGS.backend} ${CONSOLE_LOGS.openaiCallInProgress}\n`);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];
  
  const rawResponse = await callAI(openai, messages, tools);
  
  if (!isValidResponse(rawResponse)) {
    console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.backend} ${ERROR_MESSAGES.openaiResponseEmpty} (type: ${typeof rawResponse}) → application d'un repli`);
    const fallback = generateFallbackResponse(prompt);
    return { rawResponse: fallback, ragCoverage, ragSources };
  }
  
  return { rawResponse, ragCoverage, ragSources };
}

