/**
 * Exécution des outils (function calling)
 */
import { CONSOLE_LOGS, EMOJIS } from '../messages.js';

// Variable globale pour les fonctions disponibles
const availableFunctions = {};

/**
 * Enregistre une fonction
 */
export function registerFunction(name, handler) {
  availableFunctions[name] = handler;
}

/**
 * Détermine comment appeler une fonction selon son nom
 */
function callFunction(functionName, functionToCall, functionArgs) {
  const noParamFunctions = ['getRulePicture', 'getAvailableAssets', 'getAvailableColors'];
  const userFunctions = ['checkUser', 'SwitchUserProfile'];
  
  if (noParamFunctions.includes(functionName)) {
    return functionToCall();
  }
  
  if (userFunctions.includes(functionName)) {
    return functionToCall(functionArgs);
  }
  
  return functionToCall(functionArgs);
}

/**
 * Formate la réponse d'une fonction
 */
function formatFunctionResponse(functionName, functionResponse) {
  if (functionName === 'getRulePicture' && functionResponse.success) {
    return functionResponse.instructions;
  }
  
  if (functionName === 'getAvailableAssets' && functionResponse.success) {
    return `✅ LISTE DES IMAGES DISPONIBLES:
${functionResponse.assets.join('\n')}

🎯 INSTRUCTIONS IMPORTANTES:
- Tu dois déclencher l'affichage d'image via un TOOL: uiShowPicture({ filenames: [...] })
- filenames doit être un NOM EXACT issu de la liste ci-dessus (casse/espaces/extensions)
- Si tu dois afficher plusieurs images, fais UN SEUL appel uiShowPicture({ filenames: ["...","..."] })
- N'écris PAS de slash-commandes dans le texte
- N'APPELLE PLUS getAvailableAssets() - tu as déjà toutes les informations nécessaires`;
  }
  
  if (functionName === 'getAvailableColors' && functionResponse.success) {
    return `✅ LISTE DES PALETTES DE COULEURS DISPONIBLES:
${functionResponse.colors.join('\n')}

🎯 INSTRUCTIONS IMPORTANTES:
- Ne déclenche un changement de fond via un TOOL (uiSetBackground({ paletteId })) QUE si l'utilisateur le demande explicitement
- paletteId doit être un ID EXACT issu de la liste ci-dessus
- N'écris PAS de slash-commandes dans le texte
- N'APPELLE PLUS getAvailableColors() - tu as déjà toutes les informations nécessaires`;
  }
  
  const userFunctions = ['checkUser', 'SwitchUserProfile'];
  if (userFunctions.includes(functionName)) {
    return functionResponse.message || JSON.stringify(functionResponse);
  }
  
  return JSON.stringify(functionResponse);
}

/**
 * Exécute un outil
 */
export async function executeToolCall(toolCall) {
  const functionName = toolCall.function.name;
  const functionArgs = JSON.parse(toolCall.function.arguments);
  
  console.log(`   ${EMOJIS.subitem} ${CONSOLE_LOGS.openaiFunction} ${functionName}`);
  console.log(`   ${EMOJIS.subitem} ${CONSOLE_LOGS.openaiArguments} ${JSON.stringify(functionArgs)}`);
  
  const functionToCall = availableFunctions[functionName];
  if (!functionToCall) {
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      name: functionName,
      content: JSON.stringify({
        success: false,
        message: `Tool indisponible: ${functionName}. Tools autorisés pour profils: checkUser, SwitchUserProfile.`,
      }),
    };
  }
  const functionResponse = await callFunction(functionName, functionToCall, functionArgs);
  const content = formatFunctionResponse(functionName, functionResponse);
  
  return {
    role: 'tool',
    tool_call_id: toolCall.id,
    name: functionName,
    content: content
  };
}

