/**
 * Gestion du contexte de requête
 */

// Variables globales
let currentRequestContext = null;

/**
 * Définit le contexte de la requête courante
 */
export function setRequestContext(context) {
  currentRequestContext = context;
}

/**
 * Récupère le contexte mis à jour
 */
export function getRequestContext() {
  return currentRequestContext;
}

