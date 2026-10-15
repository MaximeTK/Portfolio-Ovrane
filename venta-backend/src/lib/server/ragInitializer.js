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
    initializeRAG(apiKey);
    // Appelé après la connexion MongoDB : seuls les passages nouveaux ou modifiés sont embeddés
    const result = await reindexFolder(ragDir);
    if (!result.success) return false;
    console.log(`${EMOJIS.success} ${CONSOLE_LOGS.rag} ${SUCCESS_MESSAGES.ragInitialized}\n`);
    return true;
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.rag} Erreur d'initialisation:`, error.message);
    return false;
  }
}
