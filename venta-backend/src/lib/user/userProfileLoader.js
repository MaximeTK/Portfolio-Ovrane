/**
 * Chargement et récupération des profils utilisateurs (Version MongoDB)
 */
import crypto from 'crypto';
import { User } from '../../models/User.js';
import { findPermanentUserByIpHash, findUserByIpHash, createNewUser, addIpToProfile, saveUserProfile } from './userProfiles.js';
import { EMOJIS, ERROR_MESSAGES } from '../messages.js';

/**
 * Met à jour les statistiques de visite d'un profil en base
 */
async function updateVisitStats(userId) {
  try {
    const user = await User.findOneAndUpdate(
      { id: userId },
      { 
        $set: { lastVisit: new Date() },
        $inc: { visitCount: 1 }
      },
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
  if (userId) {
    const existingProfile = await loadExistingProfile(userId);
    if (existingProfile) {
      // Ajouter la nouvelle IP si elle n'existe pas déjà (pour garder une trace)
      await addIpToProfile(existingProfile.id, ipHash);
      // On recharge pour être sûr d'avoir la version à jour avec l'IP
      return await loadExistingProfile(userId); 
    }
  }

  // 2. Si aucun userId valide n'est fourni, on cherche si l'IP correspond à un profil PERMANENT existant
  const permanentProfile = await loadPermanentProfile(ipHash);
  if (permanentProfile) {
    // Ajouter la nouvelle IP si elle n'existe pas déjà
    await addIpToProfile(permanentProfile.id, ipHash);
    return permanentProfile;
  }
  
  // 3. Chercher si l'IP est liée à un profil TEMPORAIRE existant
  const existingByIp = await findUserByIpHash(ipHash);
  if (existingByIp) {
    await updateVisitStats(existingByIp.id);
    return existingByIp;
  }
  
  // 4. Sinon, créer un nouveau profil
  return await createNewUser(userId, ip);
}
