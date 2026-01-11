/**
 * Gestion des assets et visuels
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../messages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Lit et parse le fichier assets.txt
 */
function parseAssetsFile(assetsPath) {
  const assetsContent = fs.readFileSync(assetsPath, 'utf8');
  const lines = assetsContent.split('\n');
  const assetsList = [];
  let currentFile = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.match(/^[\w\s]+\.(png|svg|json|lottie|webm)(\s*\/\s*[\w\s]+\.(png|svg|json|lottie|webm))*$/)) {
      currentFile = line.split('/')[0].trim();
    }
    
    if (line.startsWith('Description :') && currentFile) {
      const description = line.replace('Description :', '').trim();
      assetsList.push(`${currentFile} - ${description}`);
      currentFile = null;
    }
  }
  
  return assetsList;
}

/**
 * Extraction simple des assets (fallback)
 */
function extractAssetsSimple(lines) {
  return lines.filter(line => {
    const trimmed = line.trim();
    return /\.(png|svg|json|lottie|webm)/.test(trimmed);
  });
}

/**
 * Retourne la liste des assets disponibles
 */
export function getAvailableAssets() {
  console.log(`\n🔵 [FUNCTION START] getAvailableAssets | Aucun paramètre`);
  
  try {
    console.log(`${EMOJIS.picture} ${CONSOLE_LOGS.functionCall} ${CONSOLE_LOGS.assetsRetrieving}`);
    
    const assetsPath = path.join(__dirname, '..', '..', '..', 'rag', 'assets.txt');
    
    if (!fs.existsSync(assetsPath)) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} ${ERROR_MESSAGES.assetsFileNotFound}`);
      const result = { success: false, message: ERROR_MESSAGES.assetsFileNotFound };
      console.log(`❌ [FUNCTION END] getAvailableAssets | Retour: fichier non trouvé\n`);
      return result;
    }
    
    const assetsList = parseAssetsFile(assetsPath);
    
    if (assetsList.length === 0) {
      console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.functionCall} Format inattendu dans assets.txt, extraction simple`);
      const lines = fs.readFileSync(assetsPath, 'utf8').split('\n');
      assetsList.push(...extractAssetsSimple(lines));
    }
    
    console.log(`${EMOJIS.success} ${CONSOLE_LOGS.functionCall} ${SUCCESS_MESSAGES.assetsListRetrieved} (${assetsList.length} fichiers)`);
    
    const result = {
      success: true,
      assets: assetsList,
      instructions: "Déclenche l'affichage via uiShowPicture({ filename }) avec un nom EXACT issu de la liste (sensible à la casse).",
      message: `${assetsList.length} assets disponibles. Pour afficher une image, appelle uiShowPicture({ filename }) avec le nom exact.`
    };
    console.log(`✅ [FUNCTION END] getAvailableAssets | Retour: success=true, ${assetsList.length} assets\n`);
    return result;
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} ${ERROR_MESSAGES.assetsRetrievalError}`, error.message);
    const result = { success: false, message: `Erreur: ${error.message}` };
    console.log(`❌ [FUNCTION END] getAvailableAssets | Retour: error="${error.message}"\n`);
    return result;
  }
}

/**
 * Retourne les règles d'affichage d'images
 */
export function getRulePicture() {
  console.log(`\n🔵 [FUNCTION START] getRulePicture | Aucun paramètre`);
  
  try {
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.functionCall} Récupération des règles d'affichage d'images`);
    
    const instructions = `⚠️ RÈGLES D'AFFICHAGE D'IMAGES ⚠️

Tu PEUX afficher des images via un TOOL: uiShowPicture({ filename }).

PROCESSUS À SUIVRE:
1. Si tu n'as pas encore appelé getAvailableAssets(), appelle-le MAINTENANT pour obtenir la liste des images disponibles.
2. Choisis un filename EXACT depuis la liste (casse, espaces, extensions).
3. Déclenche l'affichage avec uiShowPicture({ filename }).
4. Si l'image demandée n'existe pas dans la liste, dis-le clairement et n'appelle PAS uiShowPicture.

RÈGLES IMPORTANTES:
- N'appelle getAvailableAssets() qu'UNE SEULE FOIS maximum par conversation.
- N'écris JAMAIS de slash-commandes dans le texte.

MULTIPLE IMAGES:
- Tu peux appeler uiShowPicture plusieurs fois si tu veux afficher plusieurs images.
- Fais une phrase d'introduction globale, puis déclenche les affichages via tools (pas dans le texte).`;

    console.log(`${EMOJIS.success} ${CONSOLE_LOGS.functionCall} Instructions d'affichage d'images fournies`);
    
    const result = { success: true, instructions: instructions, message: instructions };
    console.log(`✅ [FUNCTION END] getRulePicture | Retour: success=true, instructions fournies\n`);
    return result;
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Erreur getRulePicture:`, error.message);
    const result = { success: false, message: `Erreur: ${error.message}` };
    console.log(`❌ [FUNCTION END] getRulePicture | Retour: error="${error.message}"\n`);
    return result;
  }
}

