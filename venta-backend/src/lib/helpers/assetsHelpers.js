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
      instructions: "Utilise /ShowPicture suivi du nom exact du fichier (sensible à la casse). Exemples: /ShowPicture exemple.png ou /ShowPicture Pico Interface.png",
      message: `${assetsList.length} assets disponibles. Pour afficher une image, utilise la commande /ShowPicture suivie du nom du fichier.`
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

Tu PEUX afficher des images avec la commande /ShowPicture suivie du nom de l'image.

PROCESSUS À SUIVRE:
1. Si tu n'as pas encore appelé getAvailableAssets(), appelle-le MAINTENANT pour obtenir la liste des images disponibles.
2. Une fois que tu as la liste des assets, génère ta réponse avec la commande /ShowPicture suivie du nom EXACT du fichier.
3. Si l'image demandée n'existe pas dans la liste, dis-le clairement et ne génère PAS de commande /ShowPicture.

RÈGLES IMPORTANTES:
- N'appelle getAvailableAssets() qu'UNE SEULE FOIS maximum par conversation.
- Utilise TOUJOURS le nom exact du fichier (sensible à la casse).
- La commande /ShowPicture doit être dans ta réponse finale à l'utilisateur.

MULTIPLE IMAGES:
- Tu peux afficher plusieurs images dans UN SEUL message en ajoutant plusieurs commandes à la fin de ton texte.
- NE FAIS PAS UNE PHRASE PAR IMAGE. Fais une phrase d'introduction globale, puis liste les commandes.
- Exemple CORRECT: "Voici les images que tu as demandées : les interfaces et le logo. /ShowPicture interface.png /ShowPicture logo.png"
- Exemple INCORRECT: "Voici l'interface. /ShowPicture interface.png. Et voici le logo. /ShowPicture logo.png"

EXEMPLES:
✅ BON: "Regarde cette image ! /ShowPicture Pico Interface.png"
✅ BON: "Voici le logo Pico et son interface. /ShowPicture Pico Logo.png /ShowPicture Pico Interface.png"
❌ MAUVAIS: "Voici le logo. /ShowPicture Pico Logo.png. Et voici l'interface. /ShowPicture Pico Interface.png" (Trop verbeux)
❌ MAUVAIS: Utiliser /ShowPicture sans avoir vérifié que l'image existe`;

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

