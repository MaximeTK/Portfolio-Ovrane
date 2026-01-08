/**
 * Génération de réponses avec OpenAI
 */
import { buildRAGContextForPrompt, buildSystemPrompt } from '../promptBuilder.js';
import { callAI } from '../aiModelFactory.js';
import { tools } from './toolsConfig.js';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES, MISC_MESSAGES } from '../messages.js';

function normalize(text) {
  return String(text ?? '').toLowerCase();
}

function isImageIntent(prompt) {
  const p = normalize(prompt);
  if (p.includes('/showpicture') || p.includes('/showimage')) return true;
  // On évite "affiche" seul (ex: "affiche-moi un exemple de code")
  return /\b(image|photo|logo|visuel|illustration|screenshot|capture|interface)\b/i.test(prompt);
}

function isColorIntent(prompt) {
  const p = normalize(prompt);
  if (p.includes('/setbackground')) return true;
  return /\b(fond|background|arriere-plan|arrière-plan|couleur|palette|theme|thème)\b/i.test(prompt);
}

function filterToolsForPrompt(prompt) {
  const allow = new Set();

  // Tools "utilisateur" : toujours (ils sont nécessaires au système de profils)
  allow.add('checkUser');
  allow.add('CreateUserProfile');
  allow.add('UpdateUserProfile');
  allow.add('SwitchUserProfile');

  // RAG tool : utile si l'utilisateur demande un projet/histoire, mais safe à garder
  allow.add('searchKnowledgeBase');

  // Tools images/couleurs uniquement si l'intention est claire
  if (isImageIntent(prompt)) {
    allow.add('getRulePicture');
    allow.add('getAvailableAssets');
  }

  if (isColorIntent(prompt)) {
    allow.add('getAvailableColors');
  }

  const filtered = (tools || []).filter((t) => allow.has(t?.name));
  return filtered.length > 0 ? filtered : null;
}

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
  
  const effectiveTools = filterToolsForPrompt(prompt);
  const rawResponse = await callAI(openai, messages, effectiveTools);
  
  if (!isValidResponse(rawResponse)) {
    console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.backend} ${ERROR_MESSAGES.openaiResponseEmpty} (type: ${typeof rawResponse}) → application d'un repli`);
    const fallback = generateFallbackResponse(prompt);
    return { rawResponse: fallback, ragCoverage, ragSources };
  }
  
  return { rawResponse, ragCoverage, ragSources };
}

