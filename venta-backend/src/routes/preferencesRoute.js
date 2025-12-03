/**
 * Route pour gérer les préférences utilisateur
 */
import { getUserProfile, saveUserPreference } from '../lib/userMemory.js';

/**
 * Helper pour extraire les infos de la requête
 */
function prepareUserInfo(req, currentUserId) {
  const ip = req.body.userIp || req.ip || req.connection.remoteAddress || 'unknown';
  return { ip };
}

/**
 * Configuration des routes de préférences
 */
export function setupPreferencesRoute(app) {
  // Sauvegarder une préférence
  app.post('/api/preferences', async (req, res) => {
    try {
      const { currentUserId, preference, value } = req.body;
      
      if (!currentUserId || !preference || value === undefined) {
        return res.status(400).json({ error: 'Paramètres manquants' });
      }
      
      const { ip } = prepareUserInfo(req, currentUserId);
      const userProfile = await getUserProfile(currentUserId, ip);
      
      if (!userProfile) {
        return res.status(404).json({ error: 'Profil utilisateur non trouvé' });
      }
      
      const success = await saveUserPreference(currentUserId, preference, value);
      
      if (success) {
        console.log(`✅ Préférence ${preference} sauvegardée pour ${userProfile.name || currentUserId}: ${value}`);
        res.json({ success: true, message: 'Préférence sauvegardée' });
      } else {
        res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
      }
      
    } catch (error) {
      console.error('❌ Erreur sauvegarde préférence:', error);
      res.status(500).json({ error: 'Erreur interne', details: error.message });
    }
  });
  
  // Charger les préférences
  app.get('/api/preferences/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'userId manquant' });
      }
      
      const { ip } = prepareUserInfo(req, userId);
      const userProfile = await getUserProfile(userId, ip);
      
      if (!userProfile) {
        return res.status(404).json({ error: 'Profil utilisateur non trouvé' });
      }
      
      res.json({ 
        success: true, 
        preferences: userProfile.preferences || {} 
      });
      
    } catch (error) {
      console.error('❌ Erreur chargement préférences:', error);
      res.status(500).json({ error: 'Erreur interne', details: error.message });
    }
  });
}

