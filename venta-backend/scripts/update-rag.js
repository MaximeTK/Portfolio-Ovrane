/**
 * Mise à jour manuelle du RAG : embedde les passages nouveaux ou modifiés de rag/ et les persiste dans MONGODB_DB
 */
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import { config } from '../src/config.js';
import { initializeRAG, reindexFolder } from '../src/services/rag/ragSystem.js';

if (!config.openaiApiKey || !config.mongodbUri || !config.mongodbDb) {
  console.error('❌ OPENAI_API_KEY, MONGODB_URI et MONGODB_DB sont requis.');
  process.exit(1);
}

try {
  await mongoose.connect(config.mongodbUri, { dbName: config.mongodbDb });
  initializeRAG(new OpenAI({ apiKey: config.openaiApiKey }));
  const result = await reindexFolder(fileURLToPath(new URL('../rag', import.meta.url)));
  if (!result.success) process.exit(1);
  console.log(`\n✅ Embeddings synchronisés dans la base ${config.mongodbDb} (collection rag_chunks).`);
  await mongoose.disconnect();
} catch (error) {
  console.error('\n❌ Mise à jour du RAG impossible :', error.message);
  process.exit(1);
}
