/**
 * Chargement et récupération des profils utilisateurs
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getUsersDir, findPermanentUserByIpHash, findUserByIpHash, createNewUser, addIpToProfile } from './userProfiles.js';
import { EMOJIS, ERROR_MESSAGES } from '../messages.js';

/**
 * Met à jour les statistiques de visite d'un profil
 */
function updateVisitStats(profile) {
  profile.lastVisit = new Date().toISOString();
  profile.visitCount = (profile.visitCount || 0) + 1;
  return profile;
}

/**
 * Sauvegarde un profil dans son fichier
 */
function saveProfile(profile) {
  const userFile = path.join(getUsersDir(), `${profile.id}.json`);
  fs.writeFileSync(userFile, JSON.stringify(profile, null, 2));
  return profile;
}

/**
 * Charge et met à jour un profil permanent
 */
function loadPermanentProfile(ipHash) {
  const permanentProfile = findPermanentUserByIpHash(ipHash);
  if (permanentProfile) {
    updateVisitStats(permanentProfile);
    return saveProfile(permanentProfile);
  }
  return null;
}

/**
 * Charge un profil existant depuis un fichier
 */
function loadExistingProfile(userId) {
  const userFile = path.join(getUsersDir(), `${userId}.json`);
  if (fs.existsSync(userFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(userFile, 'utf8'));
      
      // Migration automatique vers nouveau format ipHashes si nécessaire
      if (!data.ipHashes && data.ipHash) {
        data.ipHashes = [data.ipHash];
        delete data.ipHash;
      }
      
      updateVisitStats(data);
      saveProfile(data);
      return data;
    } catch (error) {
      console.error(`${EMOJIS.error} ${ERROR_MESSAGES.userProfileReadError}`, error);
      return null;
    }
  }
  return null;
}

/**
 * Récupère ou crée un profil utilisateur
 */
export function getUserProfile(userId, ip) {
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
  
  const permanentProfile = loadPermanentProfile(ipHash);
  if (permanentProfile) {
    // Ajouter la nouvelle IP si elle n'existe pas déjà
    addIpToProfile(permanentProfile, ipHash);
    return saveProfile(permanentProfile);
  }
  
  const existingProfile = loadExistingProfile(userId);
  if (existingProfile) {
    // Ajouter la nouvelle IP si elle n'existe pas déjà
    addIpToProfile(existingProfile, ipHash);
    return saveProfile(existingProfile);
  }
  
  const existingByIp = findUserByIpHash(ipHash);
  if (existingByIp) {
    updateVisitStats(existingByIp);
    // L'IP est déjà dans la liste, juste sauvegarder
    return saveProfile(existingByIp);
  }
  
  return createNewUser(userId, ip);
}

