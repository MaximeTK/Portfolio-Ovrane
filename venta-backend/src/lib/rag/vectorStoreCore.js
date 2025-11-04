/**
 * Fonctions de base du vector store - max 5 fonctions, max 20 lignes
 */
import { LocalIndex } from 'vectra';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let vectorIndex = null;
const INDEX_PATH = path.join(__dirname, '../../../data/vector-index');

/**
 * Initialise le vector store
 */
export async function initializeVectorStore(reset = false) {
  try {
    if (!fs.existsSync(INDEX_PATH)) {
      fs.mkdirSync(INDEX_PATH, { recursive: true });
    }

    if (reset && fs.existsSync(INDEX_PATH)) {
      console.log('🔄 [VECTOR-STORE] Réinitialisation de l\'index...');
      fs.rmSync(INDEX_PATH, { recursive: true, force: true });
      fs.mkdirSync(INDEX_PATH, { recursive: true });
    }

    vectorIndex = new LocalIndex(INDEX_PATH);
    if (!await vectorIndex.isIndexCreated()) {
      console.log('📦 [VECTOR-STORE] Création d\'un nouvel index...');
      await vectorIndex.createIndex();
    } else {
      console.log('✅ [VECTOR-STORE] Index existant chargé');
    }

    const stats = await getIndexStats();
    console.log(`📊 [VECTOR-STORE] ${stats.itemCount} chunk(s) indexé(s)`);
  } catch (error) {
    console.error('❌ [VECTOR-STORE] Erreur d\'initialisation:', error.message);
    throw error;
  }
}

/**
 * Ajoute un chunk avec son embedding
 */
export async function addChunk(chunk, embedding) {
  if (!vectorIndex) {
    throw new Error('Vector store not initialized');
  }

  try {
    await vectorIndex.insertItem({
      vector: embedding,
      metadata: {
        id: chunk.id,
        text: chunk.text,
        source: chunk.source,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        tokenCount: chunk.tokenCount,
        ...chunk.metadata
      }
    });
  } catch (error) {
    console.error(`❌ [VECTOR-STORE] Erreur ajout chunk ${chunk.id}:`, error.message);
    throw error;
  }
}

/**
 * Ajoute plusieurs chunks
 */
export async function addChunks(chunks, embeddings) {
  if (!vectorIndex) {
    throw new Error('Vector store not initialized');
  }

  if (chunks.length !== embeddings.length) {
    throw new Error('Chunks and embeddings arrays must have the same length');
  }

  console.log(`📥 [VECTOR-STORE] Indexation de ${chunks.length} chunk(s)...`);
  for (let i = 0; i < chunks.length; i++) {
    await addChunk(chunks[i], embeddings[i]);
  }
  console.log(`✅ [VECTOR-STORE] ${chunks.length} chunk(s) indexé(s) avec succès`);
}

/**
 * Vide complètement l'index
 */
export async function clearIndex() {
  if (!vectorIndex) {
    throw new Error('Vector store not initialized');
  }

  try {
    await vectorIndex.deleteIndex();
    await vectorIndex.createIndex();
    console.log('🗑️ [VECTOR-STORE] Index vidé et recréé');
  } catch (error) {
    console.error('❌ [VECTOR-STORE] Erreur vidage index:', error.message);
    throw error;
  }
}

/**
 * Obtient les statistiques de l'index
 */
export async function getIndexStats() {
  if (!vectorIndex) {
    throw new Error('Vector store not initialized');
  }

  try {
    const items = await vectorIndex.listItems();
    const sources = new Set(items.map(item => item.metadata.source));
    return {
      itemCount: items.length,
      sourceCount: sources.size,
      sources: Array.from(sources),
      indexPath: INDEX_PATH
    };
  } catch (error) {
    console.error('❌ [VECTOR-STORE] Erreur récupération stats:', error.message);
    return { itemCount: 0, sourceCount: 0, sources: [], indexPath: INDEX_PATH };
  }
}

export function getVectorIndex() {
  return vectorIndex;
}

