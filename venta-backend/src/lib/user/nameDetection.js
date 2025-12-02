/**
 * Détection et gestion des noms d'utilisateurs - Version MongoDB
 */
import { User } from '../../models/User.js';
import { convertToPermament, mergeTemporaryIntoPermanent, searchUserByName } from './profileManagement.js';
import { generateUserHash } from './userProfiles.js';
import { EMOJIS, ERROR_MESSAGES } from '../messages.js';

/**
 * Convertit un profil temporaire
 */
async function handleTemporaryProfile(userId, detectedName) {
  const existingPermanent = await searchUserByName(detectedName);
  if (existingPermanent) {
    const mergedProfile = await mergeTemporaryIntoPermanent(userId, existingPermanent.id);
    return { action: 'merged', profile: mergedProfile };
  } else {
    const convertedProfile = await convertToPermament(userId, detectedName);
    return { action: 'converted', profile: convertedProfile };
  }
}

/**
 * Corrige le nom d'un profil permanent
 */
async function handleNameCorrection(userId, detectedName, currentProfile) {
  console.log(`📝 Correction de nom détectée: ${currentProfile.name} → ${detectedName}`);
  
  const existingProfileWithName = await searchUserByName(detectedName);
  
  if (existingProfileWithName && existingProfileWithName.id !== userId) {
    console.log(`⚠️ Un profil existe déjà avec le nom "${detectedName}" → Switch au lieu de correction`);
    return { action: 'switchToDifferentUser', profile: existingProfileWithName };
  }
  
  const updatedProfile = await User.findOneAndUpdate(
    { id: userId },
    { 
      $set: { 
        name: detectedName,
        correctedAt: new Date() 
      } 
    },
    { new: true }
  ).lean();

  console.log(`✅ Nom corrigé avec succès dans le profil ${userId}`);
  return { action: 'corrected', profile: updatedProfile };
}

/**
 * Crée un nouveau profil
 */
async function createNewProfile(detectedName, currentProfile) {
  // Récupérer la première IP
  const ipHashes = currentProfile.ipHashes || [];
  const firstIpHash = ipHashes.length > 0 ? ipHashes[0] : 'unknown';
  
  const newUserId = generateUserHash(firstIpHash, detectedName);
  
  const newProfile = new User({
    id: newUserId,
    ipHashes: ipHashes, // Copier toutes les IPs
    visitCount: 1,
    name: detectedName,
    isTemporary: false,
    preferences: {},
    conversations: []
  });
  
  await newProfile.save();
  
  return { action: 'changeName', profile: newProfile.toObject() };
}

/**
 * Gère un changement d'utilisateur
 */
async function handleUserChange(detectedName, currentProfile) {
  const existingWithNewName = await searchUserByName(detectedName);
  if (existingWithNewName) {
    return { action: 'switchToDifferentUser', profile: existingWithNewName };
  }
  return await createNewProfile(detectedName, currentProfile);
}

/**
 * Gère la détection de nom (Fonction Publique)
 */
export async function handleNameDetection(userId, detectedName, isCorrection = false) {
  const currentProfile = await User.findOne({ id: userId }).lean();
  
  if (!currentProfile) {
    console.warn(`${EMOJIS.warning} ${ERROR_MESSAGES.userProfileNotFound} ${userId}`);
    return null;
  }
  
  if (currentProfile.isTemporary) {
    return await handleTemporaryProfile(userId, detectedName);
  }
  
  if (!currentProfile.isTemporary && currentProfile.name && currentProfile.name !== detectedName && isCorrection) {
    return await handleNameCorrection(userId, detectedName, currentProfile);
  }
  
  if (!currentProfile.isTemporary && currentProfile.name && currentProfile.name !== detectedName && !isCorrection) {
    return await handleUserChange(detectedName, currentProfile);
  }
  
  if (!currentProfile.isTemporary && currentProfile.name === detectedName) {
    return { action: 'confirmed', profile: currentProfile };
  }
  
  return null;
}
