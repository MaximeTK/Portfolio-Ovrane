/**
 * Gestion des préférences utilisateurs - Version MongoDB
 */
import mongoose from 'mongoose';
import { User } from '../../models/User.js';
import { EMOJIS } from '../messages.js';
import { memoryUsers } from '../memoryStore.js';

/**
 * Sauvegarde une préférence utilisateur
 */
export async function saveUserPreference(userId, preference, value) {
  try {
    if (!userId || typeof userId !== 'string') return false;
    if (!preference || typeof preference !== 'string') return false;
    // Protection simple contre clés Mongo dangereuses
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(preference)) return false;

    // Mode mémoire si MongoDB indisponible
    if (mongoose.connection.readyState !== 1) {
      const user = memoryUsers.get(userId);
      if (!user) return false;
      if (!user.preferences) user.preferences = {};
      user.preferences[preference] = value;
      memoryUsers.set(userId, user);
      return true;
    }

    const updatePath = `preferences.${preference}`;
    
    const result = await User.updateOne(
      { id: userId },
      { $set: { [updatePath]: value } }
    );
    
    return result.modifiedCount > 0 || result.matchedCount > 0;
  } catch (error) {
    console.error(`${EMOJIS.error} Erreur sauvegarde préférence:`, error);
    return false;
  }
}

/**
 * Sauvegarde un lien visité (sans doublon)
 */
export async function saveVisitedLink(userId, link) {
  try {
    if (!userId || typeof userId !== 'string') return false;
    if (!link || typeof link !== 'string') return false;
    if (link.length > 2048) return false;

    // Mode mémoire
    if (mongoose.connection.readyState !== 1) {
      const user = memoryUsers.get(userId);
      if (!user) return false;
      if (!user.visitedLinks) user.visitedLinks = [];
      if (!user.visitedLinks.includes(link)) {
        user.visitedLinks.push(link);
        memoryUsers.set(userId, user);
        return true;
      }
      return false;
    }
    
    const result = await User.updateOne(
      { id: userId },
      { $addToSet: { visitedLinks: link } }
    );

    return result.modifiedCount > 0 || result.matchedCount > 0;
  } catch (error) {
    console.error(`${EMOJIS.error || '❌'} Erreur sauvegarde lien visité:`, error);
    return false;
  }
}