/**
 * Changement de profil utilisateur
 */
import { CONSOLE_LOGS, EMOJIS } from '../messages.js';

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
  const fs = await import('fs');
  const path = await import('path');
  const { getUsersDir } = await import('../user/userProfiles.js');
  
  const targetFile = path.default.join(getUsersDir(), `${targetProfile.id}.json`);
  targetProfile.lastVisit = new Date().toISOString();
  targetProfile.visitCount = (targetProfile.visitCount || 0) + 1;
  fs.default.writeFileSync(targetFile, JSON.stringify(targetProfile, null, 2));
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
    
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.functionCall} Changement de profil: "${currentProfile.name || 'temporaire'}" → "${name}"`);
    if (reason) {
      console.log(`   ${EMOJIS.subitem} Raison IA: ${reason}`);
    }

    const { searchUserByName } = await import('../user/profileManagement.js');
    const targetProfile = searchUserByName(name);
    
    if (!targetProfile) {
      console.warn(`   ${EMOJIS.warning} Le profil "${name}" n'existe pas en base de données`);
      return {
        success: false,
        message: `❌ Le profil "${name}" n'existe pas en base de données. Utilise CreateUserProfile pour créer un nouveau profil.`
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

    return {
      success: true,
      userName: name,
      userId: targetProfile.id,
      previousUser: previousUserName,
      visitCount: targetProfile.visitCount,
      message: `✅ Changement de profil réussi ! Tu es maintenant connecté au profil "${name}" (${targetProfile.visitCount} visites). Accueille chaleureusement "${name}" et confirme le changement de profil.`
    };

  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Erreur SwitchUserProfile:`, error.message);
    return { success: false, message: `Erreur interne: ${error.message}` };
  }
}

