/**
 * Module d'embeddings pour le système RAG - max 5 fonctions, max 20 lignes
 */
import OpenAI from 'openai';

let openaiClient = null;

/**
 * Initialise le client OpenAI
 */
export function initializeEmbeddings(apiKey) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required for embeddings');
  }
  openaiClient = new OpenAI({ apiKey });
}

/**
 * Génère un embedding pour un texte
 */
export async function generateEmbedding(text, model = 'text-embedding-3-small') {
  if (!openaiClient) {
    throw new Error('Embeddings not initialized. Call initializeEmbeddings() first.');
  }
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty for embedding generation');
  }

  try {
    const response = await openaiClient.embeddings.create({
      model,
      input: text.trim(),
      encoding_format: 'float'
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ [EMBEDDINGS] Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Génère des embeddings pour plusieurs textes (par batch)
 */
export async function generateEmbeddings(texts, model = 'text-embedding-3-small', batchSize = 100) {
  if (!openaiClient) {
    throw new Error('Embeddings not initialized. Call initializeEmbeddings() first.');
  }

  const embeddings = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await processBatch(batch, model, i, texts.length, batchSize);
    embeddings.push(...batchEmbeddings);
  }
  return embeddings;
}

async function processBatch(batch, model, currentIndex, totalLength, batchSize) {
  try {
    const response = await openaiClient.embeddings.create({
      model,
      input: batch.map(t => t.trim()),
      encoding_format: 'float'
    });
    const batchEmbeddings = response.data.map(item => item.embedding);
    console.log(`✅ [EMBEDDINGS] Batch ${Math.floor(currentIndex / batchSize) + 1}/${Math.ceil(totalLength / batchSize)} processed`);
    return batchEmbeddings;
  } catch (error) {
    console.error(`❌ [EMBEDDINGS] Error in batch ${currentIndex}-${currentIndex + batchSize}:`, error.message);
    throw error;
  }
}

/**
 * Calcule la similarité cosinus entre deux vecteurs
 */
export function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}
