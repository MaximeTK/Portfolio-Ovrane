/**
 * Génération de réponses avec OpenAI
 */
import { buildRAGContextForPrompt, buildSystemPrompt } from '../promptBuilder.js';
import { getRawConversationHistory } from '../userMemory.js';
import { callAI } from '../aiModelFactory.js';
import { tools } from './toolsConfig.js';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES, MISC_MESSAGES } from '../messages.js';

function normalize(text) {
  return String(text ?? '').toLowerCase();
}

function isImageIntent(prompt) {
  const p = normalize(prompt);
  // On évite "affiche" seul (ex: "affiche-moi un exemple de code")
  // Inclut aussi les demandes autour des projets/portfolio (souvent liées à des visuels)
  return /\b(image|photo|logo|visuel|illustration|screenshot|capture|interface|pico|portfolio|projet|projets)\b/i.test(prompt);
}

function isColorIntent(prompt) {
  const p = normalize(prompt);
  return /\b(fond|background|arriere-plan|arrière-plan|couleur|palette|themes|thèmes|theme|thème)\b/i.test(prompt);
}

function isColorListIntent(prompt) {
  const p = normalize(prompt);
  // Demande d'énumération / d'information: ne doit PAS déclencher un changement.
  return /\b(quels?|quelle?s?|liste|listes|disponible?s?|possible?s?|tous|toutes|montre|affiche|voir)\b/i.test(p);
}

function isColorChangeIntent(prompt) {
  const p = normalize(prompt);
  // Intention explicite de changement: déclenchement autorisé.
  return /\b(change|changer|passe|passer|mets|met|mettez|mettre|applique|appliquer|active|activer|set|switch)\b/i.test(p);
}

function isCodeIntent(prompt) {
  const p = normalize(prompt);
  return /\b(code|snippet|exemple\s+de\s+code|montre\s+du\s+code|montre-moi\s+du\s+code|impl[eé]mentation)\b/i.test(p);
}

function isWindowIntent(prompt) {
  const p = normalize(prompt);
  return /\b(fenetre|fenêtre|window|ouvre\s+une\s+fen[eê]tre|openwindow)\b/i.test(p);
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

  // Tools UI uniquement si l'intention est claire (sinon l'IA peut spammer des actions)
  if (isImageIntent(prompt)) {
    allow.add('getRulePicture');
    allow.add('getAvailableAssets');
    allow.add('uiShowPicture');
  }

  if (isColorIntent(prompt)) {
    allow.add('getAvailableColors');
    // IMPORTANT: Si l'utilisateur demande la LISTE des thèmes/palettes, on ne change rien.
    // On n'autorise le changement que sur intention explicite de "changer/mettre/appliquer".
    if (isColorChangeIntent(prompt) && !isColorListIntent(prompt)) {
      allow.add('uiSetBackground');
    }
  }

  // IMPORTANT: La messagerie n'affiche que des bulles. Le code doit être renvoyé dans le texte (Markdown ```lang),
  // pas via une commande UI (fenêtre dashboard).

  if (isWindowIntent(prompt)) {
    allow.add('uiOpenWindow');
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
  return MISC_MESSAGES.defaultResponse;
}

function toSafeText(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

function buildHistoryMessages(rawHistory) {
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) {
    return [];
  }

  const messages = [];
  for (const conv of rawHistory) {
    // Format standard (prompt/response)
    if (conv?.prompt) {
      const prompt = toSafeText(conv.prompt).trim();
      if (prompt) messages.push({ role: 'user', content: prompt });
    }
    if (conv?.response) {
      const response = toSafeText(conv.response).trim();
      if (response) messages.push({ role: 'assistant', content: response });
    }

    // Fallback (structure role/content)
    if (!conv?.prompt && !conv?.response && conv?.role && conv?.content) {
      const role = conv.role === 'assistant' ? 'assistant' : 'user';
      const content = toSafeText(conv.content).trim();
      if (content) messages.push({ role, content });
    }
  }

  return messages;
}

/**
 * Génère une réponse avec OpenAI
 */
export async function generateResponse(openai, prompt, userId, userProfile, ragInitialized) {
  const { ragContext, ragSources, ragCoverage } = await buildRAGContextForPrompt(prompt, ragInitialized);
  const systemPrompt = await buildSystemPrompt(userProfile, userId, ragContext, ragCoverage);
  
  // Injecter l'historique en tant que messages (meilleure compréhension des suivis type "plus simple", "en anglais", etc.)
  // On garde une fenêtre courte pour éviter d'exploser le contexte.
  const rawHistory = await getRawConversationHistory(userId, 8, 0);
  const historyMessages = buildHistoryMessages(rawHistory);
  
  console.log(`\n📤 ${CONSOLE_LOGS.backend} ===== ENVOI À CHATGPT =====`);
  console.log(`🤖 ${CONSOLE_LOGS.openaiModelInfo}`);
  console.log(`📋 ${CONSOLE_LOGS.openaiSystemPrompt}`, systemPrompt.substring(0, 200) + '...');
  console.log(`💬 ${CONSOLE_LOGS.openaiUserPrompt}`, prompt);
  console.log(`${EMOJIS.loading} ${CONSOLE_LOGS.backend} ${CONSOLE_LOGS.openaiCallInProgress}\n`);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
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

