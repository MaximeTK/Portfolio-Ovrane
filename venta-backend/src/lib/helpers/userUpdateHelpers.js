/**
 * Mise à jour de profils utilisateurs - Version MongoDB
 */
import { CONSOLE_LOGS, EMOJIS } from '../messages.js';
import { User } from '../../models/User.js';
import { searchUserByName } from '../user/profileManagement.js';
import { updateUserProfile } from '../user/userConversations.js';

/**
 * Mots-clés de correction
 */
const CORRECTION_KEYWORDS = ['pardon', 'non', 'désolé', 'en fait', 'erreur', 'plutôt', 'corrige', 'correction'];

/**
 * Vérifie si la raison contient un mot-clé de correction
 */
function hasCorrectionKeyword(reason) {
  const reasonLower = (reason || '').toLowerCase();
  return CORRECTION_KEYWORDS.some(keyword => reasonLower.includes(keyword));
}

/**
 * Génère le message d'erreur pour absence de mot-clé
 */
function buildMissingKeywordError(name, currentName, reason) {
  return `❌ ERREUR: UpdateUserProfile nécessite une CORRECTION explicite du nom.

SITUATION ACTUELLE:
- Profil actuel: "${currentName}"
- Nom demandé: "${name}"
- Raison fournie: "${reason || 'aucune'}"

PROBLÈME DÉTECTÉ:
La raison ne contient aucun mot-clé de correction explicite (${CORRECTION_KEYWORDS.join(', ')}).

ANALYSE:
Si l'utilisateur dit simplement "Bonjour, c'est ${name}", cela ne signifie PAS qu'il veut corriger son nom de "${currentName}" vers "${name}". 
C'est probablement un NOUVEL utilisateur qui se présente.

ACTION REQUISE:
- Si c'est une vraie CORRECTION → L'utilisateur doit dire "pardon", "non", "désolé", "en fait mon nom est ${name}", etc.
- Si c'est un NOUVEL utilisateur → Informe-le que "${currentName}" est déjà connecté sur cet appareil.

⚠️ NE PAS modifier le nom sans confirmation explicite de correction !`;
}

/**
 * Met à jour le profil avec le nouveau nom
 */
async function updateProfileName(userId, name) {
  await updateUserProfile(userId, { name: name, correctedAt: new Date() });
  
  // Recharger le profil mis à jour depuis MongoDB
  const updatedUser = await User.findOne({ id: userId }).lean();
  return updatedUser;
}

/**
 * Corrige le nom d'un profil utilisateur
 */
export async function UpdateUserProfile({ name, reason }, currentRequestContext) {
  try {
    if (!currentRequestContext || !currentRequestContext.userId) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} UpdateUserProfile: contexte manquant`);
      return { success: false, message: 'Erreur: contexte utilisateur non disponible' };
    }

    const currentProfile = currentRequestContext.userProfile;
    
    console.log(`${EMOJIS.info} ${CONSOLE_LOGS.functionCall} Tentative de correction du nom utilisateur: "${currentProfile.name}" → "${name}"`);
    if (reason) {
      console.log(`   ${EMOJIS.subitem} Raison IA: ${reason}`);
    }

    if (currentProfile.isTemporary) {
      console.warn(`   ${EMOJIS.warning} Le profil est temporaire`);
      return { success: false, message: `Le profil actuel est temporaire. Utilisez CreateUserProfile pour attribuer un nom.` };
    }
    
    if (!hasCorrectionKeyword(reason)) {
      console.error(`   ${EMOJIS.error} ERREUR: Tentative de changement de nom sans mot-clé de correction !`);
      console.error(`   ${EMOJIS.error} La raison fournie ne contient aucun mot de correction explicite.`);
      console.error(`   ${EMOJIS.error} Raison fournie: "${reason}"`);
      return { success: false, message: buildMissingKeywordError(name, currentProfile.name, reason) };
    }

    const existingUser = await searchUserByName(name);
    
    if (existingUser && existingUser.id !== currentRequestContext.userId) {
      console.warn(`   ${EMOJIS.warning} Le nom "${name}" existe déjà pour un autre utilisateur`);
      return {
        success: false,
        message: `Le nom "${name}" appartient déjà à un autre utilisateur existant. Impossible de corriger vers ce nom.`
      };
    }

    const updatedProfile = await updateProfileName(currentRequestContext.userId, name);
    currentRequestContext.userProfile = updatedProfile;
    
    console.log(`   ${EMOJIS.success} Nom corrigé avec succès: ${name}`);

    return {
      success: true,
      userName: name,
      oldName: currentProfile.name,
      message: `✅ Nom corrigé de "${currentProfile.name}" vers "${name}". Continue la conversation normalement en utilisant le nouveau nom.`
    };

  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Erreur UpdateUserProfile:`, error.message);
    return { success: false, message: `Erreur interne: ${error.message}` };
  }
}
