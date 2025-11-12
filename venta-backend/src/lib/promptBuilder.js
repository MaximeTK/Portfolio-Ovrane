/**
 * Construction des prompts pour OpenAI
 */
import { buildRAGContext } from './rag/ragSystem.js';
import { getConversationHistory } from './userMemory.js';
import { 
  SYSTEM_PROMPTS, 
  RAG_HEADERS, 
  ERROR_MESSAGES,
  formatUserInfo 
} from './messages.js';

/**
 * Construit le contexte RAG
 */
export async function buildRAGContextForPrompt(prompt, ragInitialized) {
  if (!ragInitialized) {
    return { ragContext: '', ragSources: [], ragCoverage: 'disabled' };
  }
  
  try {
    const ragResult = await buildRAGContext(prompt, 5);
    
    if (ragResult.hasSources && ragResult.averageScore >= 0.5) {
      return {
        ragContext: `\n\n${RAG_HEADERS.contextRelevant}\n${ragResult.contextText}\n\n`,
        ragSources: ragResult.sources,
        ragCoverage: 'good'
      };
    }
    
    if (ragResult.hasSources) {
      return {
        ragContext: `\n\n${RAG_HEADERS.contextLowRelevance}\n${ragResult.contextText}\n\n`,
        ragSources: ragResult.sources,
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
export function buildSystemPrompt(userProfile, userId, ragContext, ragCoverage) {
  const conversationHistory = getConversationHistory(userId, 5);
  const userInfo = `\n\n${formatUserInfo(userProfile.name, userProfile.visitCount)}`;
  
  let ragInstructions = getRagInstructions(ragCoverage);

  return `${ragContext}${conversationHistory}${userInfo}${ragInstructions}${SYSTEM_PROMPTS.mainContext}`;
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

