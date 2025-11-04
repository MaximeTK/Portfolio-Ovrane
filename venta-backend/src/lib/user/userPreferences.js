/**
 * Gestion des préférences utilisateurs
 */
import fs from 'fs';
import path from 'path';
import { getUsersDir } from './userProfiles.js';
import { EMOJIS } from '../messages.js';

/**
 * Sauvegarde une préférence utilisateur
 */
export function saveUserPreference(userId, preference, value) {
  try {
    const userFile = path.join(getUsersDir(), `${userId}.json`);
    if (!fs.existsSync(userFile)) {
      console.warn(`${EMOJIS.warning} Profil utilisateur non trouvé: ${userId}`);
      return false;
    }
    
    const profile = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    if (!profile.preferences) {
      profile.preferences = {};
    }
    profile.preferences[preference] = value;
    fs.writeFileSync(userFile, JSON.stringify(profile, null, 2));
    return true;
  } catch (error) {
    console.error(`${EMOJIS.error} Erreur sauvegarde préférence:`, error);
    return false;
  }
}

