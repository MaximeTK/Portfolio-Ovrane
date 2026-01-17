/**
 * Traitement des informations utilisateur
 */
import { getUserProfile, generateUserHash } from '../userMemory.js';
import { setRequestContext } from '../ragHelpers.js';
import { isValidUserId } from '../validators.js';

/**
 * Traite les informations utilisateur
 */
export async function processUserInfo(req, currentUserId) {
  // Ne pas faire confiance à un userIp/userAgent passé dans le body (spoofable).
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  // const agent = req.headers['user-agent'] || '';

  const safeUserId = isValidUserId(currentUserId) ? currentUserId.trim() : null;
  // SI pas d'ID, on ne génère pas de hash pour le moment (pas de profil implicite)
  const userId = safeUserId || null; 
  
  // Si userId est null, getUserProfile retournera null
  const userProfile = userId ? await getUserProfile(userId, ip) : null;
  
  // IMPORTANT: uiCommands est rempli par les tools ui* pendant l'appel OpenAI.
  // On l'initialise à chaque requête pour éviter toute fuite inter-requêtes.
  setRequestContext({ userId: userId, userProfile: userProfile, ip: ip, uiCommands: [] });
  
  return { userId, userProfile };
}

