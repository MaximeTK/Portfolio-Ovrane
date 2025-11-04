/**
 * Gestion des profils (conversion, fusion) - max 5 fonctions, max 20 lignes
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getUsersDir, generateUserHash } from './userProfiles.js';

/**
 * Convertit un profil temporaire en permanent
 */
export function convertToPermament(userId, name) {
  const userFile = path.join(getUsersDir(), `${userId}.json`);
  if (!fs.existsSync(userFile)) {
    console.warn(`⚠️ Profil ${userId} non trouvé pour conversion`);
    return null;
  }
  try {
    const profile = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    
    // Migration automatique vers nouveau format ipHashes si nécessaire
    if (!profile.ipHashes && profile.ipHash) {
      profile.ipHashes = [profile.ipHash];
      delete profile.ipHash;
    }
    
    profile.name = name;
    profile.isTemporary = false;
    profile.convertedAt = new Date().toISOString();
    fs.writeFileSync(userFile, JSON.stringify(profile, null, 2));
    return profile;
  } catch (error) {
    console.error('❌ Erreur conversion profil:', error);
    return null;
  }
}

/**
 * Fusionne un profil temporaire dans un permanent
 */
export function mergeTemporaryIntoPermanent(tempUserId, permanentUserId) {
  const tempFile = path.join(getUsersDir(), `${tempUserId}.json`);
  const permanentFile = path.join(getUsersDir(), `${permanentUserId}.json`);
  
  if (!fs.existsSync(tempFile) || !fs.existsSync(permanentFile)) {
    console.warn('⚠️ Un des profils n\'existe pas pour la fusion');
    return null;
  }
  
  try {
    const tempProfile = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    const permanentProfile = JSON.parse(fs.readFileSync(permanentFile, 'utf8'));
    
    // Fusionner les IPs
    const tempIps = tempProfile.ipHashes || (tempProfile.ipHash ? [tempProfile.ipHash] : []);
    const permanentIps = permanentProfile.ipHashes || (permanentProfile.ipHash ? [permanentProfile.ipHash] : []);
    
    // Migrer permanent vers nouveau format si nécessaire
    if (!permanentProfile.ipHashes && permanentProfile.ipHash) {
      permanentProfile.ipHashes = [permanentProfile.ipHash];
      delete permanentProfile.ipHash;
    }
    
    // Ajouter les IPs du temporaire qui ne sont pas déjà dans le permanent
    tempIps.forEach(ip => {
      if (!permanentProfile.ipHashes.includes(ip)) {
        permanentProfile.ipHashes.push(ip);
      }
    });
    
    if (tempProfile.conversations && tempProfile.conversations.length > 0) {
      permanentProfile.conversations = [
        ...(permanentProfile.conversations || []),
        ...tempProfile.conversations
      ];
      permanentProfile.conversations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    
    permanentProfile.visitCount = (permanentProfile.visitCount || 0) + (tempProfile.visitCount || 0);
    permanentProfile.lastVisit = new Date().toISOString();
    
    fs.writeFileSync(permanentFile, JSON.stringify(permanentProfile, null, 2));
    fs.unlinkSync(tempFile);
    
    return permanentProfile;
  } catch (error) {
    console.error('❌ Erreur fusion temporaire→permanent:', error);
    return null;
  }
}

/**
 * Nettoie les profils temporaires inactifs
 */
export function cleanInactiveTemporaryProfiles() {
  try {
    const files = fs.readdirSync(getUsersDir()).filter(f => f.endsWith('.json'));
    const now = new Date();
    const threshold = 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    
    files.forEach(file => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(getUsersDir(), file), 'utf8'));
        if (data.isTemporary) {
          const lastVisit = new Date(data.lastVisit);
          const inactiveTime = now - lastVisit;
          if (inactiveTime > threshold) {
            fs.unlinkSync(path.join(getUsersDir(), file));
            deletedCount++;
          }
        }
      } catch (err) {
        console.error(`❌ Erreur nettoyage ${file}:`, err.message);
      }
    });
    
    if (deletedCount > 0) {
      //console.log(`✅ ${deletedCount} profil(s) temporaire(s) nettoyé(s)`);
    }
    return deletedCount;
  } catch (error) {
    console.error('❌ Erreur nettoyage profils temporaires:', error);
    return 0;
  }
}

/**
 * Recherche un utilisateur par nom
 */
export function searchUserByName(name) {
  if (!name) return null;
  try {
    const files = fs.readdirSync(getUsersDir());
    const normalizedSearchName = name.toLowerCase().trim();
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(getUsersDir(), file), 'utf8'));
        if (data.name && data.name.toLowerCase().trim() === normalizedSearchName) {
          return data;
        }
      } catch (err) {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error('❌ Erreur recherche utilisateur par nom:', error);
    return null;
  }
}

/**
 * Liste tous les utilisateurs
 */
export function getAllUsers() {
  try {
    const files = fs.readdirSync(getUsersDir());
    const users = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(getUsersDir(), f), 'utf8'));
          return {
            id: data.id,
            name: data.name,
            visitCount: data.visitCount,
            firstVisit: data.firstVisit,
            lastVisit: data.lastVisit,
            conversationCount: data.conversations?.length || 0
          };
        } catch (err) {
          return null;
        }
      })
      .filter(u => u !== null);
    return users;
  } catch (error) {
    console.error('❌ Erreur liste utilisateurs:', error);
    return [];
  }
}

