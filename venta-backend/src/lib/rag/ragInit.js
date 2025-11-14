/**
 * Initialisation du système RAG - max 5 fonctions, max 20 lignes
 */
import { initializeEmbeddings } from './embeddings.js';
import { initializeVectorStore } from './vectorStore.js';

const DEFAULT_CONFIG = {
  chunkSize: 500,
  overlap: 100,
  embeddingModel: 'text-embedding-3-small',
  topK: 5,
  minScore: 0.5,
};

let config = { ...DEFAULT_CONFIG };
let isInitialized = false;

/**
 * Initialise le système RAG
 */
export async function initializeRAG(apiKey, customConfig = {}) {
  try {
    console.log('\n🚀 [RAG-SYSTEM] Initialisation du système RAG...');
    config = { ...DEFAULT_CONFIG, ...customConfig };
    initializeEmbeddings(apiKey);
    console.log('✅ [RAG-SYSTEM] Module embeddings initialisé');
    await initializeVectorStore(false);
    console.log('✅ [RAG-SYSTEM] Vector store initialisé');
    isInitialized = true;
    console.log('✅ [RAG-SYSTEM] Système RAG prêt!\n');
  } catch (error) {
    console.error(
      '❌ [RAG-SYSTEM] Erreur d\'initialisation:',
      error.message,
    );
    throw error;
  }
}

export function getConfig() {
  return config;
}

export function getInitializedStatus() {
  return isInitialized;
}

/**
 * Met à jour la configuration
 */
export function updateConfig(newConfig) {
  config = { ...config, ...newConfig };
  console.log('⚙️ [RAG-SYSTEM] Configuration mise à jour:', config);
}

