/**
 * Enregistrement des fonctions disponibles pour function calling
 */
import { registerFunction } from '../openaiHandler.js';
import { 
  getRulePicture, 
  getAvailableAssets, 
  getAvailableColors, 
  uiShowPicture,
  uiSetBackground,
  uiShowCode,
  uiOpenWindow,
  checkUser, 
  SwitchUserProfile 
} from '../ragHelpers.js';

/**
 * Enregistre toutes les fonctions disponibles
 */
export function registerAllFunctions() {
  registerFunction('getRulePicture', getRulePicture);
  registerFunction('getAvailableAssets', getAvailableAssets);
  registerFunction('getAvailableColors', getAvailableColors);
  registerFunction('uiShowPicture', uiShowPicture);
  registerFunction('uiSetBackground', uiSetBackground);
  registerFunction('uiShowCode', uiShowCode);
  registerFunction('uiOpenWindow', uiOpenWindow);
  registerFunction('checkUser', checkUser);
  registerFunction('SwitchUserProfile', SwitchUserProfile);
}

