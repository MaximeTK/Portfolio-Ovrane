/**
 * Construction des prompts pour OpenAI
 */
import { buildRAGContext } from './rag/ragSystem.js';
import { 
  SYSTEM_PROMPTS, 
  RAG_HEADERS, 
  ERROR_MESSAGES,
  formatUserInfo 
} from './messages.js';

function normalizeForMatch(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRagLinkedToPrompt(prompt, sources) {
  const p = normalizeForMatch(prompt);
  if (!p) return false;

  // Si l'utilisateur parle explicitement du portfolio / projets, on considère le RAG pertinent
  if (/\b(maxime|hikup|ovrane|portfolio|projet|projets|pico)\b/i.test(prompt)) return true;

  const keywords = new Set(p.split(' ').filter((t) => t.length >= 3));
  if (keywords.size === 0) return false;

  for (const src of sources) {
    const s = normalizeForMatch(src);
    if (!s) continue;
    const parts = s.split(' ').filter((t) => t.length >= 3);
    // Si au moins un mot "significatif" du titre/source est dans la requête, on considère lié
    if (parts.some((w) => keywords.has(w))) {
      return true;
    }
  }
  return false;
}

/**
 * Construit le contexte RAG
 */
export async function buildRAGContextForPrompt(prompt, ragInitialized) {
  if (!ragInitialized) {
    return { ragContext: '', ragSources: [], ragCoverage: 'disabled' };
  }
  
  try {
    const ragResult = await buildRAGContext(prompt, 5);

    const filteredChunks = ragResult.chunks || [];

    const filteredSources = [...new Set(filteredChunks.map((c) => c.source))];
    if (filteredChunks.length === 0) {
      return { ragContext: '', ragSources: [], ragCoverage: 'none' };
    }

    // Si le prompt n'est pas clairement lié aux sources remontées, on ignore le RAG.
    if (!isRagLinkedToPrompt(prompt, filteredSources)) {
      return { ragContext: '', ragSources: [], ragCoverage: 'none' };
    }

    const averageScore = filteredChunks.reduce((sum, c) => sum + (c.score || 0), 0) / filteredChunks.length;

    // Reconstruire le texte de contexte à partir des chunks filtrés
    const contextParts = filteredChunks.map((chunk) => {
      return `[SOURCE: ${chunk.source} | Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} | Score: ${(chunk.score * 100).toFixed(1)}%]\n${chunk.text}`;
    });
    const contextText = contextParts.join('\n\n---\n\n');
    
    if (averageScore >= 0.55) {
      return {
        ragContext: `\n\n${RAG_HEADERS.contextRelevant}\n${contextText}\n\n`,
        ragSources: filteredSources,
        ragCoverage: 'good'
      };
    }
    
    if (filteredChunks.length > 0) {
      return {
        ragContext: `\n\n${RAG_HEADERS.contextLowRelevance}\n${contextText}\n\n`,
        ragSources: filteredSources,
        ragCoverage: 'low'
      };
    }
    
    return { ragContext: '', ragSources: [], ragCoverage: 'none' };
  } catch (error) {
    console.error(`❌ [BACKEND] ${ERROR_MESSAGES.ragRetrievalError}`, error.message);
    return { ragContext: `\n\n${RAG_HEADERS.errorContext}\n\n`, ragSources: [], ragCoverage: 'error' };
  }
}

/**
 * Construit le prompt système
 */
export async function buildSystemPrompt(userProfile, userId, ragContext, ragCoverage) {
  const bgPref =
    (userProfile && userProfile.preferences && userProfile.preferences.backgroundColor)
      ? String(userProfile.preferences.backgroundColor)
      : null;
  const bgInfo = `\n\nFOND ACTUEL (palette): ${bgPref ? bgPref : 'default'}`;
  const userInfo = `\n\n${formatUserInfo(userProfile.name, userProfile.visitCount)}`;
  
  let ragInstructions = getRagInstructions(ragCoverage);

  return `${ragContext}${userInfo}${bgInfo}${ragInstructions}${SYSTEM_PROMPTS.mainContext}`;
}

function getRagInstructions(ragCoverage) {
  if (ragCoverage === 'good') {
    return `\n\n${SYSTEM_PROMPTS.ragGoodCoverage}`;
  }
  
  if (ragCoverage === 'low') {
    return `\n\n${SYSTEM_PROMPTS.ragLowCoverage}`;
  }
  
  if (ragCoverage === 'none') {
    return `\n\n${SYSTEM_PROMPTS.ragNoCoverage}`;
  }
  
  return '';
}

