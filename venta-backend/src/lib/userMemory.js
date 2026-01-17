/**
 * Module principal de gestion utilisateurs
 * Point d'entrée centralisé qui réexporte les fonctions
 */

// Réexporter depuis userProfiles.js
export { generateUserHash } from './user/userProfiles.js';

// Réexporter depuis userConversations.js
export { addConversation, updateUserProfile, getConversationHistory, getRawConversationHistory } from './user/userConversations.js';

// Réexporter depuis profileManagement.js
export { 
  searchUserByName,
  getAllUsers 
} from './user/profileManagement.js';

// Réexporter depuis userProfileLoader.js
export { getUserProfile } from './user/userProfileLoader.js';

// Réexporter depuis userMerge.js
export { mergeUserProfiles } from './user/userMerge.js';

// Réexporter depuis userPreferences.js
export { saveUserPreference, saveVisitedLink } from './user/userPreferences.js';
