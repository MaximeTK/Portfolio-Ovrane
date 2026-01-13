/**
 * Vérification des utilisateurs
 */
import { CONSOLE_LOGS, EMOJIS } from '../messages.js';

/**
 * Vérifie si le contexte est valide
 */
function validateContext(context) {
  return context && context.userId;
}

function clearPendingCreation(context) {
  if (context && context.pendingUserCreation) {
    context.pendingUserCreation = null;
  }
}

function looksLikeAssetOrFileName(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  // URLs/paths → pas un nom humain
  if (/^https?:\/\//i.test(raw)) return true;
  if (/[\\/]/.test(raw)) return true;
  // Extensions courantes → asset/fichier
  if (/\.(png|jpe?g|txt)\b/i.test(raw)) return true;
  return false;
}

/**
 * Compare deux noms (insensible à la casse)
 */
function namesMatch(name1, name2) {
  return name1 && name2 && name1.toLowerCase().trim() === name2.toLowerCase().trim();
}

/**
 * Génère le message de réponse quand l'utilisateur n'existe pas
 */
function buildUserNotFoundMessage(name, currentProfile) {
  // IMPORTANT: ne jamais pousser à créer automatiquement un profil (risque de confusion assets->user).
  const hint = currentProfile?.isTemporary
    ? 'Si (et seulement si) l’utilisateur exprime clairement que c’est son nom, tu peux convertir le profil temporaire.'
    : 'Si (et seulement si) l’utilisateur exprime clairement que c’est son nom, tu peux créer un nouveau profil.';
  return `Le nom "${name}" n'existe pas en base de données. ${hint}`;
}

/**
 * Vérifie si un nom existe en base de données
 */
export async function checkUser({ name }, currentRequestContext) {
  console.log(`\n🔵 [FUNCTION START] checkUser | Paramètres: name="${name}"`);
  
  try {
    if (!validateContext(currentRequestContext)) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} checkUser: contexte manquant`);
      const result = { success: false, message: 'Erreur: contexte utilisateur non disponible' };
      console.log(`❌ [FUNCTION END] checkUser | Retour: contexte manquant\n`);
      return result;
    }

    console.log(`${EMOJIS.search} ${CONSOLE_LOGS.functionCall} Vérification du nom: "${name}"`);
    // Source du bug: l'IA passait des noms d'assets ("Pico Logo.png") à checkUser → création de profils.
    // Correctif: on refuse ces valeurs et on n'arme JAMAIS une création de profil pour ça.
    if (looksLikeAssetOrFileName(name)) {
      clearPendingCreation(currentRequestContext);
      return {
        success: true,
        exists: null,
        isCurrentUser: false,
        currentUserName: currentRequestContext.userProfile?.name || null,
        isTemporaryProfile: currentRequestContext.userProfile?.isTemporary || false,
        ignored: true,
        message:
          `Paramètre ignoré: "${name}" ressemble à un nom de fichier/asset. ` +
          `Ne pas appeler CreateUserProfile. Pour afficher une image, utilise uiShowPicture({ filename }).`,
      };
    }
    
    const { searchUserByName } = await import('../user/profileManagement.js');
    const existingUser = await searchUserByName(name);
    
    const currentProfile = currentRequestContext.userProfile;
    clearPendingCreation(currentRequestContext);
    const isCurrentUser = namesMatch(currentProfile?.name, name);
    
    if (!existingUser) {
      console.log(`   ${EMOJIS.info} Nom "${name}" non trouvé en base de données`);
      return {
        success: true,
        exists: false,
        isCurrentUser: false,
        currentUserName: currentProfile?.name || null,
        isTemporaryProfile: currentProfile?.isTemporary || false,
        // IMPORTANT: checkUser ne déclenche jamais de création automatique.
        // La création doit être faite uniquement quand l'utilisateur exprime clairement un intent "profil".
        message: `Le nom "${name}" n'existe pas. ATTENTION: Si l'utilisateur parlait d'une COULEUR, d'un THÈME ou d'une APPARENCE (ex: "en rose", "mode sombre"), N'APPELLE PAS CreateUserProfile mais utilise getAvailableColors() ou répond simplement. Si (et seulement si) c'est explicitement un nouveau NOM de profil (ex: "Je m'appelle ${name}"), appelle CreateUserProfile.`
      };
    }
    
    if (isCurrentUser) {
      console.log(`   ${EMOJIS.info} "${name}" est le nom du profil actuel`);
      clearPendingCreation(currentRequestContext);
      return {
        success: true,
        exists: true,
        isCurrentUser: true,
        currentUserName: currentProfile.name,
        isTemporaryProfile: false,
        message: `"${name}" est déjà le nom du profil actuel. Aucune action nécessaire.`
      };
    }
    
    console.log(`   ${EMOJIS.warning} "${name}" existe en base mais n'est PAS le profil actuel`);
    clearPendingCreation(currentRequestContext);
    return {
      success: true,
      exists: true,
      isCurrentUser: false,
      currentUserName: currentProfile?.name || null,
      isTemporaryProfile: currentProfile?.isTemporary || false,
      existingUserInfo: { id: existingUser.id, name: existingUser.name, visitCount: existingUser.visitCount },
      message: `Le nom "${name}" existe en base mais appartient à un autre utilisateur. L'IA doit déterminer selon le contexte si c'est une correction de nom (appeler UpdateUserProfile) ou bien le nom de l'utilisateur actuel (appeler SwitchUserProfile si c'est le cas et que le profil actuel n'est pas le bon ET que ça ne semble pas etre une correction de nom) ou bien juste un contexte ("je vais chez ${name}"), tu n'as pas le droit de demander des précisions sur le nom de l'utilisateur.`
    };

  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.functionCall} Erreur checkUser:`, error.message);
    return { success: false, message: `Erreur interne: ${error.message}` };
  }
}

