/**
 * Point d'entrée centralisé pour les helpers RAG
 * Réexporte les fonctions depuis les modules spécialisés
 */

// Contexte
export { setRequestContext, getRequestContext } from './helpers/contextHelpers.js';

// Recherche
// searchKnowledgeBase retiré (RAG injecté côté backend, tool supprimé)

// Assets et visuels
export { getAvailableAssets, getRulePicture } from './helpers/assetsHelpers.js';

// Couleurs
export { getAvailableColors } from './helpers/colorsHelpers.js';

// Commandes UI (tools)
export {
  uiShowPicture,
  uiSetBackground,
  uiShowCode,
  uiOpenWindow,
} from './helpers/uiCommandsHelpers.js';

// Gestion utilisateurs - Wrappers pour passer le contexte automatiquement
import { checkUser as _checkUser } from './helpers/userCheckHelpers.js';
import { CreateUserProfile as _CreateUserProfile } from './helpers/userCreateHelpers.js';
import { UpdateUserProfile as _UpdateUserProfile } from './helpers/userUpdateHelpers.js';
import { SwitchUserProfile as _SwitchUserProfile } from './helpers/userSwitchHelpers.js';
import { getRequestContext } from './helpers/contextHelpers.js';

export async function checkUser(params) {
  return await _checkUser(params, getRequestContext());
}

export async function CreateUserProfile(params) {
  return await _CreateUserProfile(params, getRequestContext());
}

export async function UpdateUserProfile(params) {
  return await _UpdateUserProfile(params, getRequestContext());
}

export async function SwitchUserProfile(params) {
  return await _SwitchUserProfile(params, getRequestContext());
}
