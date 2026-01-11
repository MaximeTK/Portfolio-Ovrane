/**
 * Fonctions utilitaires pour le serveur
 */
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES } from './messages.js';

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
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.assets} ${ERROR_MESSAGES.assetsFromFrontendError} ${msg}`);
    throw error;
  }
}

/**
 * (Les commandes UI ne sont plus parsées depuis le texte : elles passent exclusivement par des tool calls.)
 */

