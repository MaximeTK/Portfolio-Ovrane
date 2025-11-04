/**
 * Affichage des informations de démarrage du serveur
 */
import os from 'os';
import { getSystemStats } from '../rag/ragSystem.js';
import { CONSOLE_LOGS, EMOJIS, createSeparator } from '../messages.js';

/**
 * Affiche les statistiques RAG
 */
async function logRAGStats(ragInitialized) {
  if (ragInitialized) {
    try {
      const stats = await getSystemStats();
      console.log(`📚 ${CONSOLE_LOGS.serverRAGSystem}     ${EMOJIS.success} ${CONSOLE_LOGS.serverRAGActivated} (${stats.index.itemCount} ${CONSOLE_LOGS.serverRAGChunksIndexed})`);
      console.log(`   ${EMOJIS.subitem} ${CONSOLE_LOGS.serverRAGSources}      ${stats.index.sources.join(', ')}`);
      console.log(`   ${EMOJIS.subitem} ${CONSOLE_LOGS.serverRAGConfig}       chunks=${stats.config.chunkSize}tok, overlap=${stats.config.overlap}tok, topK=${stats.config.topK}`);
    } catch (error) {
      console.log(`📚 ${CONSOLE_LOGS.serverRAGSystem}     ${EMOJIS.success} ${CONSOLE_LOGS.serverRAGActivated} (${CONSOLE_LOGS.serverStatsNotAvailable})`);
    }
  } else {
    console.log(`📚 ${CONSOLE_LOGS.serverRAGSystem}     ${EMOJIS.loading} ${CONSOLE_LOGS.serverRAGInitializing}`);
  }
}

/**
 * Affiche les adresses réseau disponibles
 */
function logNetworkAddresses(port) {
  const networkInterfaces = os.networkInterfaces();
  console.log(`💡 ${CONSOLE_LOGS.serverNetworkAccess}`);
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`   ${EMOJIS.arrow} http://${iface.address}:${port}`);
      }
    });
  });
}

/**
 * Affiche les informations de démarrage
 */
export async function logServerStart(port, ragInitialized, allowedOrigins) {
  console.log(`\n${createSeparator()}`);
  console.log(`${EMOJIS.rocket} ${CONSOLE_LOGS.serverStarted}`);
  console.log(createSeparator());
  console.log(`📍 ${CONSOLE_LOGS.serverLocal}           http://localhost:${port}`);
  console.log(`📍 ${CONSOLE_LOGS.serverNetwork}    http://[ton-ip-locale]:${port}`);
  console.log(`📍 ${CONSOLE_LOGS.serverNgrok}  Démarre avec: ngrok http ${port}`);
  console.log(createSeparator());
  
  await logRAGStats(ragInitialized);
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  console.log(`🎨 ${CONSOLE_LOGS.serverAssets} ${CONSOLE_LOGS.serverAssetsLoadedOnRequest} ${frontendUrl}`);
  console.log(`🌐 ${CONSOLE_LOGS.serverCORSFrontend}   ${allowedOrigins.join(', ')}`);
  console.log(`${createSeparator()}\n`);
  
  logNetworkAddresses(port);
  console.log('\n');
}

