/**
 * Requêtes et recherches dans le vector store - max 5 fonctions, max 20 lignes
 */
import { getVectorIndex } from './vectorStoreCore.js';

/**
 * Recherche les chunks les plus similaires
 */
export async function searchSimilarChunks(queryEmbedding, topK = 5, minScore = 0.0) {
  const vectorIndex = getVectorIndex();
  if (!vectorIndex) {
    throw new Error('Vector store not initialized');
  }

  try {
    const results = await vectorIndex.queryItems(queryEmbedding, topK);
    return results
      .filter(result => result.score >= minScore)
      .map(result => ({
        id: result.item.metadata.id,
        text: result.item.metadata.text,
        source: result.item.metadata.source,
        chunkIndex: result.item.metadata.chunkIndex,
        totalChunks: result.item.metadata.totalChunks,
        tokenCount: result.item.metadata.tokenCount,
        score: result.score,
        metadata: { createdAt: result.item.metadata.createdAt }
      }));
  } catch (error) {
    console.error('❌ [VECTOR-STORE] Erreur de recherche:', error.message);
    throw error;
  }
}

/**
 * Supprime tous les chunks d'une source
 */
export async function deleteChunksBySource(source) {
  const vectorIndex = getVectorIndex();
  if (!vectorIndex) {
    throw new Error('Vector store not initialized');
  }

  try {
    const allItems = await vectorIndex.listItems();
    let deleted = 0;
    for (const item of allItems) {
      if (item.metadata.source === source) {
        await vectorIndex.deleteItem(item.metadata.id);
        deleted++;
      }
    }
    console.log(`🗑️ [VECTOR-STORE] ${deleted} chunk(s) supprimé(s) de "${source}"`);
    return deleted;
  } catch (error) {
    console.error(`❌ [VECTOR-STORE] Erreur suppression chunks de "${source}":`, error.message);
    throw error;
  }
}

/**
 * Liste tous les chunks d'une source
 */
export async function getChunksBySource(source) {
  const vectorIndex = getVectorIndex();
  if (!vectorIndex) {
    throw new Error('Vector store not initialized');
  }

  try {
    const allItems = await vectorIndex.listItems();
    return allItems
      .filter(item => item.metadata.source === source)
      .map(item => ({
        id: item.metadata.id,
        text: item.metadata.text,
        source: item.metadata.source,
        chunkIndex: item.metadata.chunkIndex,
        totalChunks: item.metadata.totalChunks,
        tokenCount: item.metadata.tokenCount,
        metadata: item.metadata
      }));
  } catch (error) {
    console.error(`❌ [VECTOR-STORE] Erreur récupération chunks de "${source}":`, error.message);
    return [];
  }
}

