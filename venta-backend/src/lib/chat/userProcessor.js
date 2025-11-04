/**
 * Traitement des informations utilisateur
 */
import { getUserProfile, generateUserHash } from '../userMemory.js';
import { setRequestContext } from '../ragHelpers.js';

/**
 * Traite les informations utilisateur
 */
export async function processUserInfo(req, currentUserId) {
  const ip = req.body.userIp || req.ip || req.connection.remoteAddress || 'unknown';
  const agent = req.body.userAgent || req.headers['user-agent'] || '';
  const userId = currentUserId || generateUserHash(ip, agent);
  
  const userProfile = getUserProfile(userId, ip);
  
  setRequestContext({ userId: userId, userProfile: userProfile, ip: ip });
  
  return { userId, userProfile };
}

