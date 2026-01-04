/**
 * Gestion des profils (conversion, fusion) - Version MongoDB
 */
import mongoose from 'mongoose';
import { User } from '../../models/User.js';

/**
 * Convertit un profil temporaire en permanent
 */
export async function convertToPermament(userId, name) {
  try {
    const updatedUser = await User.findOneAndUpdate(
      { id: userId },
      { 
        $set: { 
          name: name,
          isTemporary: false,
          convertedAt: new Date()
        }
      },
      { new: true }
    ).lean();
    
    if (!updatedUser) {
      console.warn(`⚠️ Profil ${userId} non trouvé pour conversion`);
      return null;
    }
    
    return updatedUser;
  } catch (error) {
    console.error('❌ Erreur conversion profil:', error);
    return null;
  }
}

/**
 * Fusionne un profil temporaire dans un permanent
 */
export async function mergeTemporaryIntoPermanent(tempUserId, permanentUserId) {
  try {
    // 1. Récupérer les deux profils
    const tempUser = await User.findOne({ id: tempUserId }).lean();
    const permanentUser = await User.findOne({ id: permanentUserId }).lean();

    if (!tempUser || !permanentUser) {
      console.warn('⚠️ Un des profils n\'existe pas pour la fusion');
      return null;
    }

    // 2. Préparer les données à fusionner
    const tempIps = tempUser.ipHashes || [];
    const tempConversations = tempUser.conversations || [];
    
    // 3. Mettre à jour le permanent
    const updatedPermanent = await User.findOneAndUpdate(
      { id: permanentUserId },
      {
        // Ajouter les IPs qui n'existent pas déjà ($addToSet ne gère qu'une valeur à la fois ou $each)
        $addToSet: { 
          ipHashes: { $each: tempIps } 
        },
        // Ajouter les conversations à la fin
        $push: {
          conversations: { $each: tempConversations }
        },
        // Additionner les visites
        $inc: { 
          visitCount: tempUser.visitCount || 0 
        },
        // Mettre à jour la dernière visite
        $set: { 
          lastVisit: new Date() 
        }
      },
      { new: true }
    ).lean();

    // 4. Supprimer le temporaire
    await User.deleteOne({ id: tempUserId });

    return updatedPermanent;
  } catch (error) {
    console.error('❌ Erreur fusion temporaire→permanent:', error);
    return null;
  }
}

/**
 * Nettoie les profils temporaires inactifs
 */
export async function cleanInactiveTemporaryProfiles() {
  // Si pas connecté à MongoDB, on ignore
  if (mongoose.connection.readyState !== 1) {
    return 0;
  }

  try {
    const now = new Date();
    const threshold = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24h avant
    
    const result = await User.deleteMany({
      isTemporary: true,
      lastVisit: { $lt: threshold }
    });
    
    if (result.deletedCount > 0) {
      // console.log(`✅ ${result.deletedCount} profil(s) temporaire(s) nettoyé(s)`);
    }
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Erreur nettoyage profils temporaires:', error);
    return 0;
  }
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
