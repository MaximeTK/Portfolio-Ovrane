/**
 * Ingestion de documents dans le RAG - max 5 fonctions, max 20 lignes
 */
import { chunkDocuments, deduplicateChunks } from './chunker.js';
import { generateEmbeddings } from './embeddings.js';
import { addChunks, getIndexStats, clearIndex } from './vectorStore.js';
import { getConfig, getInitializedStatus } from './ragInit.js';

/**
 * Ingère des documents dans le système RAG
 */
export async function ingestDocuments(documents, clearExisting = false) {
  if (!getInitializedStatus()) {
    throw new Error('RAG system not initialized. Call initializeRAG() first.');
  }

  console.log(`\n📚 [RAG-SYSTEM] Ingestion de ${documents.length} document(s)...`);
  
  try {
    if (clearExisting) {
      await clearIndex();
      console.log('🗑️ [RAG-SYSTEM] Index vidé');
    }

    const chunks = await processAndIndexChunks(documents);
    return buildIngestionStats(documents, chunks);
  } catch (error) {
    console.error('❌ [RAG-SYSTEM] Erreur d\'ingestion:', error.message);
    throw error;
  }
}

async function processAndIndexChunks(documents) {
  const config = getConfig();
  console.log('✂️ [RAG-SYSTEM] Chunking des documents...');
  let chunks = chunkDocuments(documents, config.chunkSize, config.overlap);
  console.log(`✅ [RAG-SYSTEM] ${chunks.length} chunk(s) créé(s)`);
  
  const originalCount = chunks.length;
  chunks = deduplicateChunks(chunks);
  if (chunks.length < originalCount) {
    console.log(`🔄 [RAG-SYSTEM] ${originalCount - chunks.length} duplicata(s) supprimé(s)`);
  }
  
  console.log('🧠 [RAG-SYSTEM] Génération des embeddings...');
  const texts = chunks.map(chunk => chunk.text);
  const embeddings = await generateEmbeddings(texts, config.embeddingModel);
  console.log(`✅ [RAG-SYSTEM] ${embeddings.length} embedding(s) généré(s)`);
  
  await addChunks(chunks, embeddings);
  return chunks;
}

async function buildIngestionStats(documents, chunks) {
  const stats = await getIndexStats();
  console.log('\n📊 [RAG-SYSTEM] Ingestion terminée:');
  console.log(`   └─ ${stats.itemCount} chunk(s) au total`);
  console.log(`   └─ ${stats.sourceCount} source(s): ${stats.sources.join(', ')}\n`);
  
  return {
    success: true,
    documentsProcessed: documents.length,
    chunksCreated: chunks.length,
    chunksIndexed: stats.itemCount,
    sources: stats.sources
  };
}

