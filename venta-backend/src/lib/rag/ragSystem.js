/**
 * Système RAG Principal - réexporte toutes les fonctions
 */
import fs from 'fs';
import path from 'path';
import { initializeRAG, getConfig, updateConfig } from './ragInit.js';
import { loadDocumentsFromFolder } from './ragDocuments.js';
import { ingestDocuments } from './ragIngest.js';
import { retrieveRelevantChunks, buildRAGContext, clearCache } from './ragRetrieval.js';
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
  
  // Vider le cache avant la réindexation
  clearCache();
  
  const documents = loadDocumentsFromFolder(folderPath);
  
  if (documents.length === 0) {
    console.warn('⚠️ [RAG-SYSTEM] Aucun document trouvé');
    return { success: false, documentsProcessed: 0, chunksIndexed: 0 };
  }
  
  return await ingestDocuments(documents, clearExisting);
}

/**
 * Met à jour un document spécifique
 */
export async function updateDocument(folderPath, filename) {
  console.log(`\n🔄 [RAG-SYSTEM] Mise à jour du document: ${filename}`);
  
  // Vider le cache avant la mise à jour
  clearCache();
  
  const source = filename.replace('.txt', '');
  await deleteChunksBySource(source);
  
  const filePath = path.join(folderPath, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ [RAG-SYSTEM] Fichier non trouvé: ${filePath}`);
    return { success: false };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const document = {
    source,
    content,
    metadata: { filename, path: filePath, size: content.length }
  };
  
  return await ingestDocuments([document], false);
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
