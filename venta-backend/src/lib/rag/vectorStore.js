/**
 * Module de vector store - réexporte toutes les fonctions
 */
export {
  initializeVectorStore,
  addChunk,
  addChunks,
  clearIndex,
  getIndexStats
} from './vectorStoreCore.js';

export {
  searchSimilarChunks,
  deleteChunksBySource,
  getChunksBySource
} from './vectorStoreQuery.js';
