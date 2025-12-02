/**
 * Vérification des utilisateurs
 */
import { CONSOLE_LOGS, EMOJIS } from '../messages.js';

/**
 * Vérifie si le contexte est valide
 */
function validateContext(context) {
  return context && context.userId;
}

function clearPendingCreation(context) {
  if (context && context.pendingUserCreation) {
    context.pendingUserCreation = null;
  }
}

function setPendingCreation(context, name) {
  if (!context || !name) return;
  context.pendingUserCreation = {
    name,
    reason: 'création automatique (checkUser)'
  };
}

/**
 * Compare deux noms (insensible à la casse)
 */
function namesMatch(name1, name2) {
  return name1 && name2 && name1.toLowerCase().trim() === name2.toLowerCase().trim();
}

/**
 * Génère le message de réponse quand l'utilisateur n'existe pas
 */
function buildUserNotFoundMessage(name, currentProfile) {
  const temporaryMessage = currentProfile?.isTemporary 
    ? 'Le profil temporaire actuel sera converti en permanent.' 
    : `Un nouveau profil "${name}" sera créé, et le profil "${currentProfile?.name}" restera disponible.`;
  
  return `Le nom "${name}" n'existe pas en base de données. Tu dois appeler CreateUserProfile pour créer ce profil. ${temporaryMessage}`;
}

/**
 * Vérifie si un nom existe en base de données
 */
export async function checkUser({ name }, currentRequestContext) {
  console.log(`\n🔵 [FUNCTION START] checkUser | Paramètres: name="${name}"`);
  
  try {
    if (!validateContext(currentRequestContext)) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} checkUser: contexte manquant`);
      const result = { success: false, message: 'Erreur: contexte utilisateur non disponible' };
      console.log(`❌ [FUNCTION END] checkUser | Retour: contexte manquant\n`);
      return result;
    }

    console.log(`${EMOJIS.search} ${CONSOLE_LOGS.functionCall} Vérification du nom: "${name}"`);
    
    const { searchUserByName } = await import('../user/profileManagement.js');
    const existingUser = await searchUserByName(name);
    
    const currentProfile = currentRequestContext.userProfile;
    clearPendingCreation(currentRequestContext);
    const isCurrentUser = namesMatch(currentProfile?.name, name);
    
    if (!existingUser) {
      console.log(`   ${EMOJIS.info} Nom "${name}" non trouvé en base de données`);
      setPendingCreation(currentRequestContext, name);
      return {
        success: true,
        exists: false,
        isCurrentUser: false,
        currentUserName: currentProfile?.name || null,
        isTemporaryProfile: currentProfile?.isTemporary || false,
        message: buildUserNotFoundMessage(name, currentProfile)
      };
    }
    
    if (isCurrentUser) {
      console.log(`   ${EMOJIS.info} "${name}" est le nom du profil actuel`);
      clearPendingCreation(currentRequestContext);
      return {
        success: true,
        exists: true,
        isCurrentUser: true,
        currentUserName: currentProfile.name,
        isTemporaryProfile: false,
        message: `"${name}" est déjà le nom du profil actuel. Aucune action nécessaire.`
      };
    }
    
    console.log(`   ${EMOJIS.warning} "${name}" existe en base mais n'est PAS le profil actuel`);
    clearPendingCreation(currentRequestContext);
    return {
      success: true,
      exists: true,
      isCurrentUser: false,
      currentUserName: currentProfile?.name || null,
      isTemporaryProfile: currentProfile?.isTemporary || false,
      existingUserInfo: { id: existingUser.id, name: existingUser.name, visitCount: existingUser.visitCount },
      message: `Le nom "${name}" existe en base mais appartient à un autre utilisateur. L'IA doit déterminer si c'est une correction de nom (appeler UpdateUserProfile) ou juste un contexte ("je vais chez ${name}").`
    };

  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Erreur checkUser:`, error.message);
    return { success: false, message: `Erreur interne: ${error.message}` };
  }
}

