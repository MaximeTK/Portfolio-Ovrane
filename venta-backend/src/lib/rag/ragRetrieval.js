/**
 * Retrieval de chunks pertinents - max 5 fonctions, max 20 lignes
 */
import { generateEmbedding } from './embeddings.js';
import { searchSimilarChunks } from './vectorStore.js';
import { getConfig, getInitializedStatus } from './ragInit.js';

const queryCache = new Map();
const CACHE_MAX_SIZE = 100;

/**
 * Recherche les chunks pertinents pour une requête
 */
export async function retrieveRelevantChunks(query, topK = null, minScore = null) {
  if (!getInitializedStatus()) {
    throw new Error('RAG system not initialized. Call initializeRAG() first.');
  }

  const config = getConfig();
  const k = topK || config.topK;
  const threshold = minScore !== null ? minScore : config.minScore;
  
  try {
    const cacheKey = `${query}:${k}:${threshold}`;
    if (queryCache.has(cacheKey)) {
      console.log('⚡ [RAG-SYSTEM] Résultat récupéré du cache');
      return queryCache.get(cacheKey);
    }

    const queryEmbedding = await generateEmbedding(query, config.embeddingModel);
    const results = await searchSimilarChunks(queryEmbedding, k, threshold);
    
    cacheResults(cacheKey, results);
    return results;
  } catch (error) {
    console.error('❌ [RAG-SYSTEM] Erreur de retrieval:', error.message);
    throw error;
  }
}

function cacheResults(cacheKey, results) {
  if (queryCache.size >= CACHE_MAX_SIZE) {
    const firstKey = queryCache.keys().next().value;
    queryCache.delete(firstKey);
  }
  queryCache.set(cacheKey, results);
}

/**
 * Log détaillé des chunks utilisés
 */
function logChunksDetails(chunks, query, averageScore) {
  console.log(`\n📊 [RAG] ${chunks.length} chunks utilisés | Score: ${(averageScore * 100).toFixed(1)}% | Requête: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
  
  chunks.forEach((chunk, index) => {
    console.log(`   ${index + 1}. ${chunk.source} [${chunk.chunkIndex + 1}/${chunk.totalChunks}] ${(chunk.score * 100).toFixed(1)}% - ${chunk.text.substring(0, 100)}...`);
  });
  console.log('');
}

/**
 * Construit le contexte RAG pour le prompt
 */
export async function buildRAGContext(query, topK = null) {
  const chunks = await retrieveRelevantChunks(query, topK);
  
  if (chunks.length === 0) {
    console.log('📭 [RAG-SYSTEM] Aucun chunk pertinent trouvé');
    return { contextText: '', chunks: [], hasSources: false, averageScore: 0 };
  }
  
  const averageScore = chunks.reduce((sum, chunk) => sum + chunk.score, 0) / chunks.length;
  logChunksDetails(chunks, query, averageScore);
  
  const contextParts = chunks.map((chunk) => {
    return `[SOURCE: ${chunk.source} | Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} | Score: ${(chunk.score * 100).toFixed(1)}%]\n${chunk.text}`;
  });
  
  const contextText = contextParts.join('\n\n---\n\n');
  
  return {
    contextText,
    chunks,
    hasSources: true,
    averageScore,
    sources: [...new Set(chunks.map(c => c.source))]
  };
}

/**
 * Vide le cache des requêtes
 */
export function clearCache() {
  queryCache.clear();
  console.log('🗑️ [RAG-SYSTEM] Cache vidé');
}

