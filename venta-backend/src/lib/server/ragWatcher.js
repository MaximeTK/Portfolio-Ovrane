/**
 * Surveillance des modifications du dossier RAG
 */
import fs from 'fs';
import { reindexFolder, clearCache } from '../rag/ragSystem.js';
import { EMOJIS, CONSOLE_LOGS, SUCCESS_MESSAGES } from '../messages.js';

// Variables globales pour le watcher
let reindexTimer = null;
let isReindexing = false;

/**
 * Gère la réindexation avec debounce
 */
async function handleReindex(ragDir) {
  if (isReindexing) {
    console.log(`⏸️ ${CONSOLE_LOGS.rag} ${CONSOLE_LOGS.ragReindexInProgress}`);
    return;
  }
  
  isReindexing = true;
  try {
    clearCache();
    await reindexFolder(ragDir, true);
    console.log(`${EMOJIS.success} ${CONSOLE_LOGS.rag} ${SUCCESS_MESSAGES.ragIndexUpdated}`);
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.rag} Erreur de réindexation:`, error.message);
  } finally {
    isReindexing = false;
  }
}

/**
 * Surveille les modifications du dossier RAG
 */
export function watchRAGFolder(ragDir, ragInitialized) {
  if (!fs.existsSync(ragDir)) return;
  
  fs.watch(ragDir, (eventType, filename) => {
    if (filename && filename.endsWith('.txt') && ragInitialized) {
      console.log(`📝 ${CONSOLE_LOGS.rag} ${CONSOLE_LOGS.ragFileModified} ${filename} (${eventType})`);
      
      if (reindexTimer) {
        clearTimeout(reindexTimer);
      }
      
      reindexTimer = setTimeout(() => handleReindex(ragDir), 1000);
    }
  });
}

