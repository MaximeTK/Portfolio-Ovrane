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
 * Extrait les commandes de la réponse
 */
export function extractCommands(response) {
  // Commandes: "/Command param..."
  // - Doit être en début de texte OU précédée d'un whitespace (évite les URLs type https://)
  // - Le paramètre s'arrête avant la prochaine commande (si plusieurs sur la même ligne)
  // - Ne traverse pas les retours à la ligne
  const commandRegex = /(^|\s)\/(\w+)\s*([^\n\r]*?)(?=(?:\s\/\w+)|$|\n|\r)/g;
  const commands = [];
  let cleanResponse = response;
  let match;
  
  while ((match = commandRegex.exec(response)) !== null) {
    const prefix = match[1] || '';
    const command = match[2];
    const rawParameter = (match[3] || '').trim();

    let parameter = rawParameter;
    let replacementText = '';
    let shouldStoreCommand = true;

    // Cas particuliers pour /ShowPicture ou /ShowImage : on doit isoler le nom de fichier
    // et conserver le reste du texte (ex: "/ShowPicture Pico Logo.png, puis il s'enfuit")
    if (['showpicture', 'showimage'].includes(command.toLowerCase())) {
      const fileMatch = rawParameter.match(
        /([a-zA-Z0-9 _.\-()]+?\.(?:png|jpe?g|gif|webp|svg))(?![a-zA-Z0-9_])/i,
      );
      if (fileMatch) {
        parameter = fileMatch[1].trim();

        // Si la commande est écrite avec guillemets, on les retire du paramètre
        parameter = parameter
          .replace(/^[\"'`“”«»]+/, '')
          .replace(/[\"'`“”«»]+$/, '')
          .trim();

        const trailing = rawParameter.slice((fileMatch.index ?? 0) + fileMatch[1].length);
        // Ne pas réinjecter les guillemets fermants dans le texte
        replacementText = trailing
          .trimStart()
          .replace(/^[\"'`“”«»]+/, '')
          .trimStart();
      } else {
        // Paramètre invalide : on ne traite pas comme une commande image (évite /assets/ vide)
        // On réinjecte le texte tel quel.
        shouldStoreCommand = false;
        replacementText = rawParameter.trimStart();
      }
    }

    if (shouldStoreCommand) {
      commands.push({
        command,
        parameter
      });
    }

    // On enlève uniquement la partie commande, mais on réinjecte le texte qui suit le nom de fichier
    const injectedText = replacementText ? `${prefix}${replacementText}` : prefix;
    cleanResponse = cleanResponse.replace(match[0], injectedText);
  }
  
  return {
    commands,
    cleanResponse: cleanResponse
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  };
}

