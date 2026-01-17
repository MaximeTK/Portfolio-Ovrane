/**
 * Gestion des profils (liste, recherche) - Version MongoDB
 */
import { User } from '../../models/User.js';

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
      lastVisit: 1,
      'conversations': 1 // Pour compter la longueur
    }).lean();

    return users.map(u => ({
      id: u.id,
      name: u.name,
      visitCount: u.visitCount,
      lastVisit: u.lastVisit,
      conversationCount: u.conversations?.length || 0
    }));
  } catch (error) {
    console.error('❌ Erreur liste utilisateurs:', error);
    return [];
  }
}
