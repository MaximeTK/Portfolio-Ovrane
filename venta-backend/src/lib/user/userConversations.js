/**
 * Gestion des conversations utilisateurs - max 5 fonctions, max 20 lignes
 */
import fs from 'fs';
import path from 'path';
import { getUsersDir } from './userProfiles.js';

/**
 * Ajoute une conversation
 */
export function addConversation(userId, prompt, response, metadata = {}) {
  const userFile = path.join(getUsersDir(), `${userId}.json`);
  if (!fs.existsSync(userFile)) {
    console.warn(`⚠️ Profil utilisateur non trouvé: ${userId}`);
    return;
  }
  try {
    const profile = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    const conversation = {
      timestamp: new Date().toISOString(),
      prompt: prompt,
      response: response,
      ...metadata
    };
    if (!profile.conversations) profile.conversations = [];
    profile.conversations.push(conversation);
    if (profile.conversations.length > 100) {
      profile.conversations = profile.conversations.slice(-100);
    }
    fs.writeFileSync(userFile, JSON.stringify(profile, null, 2));
  } catch (error) {
    console.error('❌ Erreur ajout conversation:', error);
  }
}

/**
 * Met à jour le profil utilisateur
 */
export function updateUserProfile(userId, updates) {
  const userFile = path.join(getUsersDir(), `${userId}.json`);
  if (!fs.existsSync(userFile)) {
    console.warn(`⚠️ Profil utilisateur non trouvé: ${userId}`);
    return;
  }
  try {
    const profile = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    Object.assign(profile, updates);
    fs.writeFileSync(userFile, JSON.stringify(profile, null, 2));
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
  }
}

/**
 * Récupère l'historique des conversations
 */
export function getConversationHistory(userId, limit = 5) {
  const userFile = path.join(getUsersDir(), `${userId}.json`);
  if (!fs.existsSync(userFile)) return '';
  
  try {
    let profile = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    let allConversations = [...(profile.conversations || [])];
    
    if (profile.mainProfileId) {
      const mainProfileFile = path.join(getUsersDir(), `${profile.mainProfileId}.json`);
      if (fs.existsSync(mainProfileFile)) {
        try {
          const mainProfile = JSON.parse(fs.readFileSync(mainProfileFile, 'utf8'));
          allConversations = [
            ...(mainProfile.conversations || []),
            ...allConversations
          ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          profile = mainProfile;
        } catch (err) {
          console.warn('⚠️ Impossible de charger le profil principal');
        }
      }
    }
    
    return formatHistory(allConversations, profile, limit);
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
    history += `[${date}]\nUtilisateur: ${conv.prompt}\nIA: ${conv.response}\n\n`;
  });
  
  history += '=== FIN DE L\'HISTORIQUE ===\n';
  return history;
}

