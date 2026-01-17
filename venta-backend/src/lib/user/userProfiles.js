/**
 * Gestion des profils utilisateurs avec MongoDB
 * Remplace l'ancienne version basée sur les fichiers JSON
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from '../../models/User.js';
import { memoryUsers } from '../memoryStore.js';

/**
 * Génère un hash unique
 */
export function generateUserHash(ip, userAgent = '') {
  const combined = `${ip}-${userAgent}`;
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

/**
 * Cherche un profil par ipHash
 */
export async function findUserByIpHash(ipHash) {
  try {
    // Chercher un utilisateur qui a cet IP dans sa liste ipHashes
    const user = await User.findOne({ ipHashes: ipHash }).lean();
    
    // .lean() convertit le document Mongoose en objet JS simple (plus rapide et compatible avec le reste du code)
    if (user) {
      // Adaptation pour compatibilité avec le reste du code (id vs _id)
      return user;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur recherche par ipHash (MongoDB):', error);
    return null;
  }
}

/**
 * Cherche un profil permanent par ipHash
 */
export async function findPermanentUserByIpHash(ipHash) {
  try {
    const user = await User.findOne({ 
      ipHashes: ipHash,
      name: { $ne: null } // name n'est pas null
    }).lean();
    
    return user;
  } catch (error) {
    console.error('❌ Erreur recherche profil permanent (MongoDB):', error);
    return null;
  }
}

/**
 * Ajoute une IP à un profil existant si elle n'existe pas déjà
 */
export async function addIpToProfile(profile, ipHash) {
  // Si profile est juste un ID, on le cherche
  let userId = profile.id || profile;

  try {
    // Mise à jour atomique : ajoute ipHash s'il n'est pas déjà dans la liste
    const updatedUser = await User.findOneAndUpdate(
      { id: userId },
      { $addToSet: { ipHashes: ipHash } },
      { new: true } // Retourne le document mis à jour
    ).lean();
    
    return updatedUser || profile;
  } catch (error) {
    console.error('❌ Erreur ajout IP au profil (MongoDB):', error);
    return profile;
  }
}

/**
 * Fonction utilitaire pour sauvegarder un profil complet
 * (Remplace fs.writeFileSync)
 */
export async function saveUserProfile(userProfile) {
  if (!userProfile || !userProfile.id) return;

  try {
    // On retire _id pour ne pas écraser l'ID interne MongoDB si présent
    const { _id, createdAt, updatedAt, ...updateData } = userProfile;
    
    await User.updateOne(
      { id: userProfile.id },
      { $set: updateData }
    );
  } catch (error) {
    console.error(`❌ Erreur sauvegarde profil ${userProfile.id}:`, error);
  }
}

// Fonction legacy pour compatibilité (ne fait rien ou log un warning)
export function getUsersDir() {
  console.warn('⚠️ getUsersDir appelé : obsolète avec MongoDB');
  return '';
}
