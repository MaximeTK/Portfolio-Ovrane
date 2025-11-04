/**
 * Recherche dans la base de connaissances RAG
 */
import { buildRAGContext } from '../rag/ragSystem.js';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES, MISC_MESSAGES } from '../messages.js';

/**
 * Recherche dans la base de connaissances
 */
export async function searchKnowledgeBase(query) {
  console.log(`\n🔵 [FUNCTION START] searchKnowledgeBase | Paramètres: query="${query}"`);
  
  try {
    console.log(`${EMOJIS.search} ${CONSOLE_LOGS.functionCall} ${CONSOLE_LOGS.searchRAG} "${query}"`);
    const ragResult = await buildRAGContext(query, 5);
    
    if (ragResult.hasSources) {
      console.log(`${EMOJIS.success} ${CONSOLE_LOGS.functionCall} ${ragResult.chunks.length} ${CONSOLE_LOGS.searchFound}`);
      const result = {
        success: true,
        results: ragResult.contextText,
        sources: ragResult.sources,
        averageScore: ragResult.averageScore
      };
      console.log(`✅ [FUNCTION END] searchKnowledgeBase | Retour: success=true, sources=${ragResult.sources.length}\n`);
      return result;
    }
    
    const result = { success: false, message: MISC_MESSAGES.ragNoInformation };
    console.log(`✅ [FUNCTION END] searchKnowledgeBase | Retour: success=false, aucune source\n`);
    return result;
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} ${ERROR_MESSAGES.ragRetrievalError}`, error.message);
    const result = { success: false, message: `Erreur: ${error.message}` };
    console.log(`❌ [FUNCTION END] searchKnowledgeBase | Retour: error="${error.message}"\n`);
    return result;
  }
}

