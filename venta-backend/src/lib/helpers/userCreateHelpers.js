/**
 * Création de profils utilisateurs
 */
import { CONSOLE_LOGS, EMOJIS } from '../messages.js';

/**
 * Convertit un profil temporaire en permanent
 */
async function convertTemporaryProfile(userId, name, context) {
  console.log(`   ${EMOJIS.info} Conversion du profil temporaire en permanent`);
  const { convertToPermament } = await import('../user/profileManagement.js');
  const updatedProfile = convertToPermament(userId, name);

  if (!updatedProfile) {
    return { success: false, message: 'Erreur lors de la conversion du profil temporaire' };
  }

  context.userProfile = updatedProfile;
  context.userId = updatedProfile.id;
  context.pendingUserCreation = null;
  
  console.log(`   ${EMOJIS.success} Profil temporaire converti en permanent: ${name}`);

  return {
    success: true,
    userName: name,
    userId: updatedProfile.id,
    message: `✅ Profil créé avec succès pour "${name}". Accueille chaleureusement l'utilisateur par son nom.`
  };
}

/**
 * Crée un nouveau profil permanent
 */
async function createNewPermanentProfile(name, currentProfile, context) {
  console.log(`   ${EMOJIS.info} Création d'un NOUVEAU profil permanent pour "${name}" (profil actuel: "${currentProfile.name}")`);
  
  const crypto = await import('crypto');
  const fs = await import('fs');
  const path = await import('path');
  const { getUsersDir } = await import('../user/userProfiles.js');
  
  const newUserId = crypto.default.randomBytes(8).toString('hex');
  // Copier toutes les IPs du profil actuel (ou migrer depuis ipHash)
  const ipHashes = currentProfile.ipHashes || (currentProfile.ipHash ? [currentProfile.ipHash] : []);
  
  const newProfile = {
    id: newUserId,
    ipHashes: ipHashes, // Copier toutes les IPs
    firstVisit: new Date().toISOString(),
    lastVisit: new Date().toISOString(),
    visitCount: 1,
    name: name,
    isTemporary: false,
    preferences: {},
    conversations: [],
    createdFrom: currentProfile.id
  };
  
  const userFile = path.default.join(getUsersDir(), `${newUserId}.json`);
  fs.default.writeFileSync(userFile, JSON.stringify(newProfile, null, 2));
  
  context.userProfile = newProfile;
  context.userId = newUserId;
  context.pendingUserCreation = null;
  
  console.log(`   ${EMOJIS.success} Nouveau profil créé avec succès: ${name} (ID: ${newUserId})`);
  console.log(`   ${EMOJIS.info} L'utilisateur "${currentProfile.name}" reste disponible avec l'ID: ${currentProfile.id}`);

  return {
    success: true,
    userName: name,
    userId: newUserId,
    previousUser: currentProfile.name,
    message: `Accueille chaleureusement "${name}"`
  };
}

/**
 * Crée un nouveau profil utilisateur
 */
export async function CreateUserProfile({ name, reason }, currentRequestContext) {
  try {
    if (!currentRequestContext || !currentRequestContext.userId) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} CreateUserProfile: contexte manquant`);
      return { success: false, message: 'Erreur: contexte utilisateur non disponible' };
    }

    const currentProfile = currentRequestContext.userProfile;
    
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.functionCall} Création du profil utilisateur: "${name}"`);
    if (reason) {
      console.log(`   ${EMOJIS.subitem} Raison IA: ${reason}`);
    }

    const { searchUserByName } = await import('../user/profileManagement.js');
    const existingUser = searchUserByName(name);
    
    if (existingUser) {
      console.warn(`   ${EMOJIS.warning} Le nom "${name}" existe déjà`);
      return {
        success: false,
        message: `Le nom "${name}" existe déjà en base de données. Vous auriez dû détecter cela avec checkUser.`
      };
    }

    if (currentProfile.isTemporary) {
      return await convertTemporaryProfile(currentRequestContext.userId, name, currentRequestContext);
    }

    return await createNewPermanentProfile(name, currentProfile, currentRequestContext);

  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Erreur CreateUserProfile:`, error.message);
    return { success: false, message: `Erreur interne: ${error.message}` };
  }
}

