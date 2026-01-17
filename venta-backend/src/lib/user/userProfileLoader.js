/**
 * Chargement et récupération des profils utilisateurs (Version MongoDB)
 */
import crypto from 'crypto';
import { User } from '../../models/User.js';
import { findPermanentUserByIpHash, findUserByIpHash, addIpToProfile, saveUserProfile } from './userProfiles.js';
import { EMOJIS, ERROR_MESSAGES } from '../messages.js';
import { isValidUserId } from '../validators.js';

/**
 * Met à jour les statistiques de visite d'un profil en base
 * N'incrémente visitCount que si la dernière visite date de plus de 1 heure
 */
async function updateVisitStats(userId) {
  try {
    // Récupérer d'abord l'utilisateur pour vérifier lastVisit
    const currentUser = await User.findOne({ id: userId }).lean();
    if (!currentUser) return null;

    const now = new Date();
    const lastVisit = currentUser.lastVisit ? new Date(currentUser.lastVisit) : new Date(0);
    const timeDiff = now.getTime() - lastVisit.getTime();
    const shouldIncrement = timeDiff > (60 * 60 * 1000); // 1 heure

    const update = {
      $set: { lastVisit: now }
    };

    if (shouldIncrement) {
      update.$inc = { visitCount: 1 };
    }

    const user = await User.findOneAndUpdate(
      { id: userId },
      update,
      { new: true }
    ).lean();
    
    return user;
  } catch (error) {
    console.error('❌ Erreur updateVisitStats:', error);
    return null;
  }
}

/**
 * Charge et met à jour un profil permanent
 */
async function loadPermanentProfile(ipHash) {
  const permanentProfile = await findPermanentUserByIpHash(ipHash);
  if (permanentProfile) {
    return await updateVisitStats(permanentProfile.id);
  }
  return null;
}

/**
 * Charge un profil existant par ID
 */
async function loadExistingProfile(userId) {
  try {
    const user = await User.findOne({ id: userId }).lean();
    if (user) {
      return await updateVisitStats(userId);
    }
    return null;
  } catch (error) {
    console.error(`${EMOJIS.error} ${ERROR_MESSAGES.userProfileReadError}`, error);
    return null;
  }
}

/**
 * Récupère ou crée un profil utilisateur
 */
export async function getUserProfile(userId, ip) {
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
  
  // 1. PRIORITÉ ABSOLUE : Si un userId est fourni et valide, on l'utilise.
  // Cela permet de "sortir" de la détection automatique par IP quand on a switché de profil.
  if (isValidUserId(userId)) {
    const existingProfile = await loadExistingProfile(userId);
    if (existingProfile) {
      // Ajouter la nouvelle IP si elle n'existe pas déjà (pour garder une trace)
      await addIpToProfile(existingProfile.id, ipHash);
      // On recharge pour être sûr d'avoir la version à jour avec l'IP
      return await loadExistingProfile(userId); 
    }
  }

  // PLUS DE RECHERCHE AUTOMATIQUE PAR IP
  // Si on n'a pas d'ID valide fourni par le client, on considère qu'il n'y a pas de profil.
  // L'utilisateur doit d'abord entrer un pseudo pour créer un compte.
  return null;
}
