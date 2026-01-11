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
  const singleParamFunctions = ['searchKnowledgeBase'];
  const userFunctions = ['checkUser', 'CreateUserProfile', 'UpdateUserProfile', 'SwitchUserProfile'];
  
  if (noParamFunctions.includes(functionName)) {
    return functionToCall();
  }
  
  if (singleParamFunctions.includes(functionName)) {
    return functionToCall(functionArgs.query);
  }
  
  if (userFunctions.includes(functionName)) {
    
    // Validation spécifique pour UpdateUserProfile
    if (functionName === 'UpdateUserProfile') {
      const reason = functionArgs.reason ? functionArgs.reason.toLowerCase() : '';
      const validKeywords = ['erreur', 'trompé', 'faute', 'correction', 'désolé', 'pardon', 'mauvais', 'change', 'corrige', 'modifier', 'fausse'];
      
      // Si la raison ne contient pas de mot clé de correction explicite, on bloque
      const isValidReason = validKeywords.some(keyword => reason.includes(keyword));
      
      if (!isValidReason) {
        console.warn(`⚠️ Tentative UpdateUserProfile bloquée. Raison invalide: "${functionArgs.reason}"`);
        return {
          success: false,
          message: `❌ ACTION REFUSÉE. Tu essaies de corriger un nom sans raison valable.
          - Si l'utilisateur est une NOUVELLE personne qui se présente ("Je m'appelle X"), utilise checkUser puis CreateUserProfile.
          - Si l'utilisateur veut se connecter à un autre compte, utilise SwitchUserProfile.
          - UpdateUserProfile est STRICTEMENT réservé aux corrections d'erreurs ("je me suis trompé", "faute de frappe").`
        };
      }
    }

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
- Tu dois déclencher l'affichage d'image via un TOOL: uiShowPicture({ filename })
- filename doit être un NOM EXACT issu de la liste ci-dessus (casse/espaces/extensions)
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
  
  if (functionName === 'searchKnowledgeBase' && functionResponse.success) {
    return functionResponse.results || functionResponse.message;
  }
  
  const userFunctions = ['checkUser', 'CreateUserProfile', 'UpdateUserProfile', 'SwitchUserProfile'];
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
  const functionResponse = await callFunction(functionName, functionToCall, functionArgs);
  const content = formatFunctionResponse(functionName, functionResponse);
  
  return {
    role: 'tool',
    tool_call_id: toolCall.id,
    name: functionName,
    content: content
  };
}

