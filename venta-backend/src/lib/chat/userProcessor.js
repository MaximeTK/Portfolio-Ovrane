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
  const agent = req.headers['user-agent'] || '';

  const safeUserId = isValidUserId(currentUserId) ? currentUserId.trim() : null;
  const userId = safeUserId || generateUserHash(ip, agent);
  
  const userProfile = await getUserProfile(userId, ip);
  
  // IMPORTANT: uiCommands est rempli par les tools ui* pendant l'appel OpenAI.
  // On l'initialise à chaque requête pour éviter toute fuite inter-requêtes.
  setRequestContext({ userId: userId, userProfile: userProfile, ip: ip, uiCommands: [] });
  
  return { userId, userProfile };
}

