/**
 * Gestion des profils (conversion, fusion) - Version MongoDB
 */
import mongoose from 'mongoose';
import { User } from '../../models/User.js';

/**
 * Convertit un profil temporaire en permanent (OBSOLÈTE : Plus de profils temporaires)
 * Cette fonction est gardée pour compatibilité mais ne devrait plus être utilisée
 */
export async function convertToPermament(userId, name) {
  // Simplement retourner null car il n'y a plus de conversion à faire
  return null;
}

/**
 * Fusionne un profil temporaire dans un permanent (OBSOLÈTE)
 */
export async function mergeTemporaryIntoPermanent(tempUserId, permanentUserId) {
  return null;
}

/**
 * Nettoie les profils temporaires inactifs (OBSOLÈTE)
 */
export async function cleanInactiveTemporaryProfiles() {
  return 0;
}

/**
 * Recherche un utilisateur par nom (insensible à la casse)
 */
export async function searchUserByName(name) {
  if (!name) return null;
  try {
    // Recherche insensible à la casse avec Regex
    const user = await User.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    }).lean();
    
    return user;
  } catch (error) {
    console.error('❌ Erreur recherche utilisateur par nom:', error);
    return null;
  }
}

/**
 * Liste tous les utilisateurs
 */
export async function getAllUsers() {
  try {
    const users = await User.find({}, {
      id: 1,
      name: 1,
      visitCount: 1,
      firstVisit: 1,
      lastVisit: 1,
      'conversations': 1 // Pour compter la longueur
    }).lean();

    return users.map(u => ({
      id: u.id,
      name: u.name,
      visitCount: u.visitCount,
      firstVisit: u.firstVisit,
      lastVisit: u.lastVisit,
      conversationCount: u.conversations?.length || 0
    }));
  } catch (error) {
    console.error('❌ Erreur liste utilisateurs:', error);
    return [];
  }
}
