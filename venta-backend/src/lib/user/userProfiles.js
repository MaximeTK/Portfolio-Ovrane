/**
 * Gestion des profils utilisateurs - max 5 fonctions, max 20 lignes
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'users');

if (!fs.existsSync(USERS_DIR)) {
  fs.mkdirSync(USERS_DIR, { recursive: true });
}

/**
 * Génère un hash unique
 */
export function generateUserHash(ip, userAgent = '') {
  const combined = `${ip}-${userAgent}`;
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

/**
 * Cherche un profil par ipHash (compatible avec ancien format ipHash et nouveau format ipHashes)
 */
export function findUserByIpHash(ipHash) {
  try {
    const files = fs.readdirSync(USERS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(USERS_DIR, file), 'utf8'));
        // Support ancien format (ipHash) et nouveau format (ipHashes)
        if (data.ipHashes && Array.isArray(data.ipHashes)) {
          if (data.ipHashes.includes(ipHash)) return data;
        } else if (data.ipHash === ipHash) {
          // Migration automatique : convertir ipHash en ipHashes
          data.ipHashes = [data.ipHash];
          delete data.ipHash;
          const userFile = path.join(USERS_DIR, file);
          fs.writeFileSync(userFile, JSON.stringify(data, null, 2));
          return data;
        }
      } catch (err) {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error('❌ Erreur recherche par ipHash:', error);
    return null;
  }
}

/**
 * Cherche un profil permanent par ipHash (compatible avec ancien format ipHash et nouveau format ipHashes)
 */
export function findPermanentUserByIpHash(ipHash) {
  try {
    const files = fs.readdirSync(USERS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(USERS_DIR, file), 'utf8'));
        if (!data.isTemporary && data.name) {
          // Support ancien format (ipHash) et nouveau format (ipHashes)
          if (data.ipHashes && Array.isArray(data.ipHashes)) {
            if (data.ipHashes.includes(ipHash)) return data;
          } else if (data.ipHash === ipHash) {
            // Migration automatique : convertir ipHash en ipHashes
            data.ipHashes = [data.ipHash];
            delete data.ipHash;
            const userFile = path.join(USERS_DIR, file);
            fs.writeFileSync(userFile, JSON.stringify(data, null, 2));
            return data;
          }
        }
      } catch (err) {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error('❌ Erreur recherche profil permanent:', error);
    return null;
  }
}

/**
 * Crée un nouveau profil temporaire
 */
export function createNewUser(userId, ip) {
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
  const profile = {
    id: userId,
    ipHashes: [ipHash], // Liste d'IPs au lieu d'une seule IP
    firstVisit: new Date().toISOString(),
    lastVisit: new Date().toISOString(),
    visitCount: 1,
    name: null,
    isTemporary: true,
    preferences: {},
    conversations: []
  };
  const userFile = path.join(USERS_DIR, `${userId}.json`);
  fs.writeFileSync(userFile, JSON.stringify(profile, null, 2));
  return profile;
}

/**
 * Ajoute une IP à un profil existant si elle n'existe pas déjà
 */
export function addIpToProfile(profile, ipHash) {
  if (!profile.ipHashes) {
    // Migration automatique depuis ancien format
    profile.ipHashes = profile.ipHash ? [profile.ipHash] : [];
    delete profile.ipHash;
  }
  
  if (!Array.isArray(profile.ipHashes)) {
    profile.ipHashes = [];
  }
  
  if (!profile.ipHashes.includes(ipHash)) {
    profile.ipHashes.push(ipHash);
  }
  
  return profile;
}

export function getUsersDir() {
  return USERS_DIR;
}

