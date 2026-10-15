/**
 * Démarrage : configuration, MongoDB, RAG puis écoute ; sans configuration valide ni base, le serveur s'arrête
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import { config } from './config.js';
import { createApp } from './app.js';
import { initializeRAG, reindexFolder } from './services/rag/ragSystem.js';
import { conserver } from './services/conservation.js';
import * as log from './log.js';

if (config.erreurs.length) {
  for (const erreur of config.erreurs) log.error('[DÉMARRAGE]', erreur);
  process.exit(1);
}

try {
  await mongoose.connect(config.mongodbUri, { dbName: config.mongodbDb });
} catch (error) {
  log.error('[DÉMARRAGE] Connexion MongoDB impossible :', error.message);
  process.exit(1);
}
log.info(`[DÉMARRAGE] Base MongoDB : ${config.mongodbDb}`);

// 90 jours sans activité : purge au démarrage puis chaque jour ; un échec attend le lendemain
async function purgerChaqueJour() {
  try {
    log.info(`[CONSERVATION] ${config.conservationJours} jours sans activité :`, JSON.stringify(await conserver()));
  } catch (error) {
    log.error('[CONSERVATION] Purge impossible :', error.message);
  }
}
await purgerChaqueJour();
setInterval(purgerChaqueJour, 86_400_000).unref();

// Un appel bloqué ne retient pas la requête au-delà d'une minute
const openai = new OpenAI({ apiKey: config.openaiApiKey, timeout: 60_000, maxRetries: 1 });
const ragDir = fileURLToPath(new URL('../rag', import.meta.url));
initializeRAG(openai);

// Seuls les passages nouveaux ou modifiés sont embeddés ; un échec laisse le chat sans RAG
async function indexer() {
  try {
    await reindexFolder(ragDir);
  } catch (error) {
    log.error('[RAG] Indexation impossible :', error.message);
  }
}
await indexer();

// Réindexation une seconde après la dernière modification d'un .md, jamais deux à la fois
let minuteur = null;
let enCours = false;
fs.watch(ragDir, (evenement, fichier) => {
  if (!fichier?.endsWith('.md')) return;
  clearTimeout(minuteur);
  minuteur = setTimeout(async () => {
    if (enCours) return;
    enCours = true;
    await indexer();
    enCours = false;
  }, 1000);
});

createApp({ openai }).listen(config.port, '0.0.0.0', () => log.info(`🚀 [DÉMARRAGE] Serveur Venta à l'écoute sur le port ${config.port}`));
