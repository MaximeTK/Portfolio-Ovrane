/**
 * Gestion des palettes de couleurs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONSOLE_LOGS, EMOJIS, SUCCESS_MESSAGES } from '../messages.js';

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
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (isPaletteId(line)) {
      if (currentPalette.id) {
        colorsList.push(`${currentPalette.id} - ${currentPalette.name || ''} - ${currentPalette.description || ''}`);
      }
      currentPalette = { id: line };
    }
    
    if (line.startsWith('Nom :')) {
      currentPalette.name = line.replace('Nom :', '').trim();
    }
    if (line.startsWith('Description :')) {
      currentPalette.description = line.replace('Description :', '').trim();
    }
  }
  
  if (currentPalette.id) {
    colorsList.push(`${currentPalette.id} - ${currentPalette.name || ''} - ${currentPalette.description || ''}`);
  }
  
  return colorsList;
}

/**
 * Retourne la liste des couleurs disponibles
 */
export function getAvailableColors() {
  console.log(`\n🔵 [FUNCTION START] getAvailableColors | Aucun paramètre`);
  
  try {
    console.log(`${EMOJIS.picture} ${CONSOLE_LOGS.functionCall} Récupération des couleurs disponibles`);
    
    const colorsPath = path.join(__dirname, '..', '..', '..', 'rag', 'colors.txt');
    
    if (!fs.existsSync(colorsPath)) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Fichier colors.txt non trouvé`);
      const result = { success: false, message: "Fichier colors.txt non trouvé" };
      console.log(`❌ [FUNCTION END] getAvailableColors | Retour: fichier non trouvé\n`);
      return result;
    }
    
    const colorsList = parseColorsFile(colorsPath);
    
    console.log(`${EMOJIS.success} ${CONSOLE_LOGS.functionCall} Liste des couleurs récupérée (${colorsList.length} palettes)`);
    
    const result = {
      success: true,
      colors: colorsList,
      instructions: "Utilise /SetBackground suivi de l'ID de la palette. Exemples: /SetBackground ocean ou /SetBackground sunset",
      message: `${colorsList.length} palettes de couleurs disponibles. Pour changer le fond, utilise la commande /SetBackground suivie de l'ID de la palette.`
    };
    console.log(`✅ [FUNCTION END] getAvailableColors | Retour: success=true, ${colorsList.length} palettes\n`);
    return result;
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Erreur récupération couleurs:`, error.message);
    const result = { success: false, message: `Erreur: ${error.message}` };
    console.log(`❌ [FUNCTION END] getAvailableColors | Retour: error="${error.message}"\n`);
    return result;
  }
}

