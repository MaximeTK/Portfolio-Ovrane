/**
 * Fonctions utilitaires pour le serveur
 */
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES, MISC_MESSAGES } from './messages.js';

/**
 * Charge les assets depuis le frontend
 */
export async function loadAssetsFromFrontend(frontendUrl) {
  try {
    const response = await fetch(`${frontendUrl}/api/frontend/assets`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    if (data.success && data.assets && Array.isArray(data.assets)) {
      return data.assets;
    }
    throw new Error(data.error || ERROR_MESSAGES.assetLoadError);
  } catch (error) {
    console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.assets} ${ERROR_MESSAGES.assetsFromFrontendError} ${error.message}`);o
  }
}

/**
 * Extrait les commandes de la réponse
 */
export function extractCommands(response) {
  const commandRegex = /\/(\w+)\s*([^\n\r]*)/g;
  const commands = [];
  let cleanResponse = response;
  let match;
  
  while ((match = commandRegex.exec(response)) !== null) {
    const command = match[1];
    const parameter = (match[2] || '').trim();

    commands.push({
      command,
      parameter
    });

    cleanResponse = cleanResponse.replace(match[0], '').trim();
  }
  
  return { commands, cleanResponse };
}

