/**
 * Gestion des conversations utilisateurs - Version MongoDB
 */
import { User } from '../../models/User.js';

/**
 * Ajoute une conversation
 */
export async function addConversation(userId, prompt, response, metadata = {}) {
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
            $slice: -100 // Garder seulement les 100 derniers
          }
        } 
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
    const user = await User.findOne({ id: userId }).lean();
    
    if (!user) return [];
    
    let allConversations = user.conversations || [];

    // Si c'est un profil lié à un profil principal
    if (user.mainProfileId) {
      try {
        const mainProfile = await User.findOne({ id: user.mainProfileId }).lean();
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
    // slice(-limit) prend les derniers, mais avec skip c'est plus complexe sur un tableau en mémoire
    // Pour une pagination standard "remonter le temps":
    // On veut les messages de (Total - Skip - Limit) à (Total - Skip)
    
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
    const user = await User.findOne({ id: userId }).lean();
    
    if (!user) return '';
    
    let allConversations = user.conversations || [];
    
    // Si c'est un profil lié à un profil principal (legacy logic, peut-être inutile avec MongoDB mais gardons-le)
    if (user.mainProfileId) {
      try {
        const mainProfile = await User.findOne({ id: user.mainProfileId }).lean();
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
  history += `Première visite: ${new Date(profile.firstVisit).toLocaleDateString('fr-FR')}\n\n`;
  
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
