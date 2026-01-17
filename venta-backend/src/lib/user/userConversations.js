/**
 * Gestion des conversations utilisateurs - Version MongoDB
 */
import mongoose from 'mongoose';
import { User } from '../../models/User.js';
import { memoryUsers } from '../memoryStore.js';

/**
 * Ajoute une conversation
 */
export async function addConversation(userId, prompt, response, metadata = {}) {
  // Mode mémoire
  if (mongoose.connection.readyState !== 1) {
    const user = memoryUsers.get(userId);
    if (user) {
      if (!user.conversations) user.conversations = [];
      user.conversations.push({
        role: 'user',
        content: prompt,
        timestamp: new Date(),
        prompt: prompt,
        response: response,
        ...metadata
      });
      user.messageCount = (user.messageCount || 0) + 1;
      memoryUsers.set(userId, user);
    }
    return;
  }

  try {
    // Créer l'objet conversation
    // Note: Dans MongoDB on n'a pas besoin de limiter manuellement à 100,
    // on peut utiliser $slice dans $push, mais pour l'instant gardons simple.
    const conversation = {
      role: 'user', // Pour compatibilité avec le schéma, mais on stocke prompt/response dans metadata ou structure libre
      content: prompt, // On stocke le prompt comme contenu principal
      timestamp: new Date(),
      // On stocke les détails spécifiques à ton format actuel
      prompt: prompt,
      response: response,
      ...metadata
    };

    await User.updateOne(
      { id: userId },
      { 
        $push: { 
          conversations: {
            $each: [conversation],
            $slice: -500 // Garder les 500 dernières conversations (environ 1000 messages)
          }
        },
        $inc: { messageCount: 1 }
      }
    );
  } catch (error) {
    console.error('❌ Erreur ajout conversation:', error);
  }
}

/**
 * Met à jour le profil utilisateur
 */
export async function updateUserProfile(userId, updates) {
  // Mode mémoire
  if (mongoose.connection.readyState !== 1) {
    const user = memoryUsers.get(userId) || {};
    const { _id, id, ...safeUpdates } = updates;
    memoryUsers.set(userId, { ...user, ...safeUpdates });
    return;
  }

  try {
    // Retirer les champs protégés
    const { _id, id, ...safeUpdates } = updates;
    
    await User.updateOne(
      { id: userId },
      { $set: safeUpdates }
    );
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
  }
}

/**
 * Récupère l'historique brut des conversations (JSON)
 */
export async function getRawConversationHistory(userId, limit = 50, skip = 0) {
  try {
    let user;

    // Mode mémoire
    if (mongoose.connection.readyState !== 1) {
      user = memoryUsers.get(userId);
    } else {
      user = await User.findOne({ id: userId }).lean();
    }
    
    if (!user) return [];
    
    let allConversations = user.conversations || [];

    // Si c'est un profil lié à un profil principal
    if (user.mainProfileId) {
      try {
        let mainProfile;
        if (mongoose.connection.readyState !== 1) {
            mainProfile = memoryUsers.get(user.mainProfileId);
        } else {
            mainProfile = await User.findOne({ id: user.mainProfileId }).lean();
        }

        if (mainProfile) {
          allConversations = [
            ...(mainProfile.conversations || []),
            ...allConversations
          ];
        }
      } catch (err) {
        console.warn('⚠️ Impossible de charger le profil principal');
      }
    }
    
    // Trier par date
    allConversations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Retourner les N messages avec pagination
    const total = allConversations.length;
    const start = Math.max(0, total - skip - limit);
    const end = Math.max(0, total - skip);
    
    return allConversations.slice(start, end);
  } catch (error) {
    console.error('❌ Erreur récupération historique brut:', error);
    return [];
  }
}

/**
 * Récupère l'historique des conversations formaté pour le prompt
 */
export async function getConversationHistory(userId, limit = 5) {
  try {
    let user;

    // Mode mémoire
    if (mongoose.connection.readyState !== 1) {
      user = memoryUsers.get(userId);
    } else {
      user = await User.findOne({ id: userId }).lean();
    }
    
    if (!user) return '';
    
    let allConversations = user.conversations || [];
      
    // Si c'est un profil lié à un profil principal (legacy logic, peut-être inutile avec MongoDB mais gardons-le)
    if (user.mainProfileId) {
      try {
        let mainProfile;
        if (mongoose.connection.readyState !== 1) {
              mainProfile = memoryUsers.get(user.mainProfileId);
        } else {
              mainProfile = await User.findOne({ id: user.mainProfileId }).lean();
        }
        
        if (mainProfile) {
          // Fusionner les conversations
          allConversations = [
            ...(mainProfile.conversations || []),
            ...(user.conversations || [])
          ];
        }
      } catch (err) {
        console.warn('⚠️ Impossible de charger le profil principal');
      }
    }

    allConversations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return formatHistory(allConversations, user, limit);
  } catch (error) {
    console.error('❌ Erreur récupération historique:', error);
    return '';
  }
}

function formatHistory(allConversations, profile, limit) {
  if (allConversations.length === 0) return '';
  
  const recentConversations = allConversations.slice(-limit);
  let history = '\n\n=== HISTORIQUE DE VOS CONVERSATIONS PRÉCÉDENTES ===\n';
  
  if (profile.name) history += `Nom de l'utilisateur: ${profile.name}\n`;
  history += `Nombre de visites: ${profile.visitCount}\n`;
  history += `Dernière visite: ${new Date(profile.lastVisit).toLocaleDateString('fr-FR')}\n\n`;
  
  recentConversations.forEach((conv) => {
    const date = new Date(conv.timestamp).toLocaleString('fr-FR');
    // Support ancien format (prompt/response) et nouveau format Mongoose (role/content)
    if (conv.prompt && conv.response) {
       history += `[${date}]\nUtilisateur: ${conv.prompt}\nIA: ${conv.response}\n\n`;
    } else {
       // Fallback si structure différente
       history += `[${date}]\n${conv.role}: ${conv.content}\n\n`;
    }
  });
  
  history += '=== FIN DE L\'HISTORIQUE ===\n';
  return history;
}
