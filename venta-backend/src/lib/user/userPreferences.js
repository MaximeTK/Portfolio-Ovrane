/**
 * Gestion des préférences utilisateurs - Version MongoDB
 */
import { User } from '../../models/User.js';
import { EMOJIS } from '../messages.js';

/**
 * Sauvegarde une préférence utilisateur
 */
export async function saveUserPreference(userId, preference, value) {
  try {
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
