/**
 * Enregistrement des fonctions disponibles pour function calling
 */
import { registerFunction } from '../openaiHandler.js';
import { 
  searchKnowledgeBase, 
  getRulePicture, 
  getAvailableAssets, 
  getAvailableColors, 
  checkUser, 
  CreateUserProfile, 
  UpdateUserProfile, 
  SwitchUserProfile 
} from '../ragHelpers.js';

/**
 * Enregistre toutes les fonctions disponibles
 */
export function registerAllFunctions() {
  registerFunction('searchKnowledgeBase', searchKnowledgeBase);
  registerFunction('getRulePicture', getRulePicture);
  registerFunction('getAvailableAssets', getAvailableAssets);
  registerFunction('getAvailableColors', getAvailableColors);
  registerFunction('checkUser', checkUser);
  registerFunction('CreateUserProfile', CreateUserProfile);
  registerFunction('UpdateUserProfile', UpdateUserProfile);
  registerFunction('SwitchUserProfile', SwitchUserProfile);
}

