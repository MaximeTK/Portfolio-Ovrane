/**
 * Changement de profil utilisateur - Version MongoDB
 */
import { CONSOLE_LOGS, EMOJIS, MISC_MESSAGES } from '../messages.js';
import { User } from '../../models/User.js';
import { searchUserByName } from '../user/profileManagement.js';

/**
 * Vérifie si le nom correspond au profil actuel
 */
function isCurrentProfile(currentProfile, name) {
  return currentProfile.name && 
         currentProfile.name.toLowerCase().trim() === name.toLowerCase().trim();
}

/**
 * Met à jour les statistiques du profil cible
 */
async function updateTargetProfileStats(targetProfile) {
  try {
    await User.updateOne(
      { id: targetProfile.id },
      { 
        $set: { lastVisit: new Date() },
        $inc: { visitCount: 1 }
      }
    );
    // On met à jour l'objet local pour le retour
    targetProfile.visitCount = (targetProfile.visitCount || 0) + 1;
  } catch (error) {
    console.error('❌ Erreur updateTargetProfileStats:', error);
  }
}

/**
 * Bascule vers un profil existant
 */
export async function SwitchUserProfile({ name, reason }, currentRequestContext) {
  try {
    if (!currentRequestContext || !currentRequestContext.userId) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} SwitchUserProfile: contexte manquant`);
      return { success: false, message: 'Erreur: contexte utilisateur non disponible' };
    }

    const currentProfile = currentRequestContext.userProfile;
    
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.functionCall} Changement de profil: "${currentProfile.name || 'visiteur anonyme'}" → "${name}"`);
    if (reason) {
      console.log(`   ${EMOJIS.subitem} Raison IA: ${reason}`);
    }

    const targetProfile = await searchUserByName(name);
    
    if (!targetProfile) {
      console.warn(`   ${EMOJIS.warning} Le profil "${name}" n'existe pas en base de données`);
      return {
        success: false,
        message: `❌ Le profil "${name}" n'existe pas en base de données. La création de profil se fait uniquement via l'intro (saisie du pseudo).`
      };
    }

    if (isCurrentProfile(currentProfile, name)) {
      console.log(`   ${EMOJIS.info} "${name}" est déjà le profil actuel`);
      return {
        success: true,
        userName: name,
        message: `Tu es déjà connecté au profil "${name}". Aucun changement nécessaire.`
      };
    }

    await updateTargetProfileStats(targetProfile);
    
    const previousUserName = currentProfile.name || 'visiteur anonyme';
    currentRequestContext.userProfile = targetProfile;
    currentRequestContext.userId = targetProfile.id;
    
    console.log(`   ${EMOJIS.success} Changement de profil réussi vers "${name}" (ID: ${targetProfile.id})`);
    console.log(`   ${EMOJIS.info} Profil précédent: ${previousUserName}`);

    // Message d'instruction stricte pour l'IA
    // IMPORTANT: ne jamais parler du changement de profil. Ne jamais parler de "création" (les profils se créent via l'intro).
    const exactWelcome = targetProfile.visitCount > 1
      ? MISC_MESSAGES.welcomeBack(name)
      : MISC_MESSAGES.welcomeNew(name);

    const systemInstruction = `✅ Changement de profil effectué (${targetProfile.visitCount} visite(s)).
IMPORTANT : Ne dis RIEN sur le changement de profil.
Ta réponse doit être EXACTEMENT et UNIQUEMENT : "${exactWelcome}"`;

    return {
      success: true,
      userName: name,
      userId: targetProfile.id,
      previousUser: previousUserName,
      visitCount: targetProfile.visitCount,
      message: systemInstruction
    };

  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Erreur SwitchUserProfile:`, error.message);
    return { success: false, message: `Erreur interne: ${error.message}` };
  }
}
