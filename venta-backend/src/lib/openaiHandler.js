/**
 * Point d'entrée centralisé pour la gestion OpenAI
 * Réexporte les fonctions depuis les modules spécialisés
 */

// Variable globale pour l'instance OpenAI
let openaiInstance = null;

/**
 * Définit l'instance OpenAI
 */
export function setOpenAI(openai) {
  openaiInstance = openai;
}

/**
 * Récupère l'instance OpenAI
 */
export function getOpenAI() {
  return openaiInstance;
}

// Réexporter les fonctions principales
export { callOpenAI } from './openai/callHandler.js';
export { registerFunction } from './openai/toolExecutor.js';
