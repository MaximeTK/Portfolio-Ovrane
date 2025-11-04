/**
 * Détection et gestion des noms d'utilisateurs
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getUsersDir } from './userProfiles.js';
import { convertToPermament, mergeTemporaryIntoPermanent, searchUserByName } from './profileManagement.js';
import { generateUserHash } from './userProfiles.js';
import { EMOJIS, ERROR_MESSAGES } from '../messages.js';

/**
 * Convertit un profil temporaire
 */
function handleTemporaryProfile(userId, detectedName) {
  const existingPermanent = searchUserByName(detectedName);
  if (existingPermanent) {
    const mergedProfile = mergeTemporaryIntoPermanent(userId, existingPermanent.id);
    return { action: 'merged', profile: mergedProfile };
  } else {
    const convertedProfile = convertToPermament(userId, detectedName);
    return { action: 'converted', profile: convertedProfile };
  }
}

/**
 * Corrige le nom d'un profil permanent
 */
function handleNameCorrection(userId, detectedName, currentProfile) {
  console.log(`📝 Correction de nom détectée: ${currentProfile.name} → ${detectedName}`);
  
  const existingProfileWithName = searchUserByName(detectedName);
  
  if (existingProfileWithName && existingProfileWithName.id !== userId) {
    console.log(`⚠️ Un profil existe déjà avec le nom "${detectedName}" → Switch au lieu de correction`);
    return { action: 'switchToDifferentUser', profile: existingProfileWithName };
  }
  
  const userFile = path.join(getUsersDir(), `${userId}.json`);
  currentProfile.name = detectedName;
  currentProfile.correctedAt = new Date().toISOString();
  fs.writeFileSync(userFile, JSON.stringify(currentProfile, null, 2));
  console.log(`✅ Nom corrigé avec succès dans le profil ${userId}`);
  return { action: 'corrected', profile: currentProfile };
}

/**
 * Crée un nouveau profil
 */
function createNewProfile(detectedName, currentProfile) {
  // Récupérer la première IP (ou ipHash pour compatibilité)
  const firstIpHash = currentProfile.ipHashes && currentProfile.ipHashes.length > 0 
    ? currentProfile.ipHashes[0] 
    : currentProfile.ipHash;
  
  const newUserId = generateUserHash(firstIpHash, detectedName);
  // Copier toutes les IPs du profil actuel
  const ipHashes = currentProfile.ipHashes || (currentProfile.ipHash ? [currentProfile.ipHash] : []);
  
  const newProfile = {
    id: newUserId,
    ipHashes: ipHashes, // Copier toutes les IPs
    firstVisit: new Date().toISOString(),
    lastVisit: new Date().toISOString(),
    visitCount: 1,
    name: detectedName,
    isTemporary: false,
    preferences: {},
    conversations: []
  };
  const newFile = path.join(getUsersDir(), `${newUserId}.json`);
  fs.writeFileSync(newFile, JSON.stringify(newProfile, null, 2));
  return { action: 'changeName', profile: newProfile };
}

/**
 * Gère un changement d'utilisateur
 */
function handleUserChange(detectedName, currentProfile) {
  const existingWithNewName = searchUserByName(detectedName);
  if (existingWithNewName) {
    return { action: 'switchToDifferentUser', profile: existingWithNewName };
  }
  return createNewProfile(detectedName, currentProfile);
}

/**
 * Gère la détection de nom
 */
export function handleNameDetection(userId, detectedName, isCorrection = false) {
  const userFile = path.join(getUsersDir(), `${userId}.json`);
  if (!fs.existsSync(userFile)) {
    console.warn(`${EMOJIS.warning} ${ERROR_MESSAGES.userProfileNotFound} ${userId}`);
    return null;
  }
  
  const currentProfile = JSON.parse(fs.readFileSync(userFile, 'utf8'));
  
  if (currentProfile.isTemporary) {
    return handleTemporaryProfile(userId, detectedName);
  }
  
  if (!currentProfile.isTemporary && currentProfile.name && currentProfile.name !== detectedName && isCorrection) {
    return handleNameCorrection(userId, detectedName, currentProfile);
  }
  
  if (!currentProfile.isTemporary && currentProfile.name && currentProfile.name !== detectedName && !isCorrection) {
    return handleUserChange(detectedName, currentProfile);
  }
  
  if (!currentProfile.isTemporary && currentProfile.name === detectedName) {
    return { action: 'confirmed', profile: currentProfile };
  }
  
  return null;
}

