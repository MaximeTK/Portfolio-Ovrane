/**
 * Serveur principal Venta
 */
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanInactiveTemporaryProfiles } from './lib/userMemory.js';
import { setOpenAI } from './lib/openaiHandler.js';
import { configureServer } from './lib/server/serverConfig.js';
import { initializeRAGSystem } from './lib/server/ragInitializer.js';
import { connectToDatabase } from './lib/database.js';
import { watchRAGFolder } from './lib/server/ragWatcher.js';
import { registerAllFunctions } from './lib/server/functionsRegistry.js';
import { setupRoutes } from './lib/server/serverRoutes.js';
import { logServerStart } from './lib/server/serverLogger.js';
import { CONSOLE_LOGS, EMOJIS } from './lib/messages.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3001;
const ragDir = path.join(__dirname, '..', 'rag');

let ragInitialized = false;

/**
 * Initialise le serveur
 */
async function initializeServer() {
  const { app, allowedOrigins } = configureServer();
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  setOpenAI(openai);
  
  // Connexion à MongoDB
  await connectToDatabase();

  registerAllFunctions();
  
  ragInitialized = await initializeRAGSystem(ragDir, process.env.OPENAI_API_KEY);
  watchRAGFolder(ragDir, ragInitialized);
  
  cleanInactiveTemporaryProfiles();
  setInterval(() => cleanInactiveTemporaryProfiles(), 60 * 60 * 1000);
  
  setupRoutes(app, openai, ragDir, ragInitialized, __dirname);
  
  return { app, allowedOrigins };
}

/**
 * Démarre le serveur
 */
async function startServer() {
  const { app, allowedOrigins } = await initializeServer();
  
  app.listen(PORT, '0.0.0.0', async () => {
    await logServerStart(PORT, ragInitialized, allowedOrigins);
  });
}

// Point d'entrée
startServer().catch(error => {
  console.error(`${EMOJIS.error} ${CONSOLE_LOGS.startup} Erreur critique:`, error.message);
  process.exit(1);
});
