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
  // Mode mémoire locale si MongoDB déconnecté
  if (mongoose.connection.readyState !== 1) {
    for (const user of memoryUsers.values()) {
      if (user.ipHashes && user.ipHashes.includes(ipHash)) {
        return user;
      }
    }
    return null;
  }

  try {
    // Chercher un utilisateur qui a cet IP dans sa liste ipHashes
    const user = await User.findOne({ ipHashes: ipHash }).lean();
    
    // .lean() convertit le document Mongoose en objet JS simple (plus rapide et compatible avec le reste du code)
    if (user) {
      // Adaptation pour compatibilité avec le reste du code (id vs _id)
      // Mongoose utilise _id, mais le reste du code utilise id
      // Notre schéma a un champ 'id' explicite, donc c'est bon.
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
  // Mode mémoire
  if (mongoose.connection.readyState !== 1) {
    for (const user of memoryUsers.values()) {
      if (user.ipHashes && user.ipHashes.includes(ipHash) && !user.isTemporary && user.name) {
        return user;
      }
    }
    return null;
  }

  try {
    const user = await User.findOne({ 
      ipHashes: ipHash,
      isTemporary: false,
      name: { $ne: null } // name n'est pas null
    }).lean();
    
    return user;
  } catch (error) {
    console.error('❌ Erreur recherche profil permanent (MongoDB):', error);
    return null;
  }
}

/**
 * Crée un nouveau profil temporaire
 */
export async function createNewUser(userId, ip) {
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
  
  const newUserObj = {
    id: userId,
    ipHashes: [ipHash],
    isTemporary: true,
    name: null,
    visitCount: 1,
    preferences: {},
    conversations: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Mode mémoire
  if (mongoose.connection.readyState !== 1) {
    memoryUsers.set(userId, newUserObj);
    return newUserObj;
  }
  
  try {
    const newUser = new User(newUserObj);
    await newUser.save();
    
    // Retourner l'objet simple
    return newUser.toObject();
  } catch (error) {
    console.error('❌ Erreur création utilisateur (MongoDB):', error);
    throw error;
  }
}

/**
 * Ajoute une IP à un profil existant si elle n'existe pas déjà
 */
export async function addIpToProfile(profile, ipHash) {
  // Si profile est juste un ID, on le cherche
  let userId = profile.id || profile;
  
  // Mode mémoire
  if (mongoose.connection.readyState !== 1) {
    const user = memoryUsers.get(userId);
    if (user) {
      if (!user.ipHashes) user.ipHashes = [];
      if (!user.ipHashes.includes(ipHash)) {
        user.ipHashes.push(ipHash);
        memoryUsers.set(userId, user);
      }
      return user;
    }
    return profile;
  }

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
  
  // Mode mémoire
  if (mongoose.connection.readyState !== 1) {
    // Si l'utilisateur existe déjà, on fusionne pour ne pas perdre ce qui n'est pas dans userProfile
    const existing = memoryUsers.get(userProfile.id) || {};
    memoryUsers.set(userProfile.id, { ...existing, ...userProfile, updatedAt: new Date() });
    return;
  }
  
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
