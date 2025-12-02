/**
 * Création de profils utilisateurs - Version MongoDB
 */
import { CONSOLE_LOGS, EMOJIS } from '../messages.js';
import { User } from '../../models/User.js';
import { convertToPermament, searchUserByName } from '../user/profileManagement.js';
import { generateUserHash } from '../user/userProfiles.js';

/**
 * Convertit un profil temporaire en permanent
 */
async function convertTemporaryProfile(userId, name, context) {
  console.log(`   ${EMOJIS.info} Conversion du profil temporaire en permanent`);
  console.log(`   DEBUG: userId=${userId}, name=${name}`);
  
  const updatedProfile = await convertToPermament(userId, name);

  if (!updatedProfile) {
    console.error(`   ❌ ERREUR: Profil ${userId} non trouvé ou non mis à jour`);
    return { success: false, message: 'Erreur lors de la conversion du profil temporaire' };
  }
  
  console.log(`   DEBUG: Profil mis à jour en BDD:`, JSON.stringify(updatedProfile, null, 2));

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
  
  const ipHashes = currentProfile.ipHashes || [];
  const firstIpHash = ipHashes.length > 0 ? ipHashes[0] : 'unknown';
  
  const newUserId = generateUserHash(firstIpHash, name);
  
  try {
    const newProfile = new User({
      id: newUserId,
      ipHashes: ipHashes, // Copier toutes les IPs
      visitCount: 1,
      name: name,
      isTemporary: false,
      preferences: {},
      conversations: [],
      // createdFrom: currentProfile.id // Optionnel, pas dans le schéma original mais MongoDB l'accepte si strict:false
    });
    
    await newProfile.save();
    
    context.userProfile = newProfile.toObject();
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
  } catch (error) {
    console.error('❌ Erreur création profil permanent:', error);
    return { success: false, message: 'Erreur interne lors de la création du profil' };
  }
}

/**
 * Crée un nouveau profil utilisateur (Fonction exportée pour l'IA)
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

    const existingUser = await searchUserByName(name);
    
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
