/**
 * Système RAG Principal - réexporte toutes les fonctions
 */
import fs from 'fs';
import path from 'path';
import { initializeRAG, getConfig, updateConfig } from './ragInit.js';
import { loadDocumentsFromFolder } from './ragDocuments.js';
import { ingestDocuments } from './ragIngest.js';
import {
  retrieveRelevantChunks,
  buildRAGContext,
  clearCache,
} from './ragRetrieval.js';
import { deleteChunksBySource, getIndexStats } from './vectorStore.js';

export {
  initializeRAG,
  loadDocumentsFromFolder,
  ingestDocuments,
  retrieveRelevantChunks,
  buildRAGContext,
  updateConfig,
  clearCache,
  getIndexStats
};

/**
 * Réindexe un dossier complet
 */
export async function reindexFolder(folderPath, clearExisting = true) {
  console.log(`\n🔄 [RAG-SYSTEM] Réindexation du dossier: ${folderPath}`);
  clearCache();
  const documents = loadDocumentsFromFolder(folderPath);
  if (documents.length === 0) {
    console.warn('⚠️ [RAG-SYSTEM] Aucun document trouvé');
    return { success: false, documentsProcessed: 0, chunksIndexed: 0 };
  }
  return ingestDocuments(documents, clearExisting);
}

/**
 * Obtient les statistiques du système
 */
export async function getSystemStats() {
  const indexStats = await getIndexStats();
  return {
    initialized: true,
    config: getConfig(),
    index: indexStats,
    cache: { size: 0, maxSize: 100 }
  };
}
