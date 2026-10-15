/**
 * Script de mise à jour manuelle du RAG
 * Embedde les passages nouveaux ou modifiés des .md de rag/ et les persiste dans MongoDB (MONGODB_DB).
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { connectToDatabase } from '../src/lib/database.js';
import { initializeRAG, reindexFolder } from '../src/lib/rag/ragSystem.js';
import { EMOJIS } from '../src/lib/messages.js';

// Configuration de l'environnement
dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ragDir = path.join(__dirname, '..', 'rag');

async function updateRagManual() {
  console.log(`\n${EMOJIS.rocket} Démarrage de la mise à jour manuelle du RAG...\n`);

  if (!process.env.OPENAI_API_KEY) {
    console.error(`${EMOJIS.error} Erreur : OPENAI_API_KEY manquante dans le fichier .env`);
    process.exit(1);
  }

  try {
    await connectToDatabase();
    initializeRAG(process.env.OPENAI_API_KEY);
    const result = await reindexFolder(ragDir);
    if (!result.success) process.exit(1);
    console.log(result.persisted
      ? `\n${EMOJIS.success} Embeddings synchronisés dans la base ${process.env.MONGODB_DB} (collection rag_chunks).`
      : `\n${EMOJIS.warning} MongoDB non connecté : les embeddings n'ont pas été persistés.`);
    await mongoose.disconnect();
  } catch (error) {
    console.error(`\n${EMOJIS.error} Erreur critique lors de la mise à jour :`, error);
    process.exit(1);
  }
}

updateRagManual();
