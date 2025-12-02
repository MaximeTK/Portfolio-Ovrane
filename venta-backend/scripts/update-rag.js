/**
 * Script de mise à jour manuelle du RAG
 * À lancer localement quand les fichiers textes sont modifiés.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeRAG, reindexFolder } from '../src/lib/rag/ragSystem.js';
import { EMOJIS, CONSOLE_LOGS, SUCCESS_MESSAGES } from '../src/lib/messages.js';

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
    // 1. Initialisation
    console.log(`${CONSOLE_LOGS.ragInitializing}`);
    await initializeRAG(process.env.OPENAI_API_KEY, {
      chunkSize: 500, 
      overlap: 100, 
      topK: 5, 
      minScore: 0.5
    });

    // 2. Réindexation forcée (true)
    console.log(`\n${EMOJIS.wait} Analyse et indexation des fichiers dans : ${ragDir}`);
    await reindexFolder(ragDir, true);
    
    console.log(`\n${EMOJIS.success} ${SUCCESS_MESSAGES.ragInitialized}`);
    console.log(`${EMOJIS.info} L'index a été mis à jour dans /data/vector-index.`);
    console.log(`${EMOJIS.info} N'oublie pas de faire un commit Git pour envoyer le nouvel index en production !`);
    
  } catch (error) {
    console.error(`\n${EMOJIS.error} Erreur critique lors de la mise à jour :`, error);
    process.exit(1);
  }
}

updateRagManual();

