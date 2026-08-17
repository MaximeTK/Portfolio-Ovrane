/**
 * Gestion des palettes de couleurs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONSOLE_LOGS, EMOJIS, SUCCESS_MESSAGES } from '../messages.js';
import { debug } from '../log.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Vérifie si une ligne est un header ou un ID de palette
 */
function isPaletteId(line) {
  const invalidStarts = ['LISTE', '⚠️', 'RÈGLES', 'EXEMPLES', 'Si l', '-', 'PALETTES'];
  return line && !line.includes(':') && 
         !invalidStarts.some(s => line.startsWith(s)) && 
         line.length < 20;
}

/**
 * Parse le fichier colors.txt
 */
function parseColorsFile(colorsPath) {
  const colorsContent = fs.readFileSync(colorsPath, 'utf8');
  const lines = colorsContent.split('\n');
  const colorsList = [];
  let currentPalette = {};
  
  // Un seul point de sortie : les deux push d'origine avaient déjà divergé,
  // la dernière palette sortait dans un format différent des 24 autres.
  const flush = () => {
    if (!currentPalette.id) return;
    const label = currentPalette.description || currentPalette.name || '';
    colorsList.push(`${currentPalette.id} — ${label}`);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (isPaletteId(line)) {
      flush();
      currentPalette = { id: line };
    }
    
    if (line.startsWith('Nom :')) {
      currentPalette.name = line.replace('Nom :', '').trim();
    }
    if (line.startsWith('Description :')) {
      currentPalette.description = line.replace('Description :', '').trim();
    }
  }
  
  flush();

  return colorsList;
}

/**
 * Retourne la liste des couleurs disponibles
 */
export function getAvailableColors() {
  debug(`\n🔵 [FUNCTION START] getAvailableColors | Aucun paramètre`);
  
  try {
    debug(`${EMOJIS.picture} ${CONSOLE_LOGS.functionCall} Récupération des couleurs disponibles`);
    
    const colorsPath = path.join(__dirname, '..', '..', '..', 'rag', 'colors.txt');
    
    if (!fs.existsSync(colorsPath)) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Fichier colors.txt non trouvé`);
      const result = { success: false, message: "Fichier colors.txt non trouvé" };
      debug(`❌ [FUNCTION END] getAvailableColors | Retour: fichier non trouvé\n`);
      return result;
    }
    
    const colorsList = parseColorsFile(colorsPath);
    
    debug(`${EMOJIS.success} ${CONSOLE_LOGS.functionCall} Liste des couleurs récupérée (${colorsList.length} palettes)`);
    
    const result = {
      success: true,
      colors: colorsList,
      message: `${colorsList.length} palettes de couleurs disponibles. Si l'utilisateur souhaite CHANGER le fond, appelle uiSetBackground({ paletteId }) avec l'ID exact. Sinon, ne change rien.`
    };
    debug(`✅ [FUNCTION END] getAvailableColors | Retour: success=true, ${colorsList.length} palettes\n`);
    return result;
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Erreur récupération couleurs:`, error.message);
    const result = { success: false, message: `Erreur: ${error.message}` };
    debug(`❌ [FUNCTION END] getAvailableColors | Retour: error="${error.message}"\n`);
    return result;
  }
}

