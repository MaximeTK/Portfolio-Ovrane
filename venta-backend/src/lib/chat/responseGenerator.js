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
  return /\b(montre|montrer|display|affiche|affiches|voir|voirs|afficher|images|image|photo|photos|logos|logo|visuels|visuel|illustration|screenshots|screenshot|captures|capture|interfaces|interface)\b/i.test(prompt);
}

function isColorIntent(prompt) {
  const p = normalize(prompt);
  // Inclut les mots clés génériques et toutes les palettes spécifiques (ex: cyberpunk, ocean, rouge...)
  return /\b(fond|background|arriere-plan|arrière-plan|couleur|palette|themes|thèmes|theme|thème|argenté|gris|noir|doré|jaune|orange|rouge|ecarlate|vert clair|vert_clair|forêt|marée|feuille|aqua|ocean|hopa|gris ciel|gris_ciel|spectre|mauve|rose|cyberpunk|melon|goyavier|marron|vin)\b/i.test(prompt);
}

function isUserIntent(prompt) {
  const p = normalize(prompt);
  return /\b(nom|prénom|prenom|pseudo|profil|user|utilisateur|identit|appelle|m'appelle|suis|moi)\b/i.test(p);
}

function filterToolsForPrompt(prompt) {
  const allow = new Set();

  if (isUserIntent(prompt)) {
    allow.add('checkUser');
    allow.add('CreateUserProfile');
    allow.add('UpdateUserProfile');
    allow.add('SwitchUserProfile');
  }

  // IMPORTANT: Pas de tool searchKnowledgeBase.
  // Le RAG est déjà géré côté backend via buildRAGContextForPrompt() (injection de contexte avant l'appel modèle).
  // Exposer searchKnowledgeBase au modèle provoque des boucles de tool-calls et des réponses vides.

  // Tools UI uniquement si l'intention est claire (sinon l'IA peut spammer des actions)
  if (isImageIntent(prompt)) {
    allow.add('getRulePicture');
    allow.add('getAvailableAssets');
    allow.add('uiShowPicture');
  }

  if (isColorIntent(prompt)) {
    allow.add('getAvailableColors');
    allow.add('uiSetBackground');
  }

  // IMPORTANT: La messagerie n'affiche que des bulles. Le code doit être renvoyé dans le texte (Markdown ```lang),
  // pas via une commande UI (fenêtre dashboard).

  // Pas de logique "fenêtre" ici.

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

