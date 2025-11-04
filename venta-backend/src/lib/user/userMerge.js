/**
 * Fusion de profils utilisateurs
 */
import fs from 'fs';
import path from 'path';
import { getUsersDir } from './userProfiles.js';
import { EMOJIS, ERROR_MESSAGES } from '../messages.js';

/**
 * Ajoute un lien entre profils
 */
function linkProfiles(existingProfile, currentUserId) {
  if (!existingProfile.linkedProfiles) {
    existingProfile.linkedProfiles = [];
  }
  if (!existingProfile.linkedProfiles.includes(currentUserId)) {
    existingProfile.linkedProfiles.push(currentUserId);
  }
}

/**
 * Fusionne ou lie deux profils utilisateurs
 */
export function mergeUserProfiles(currentUserId, existingUserId) {
  if (currentUserId === existingUserId) return;
  
  try {
    const currentFile = path.join(getUsersDir(), `${currentUserId}.json`);
    const existingFile = path.join(getUsersDir(), `${existingUserId}.json`);
    
    if (!fs.existsSync(currentFile) || !fs.existsSync(existingFile)) {
      console.warn(`${EMOJIS.warning} ${ERROR_MESSAGES.userProfileDoesNotExist}`);
      return;
    }
    
    const currentProfile = JSON.parse(fs.readFileSync(currentFile, 'utf8'));
    const existingProfile = JSON.parse(fs.readFileSync(existingFile, 'utf8'));
    
    linkProfiles(existingProfile, currentUserId);
    
    currentProfile.mainProfileId = existingUserId;
    currentProfile.name = existingProfile.name;
    
    fs.writeFileSync(currentFile, JSON.stringify(currentProfile, null, 2));
    fs.writeFileSync(existingFile, JSON.stringify(existingProfile, null, 2));
  } catch (error) {
    console.error(`${EMOJIS.error} ${ERROR_MESSAGES.userMergeError}`, error);
  }
}

