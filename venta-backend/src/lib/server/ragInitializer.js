/**
 * Initialisation du système RAG
 */
import { initializeRAG, reindexFolder } from '../rag/ragSystem.js';
import { EMOJIS, CONSOLE_LOGS, SUCCESS_MESSAGES } from '../messages.js';

/**
 * Initialise le système RAG
 */
export async function initializeRAGSystem(ragDir, apiKey) {
  try {
    console.log(`${EMOJIS.rocket} ${CONSOLE_LOGS.rag} ${CONSOLE_LOGS.ragInitializing}`);
    await initializeRAG(apiKey, {
      chunkSize: 500, 
      overlap: 100, 
      topK: 5, 
      minScore: 0.5
    });
    
    // true = on vide l'index avant d'ingérer. Sans ça, insertItem() empile une
    // copie complète des chunks à chaque démarrage : mesuré à 141 items pour
    // 47 chunks réels, soit 3 copies. Le retrieval remontait alors plusieurs
    // fois le même passage dans son topK.
    // Coût d'un démarrage : 47 embeddings text-embedding-3-small, négligeable.
    await reindexFolder(ragDir, true);
    
    console.log(`${EMOJIS.success} ${CONSOLE_LOGS.rag} ${SUCCESS_MESSAGES.ragInitialized}\n`);
    return true;
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.rag} Erreur d'initialisation:`, error.message);
    return false;
  }
}

