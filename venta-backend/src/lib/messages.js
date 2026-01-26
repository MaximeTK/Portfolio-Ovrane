/**
 * Centralisation de tous les textes, messages et prompts du projet
 * Pour faciliter la maintenance et l'internationalisation
 */

// ========================================
// PROMPTS ET CONTEXTES SYSTÈME
// ========================================

export const SYSTEM_PROMPTS = {
  // Contexte principal de l'assistant
  mainContext: `Tu es Ovrane, l'assistant intelligent de Maxime (Maxime Thiong-kay). Tu es chargé d'accueillir, d'expliquer et de mettre en valeur les projets du portfolio de Maxime.
  Les projets disponibles sont : Hikup, une application de randonnée, Ovrane, le portfolio ici présent et Pico, une application de communication pour les personnes non verbales. Tu es capable d'afficher de fournir des informations sur les projets, des images, du code, de changer le theme du portfolio.

  IMPORTANT - Style (ton humain):
  - Réponse détaillé obligatoirement, il n'y a pas de réponse courte sauf si l'utilisateur demande une réponse courte.
  - Adopte un ton naturel et professionnel, simple et chaleureux. Évite les formulations rigides du type "a été affiché avec succès" ou les fins génériques "n'hésitez pas...".
  - Fais court après une action UI:
    - Image: "Voici le logo de Pico." / "Voilà l’interface de Pico." (une seule phrase suffit)
    - Fond: "OK, je passe le thème en <nom>." (et c'est tout)
   - Interdits (images):
     - Évite absolument les tournures passives type "ont été affichées :" / "a été affichée avec succès".
     - Évite les listes vides ou les titres sur plusieurs lignes après une action UI.
   - Si plusieurs images ont été affichées d'un coup, résume en UNE phrase:
     - Exemple: "Voici l’interface et le logo de Pico."
  - Ne répète pas les instructions ou la liste des tools.
  - vouvoiement: ne tutoie pas l'utilisateur.

  IMPORTANT - Contexte & historique:
  - Tu dois répondre à des questions, n'hésite pas à expliquer de manière technique si nécessaire, tu te base sur un RAG rediger par Maxime Thiong-kay, tu n'as donc jamais tord concernant les informations que tu possèdes.
  - Tu es un assistant qui est sur un portfolio interactif, ne parle pas du portfolio comme si c'était un site externe, tu es déjà sur le portfolio et l'utilisateur est aussi sur le portfolio.
  - Tu reçois un historique de conversation (messages Utilisateur/Assistant). UTILISE-LE pour comprendre le contexte.
  - Si l'utilisateur fait une demande courte ou elliptique (ex: "En plus simplifié ?", "En anglais mtn", "Nickel, fais-le du coup", "OK continue", etc...),
    applique-la par défaut à la DERNIÈRE réponse pertinente de l'assistant / au dernier sujet discuté, sans demander de précision.
  - Ne demande une clarification que si c'est réellement impossible d'inférer l'intention.
  - Il est impossible d'accèder aux projets tu ne peux fournir que des images et des explications sur les projets.
  - Tu es une IA qui tourne avec l'api d'openAI et alimenté par un RAG (Recherche d'Information Approfondie) qui te permet de répondre à des questions sur les projets.
  - Pour "en anglais" / "traduis": traduis la dernière réponse pertinente en anglais en gardant le sens.

  IMPORTANT - Fond / UI:
  - Tu reçois une info fiable "FOND ACTUEL (palette): <id>".
  - Quand l'utilisateur demande de changer le fond, déclenche l'action via le tool uiSetBackground({ paletteId }).
  - N'affirme "déjà en X" QUE si l'ID demandé est identique à FOND ACTUEL (palette). Sinon, confirme le changement.

  IMPORTANT - Commandes UI (PRIMORDIAL):
  - Tu as des tools pour interagir avec l'interface. Quand c'est pertinent pour améliorer l'expérience, TU DOIS les utiliser.
  - IMPORTANT: La messagerie n'affiche QUE des bulles. Donc:
    - Si l'utilisateur demande du code (snippet/exemple), réponds DIRECTEMENT dans le message avec un bloc Markdown (ex: \`\`\`c ... \`\`\`).
    - N'utilise PAS de tool UI pour afficher du code.
  - Actions UI disponibles (via tools):
    - Afficher une ou plusieurs images: uiShowPicture({ filenames: ["..."] })
    - Changer le fond: uiSetBackground({ paletteId })
    - Ouvrir une fenêtre: uiOpenWindow({ title })
  - INTERDIT d'écrire des slash-commandes dans le texte. Le frontend n'exécute plus ces commandes textuelles.
  - INTERDIT de dire "voici une image / je t'affiche / je montre" si tu n'as pas déclenché uiShowPicture({ filenames: [...] }). Même règle pour le fond sans uiSetBackground({ paletteId }).
  - Si l'utilisateur demande une image PRÉCISE (ex: "affiche l'interface", "montre le logo"), tu dois déclencher UNIQUEMENT l'image demandée (ne rajoute pas d'autres images "bonus").
  - Si le RAG fournit des filenames exacts, tu peux appeler uiShowPicture directement (pas besoin de getAvailableAssets).
  - Ne prétends JAMAIS que tu ne peux pas afficher des images ou changer le fond.
  - N'invente JAMAIS un nom de fichier ou une palette:
    - utilise getAvailableAssets() pour obtenir/valider les images avant uiShowPicture()
    - utilise getAvailableColors() pour obtenir/valider les palettes avant uiSetBackground()`,

  // Instructions pour utilisation du contexte RAG (bonne pertinence)
  ragGoodCoverage: `IMPORTANT - Utilisation du contexte:
      - Le CONTEXTE PERTINENT ci-dessus est une source d'information SUPPLÉMENTAIRE.
      - Si (et seulement si) la question concerne le portfolio, Maxime, Hikup, Des projets, Ovrane, Pico, des histoires, ou des informations présentes dans ce contexte, utilise-le pour répondre avec précision.
      - Si la question est générale (ex: programmation, culture générale, etc.) et que le contexte n'apporte rien, IGNORE-LE et répond normalement.
      - N'invente jamais des informations spécifiques au portfolio si elles ne sont pas dans le contexte.
      - Ne mentionne jamais les mécanismes RAG/tools/techniques dans ta réponse.`,

  // Instructions pour contexte RAG à faible pertinence
  ragLowCoverage: `NOTE: Le contexte fourni a une pertinence faible.
      - Utilise-le uniquement s'il aide réellement à répondre.
      - Si c'est hors sujet, ignore-le et répond normalement.`,

  // Instructions quand aucun contexte RAG n'est trouvé
  ragNoCoverage: `NOTE: Aucun contexte pertinent trouvé pour cette requête.
      - Si la question demande un visuel (image/logo/photo/interface), utilise getRulePicture puis getAvailableAssets, puis déclenche l'affichage avec uiShowPicture().
      - Si la question concerne le portfolio/projets/histoires, réponds avec les informations disponibles (le RAG est déjà injecté côté backend si pertinent).
      - Sinon, répond normalement sans appeler d'outil inutile.`,
};

// ========================================
// HEADERS RAG
// ========================================

export const RAG_HEADERS = {
  contextRelevant: 'CONTEXTE PERTINENT (Connaissance de base):',
  contextLowRelevance: 'CONTEXTE (pertinence faible):',
  errorContext: '[ERREUR: Impossible de récupérer le contexte]',
  userCurrent: 'UTILISATEUR ACTUEL:',
  userAnonymous: 'UTILISATEUR: Visiteur anonyme (profil temporaire)',
  visits: 'visites',
};

// ========================================
// MESSAGES D'ERREUR
// ========================================

export const ERROR_MESSAGES = {
  // Erreurs API
  promptRequired: 'Prompt requis',
  promptInvalid: 'Prompt manquant ou invalide',
  promptTooLong: 'Prompt trop long',
  invalidUserId: 'Identifiant utilisateur invalide',
  openaiKeyMissing: 'Clé API OpenAI manquante',
  openaiResponseEmpty: 'Réponse OpenAI vide',
  internalServerError: 'Erreur interne du serveur',
  badRequest: 'Requête invalide',
  
  // Erreurs RAG
  ragRetrievalError: 'Erreur retrieval RAG:',
  ragSystemNotInitialized: 'Système RAG non initialisé',
  ragReindexError: 'Erreur lors de la réindexation du RAG',
  ragNoDocuments: 'Aucun document trouvé',
  ragFileNotFound: 'Fichier non trouvé:',
  ragStatsError: 'Erreur lors de la récupération des stats',
  ragCacheClearError: 'Erreur lors du vidage du cache',
  
  // Erreurs utilisateur
  userProfileReadError: 'Erreur lecture profil utilisateur:',
  userProfileNotFound: 'Profil non trouvé',
  userNotFound: 'Utilisateur non trouvé',
  userMergeError: 'Erreur fusion profils:',
  userProfileDoesNotExist: 'Un des profils n\'existe pas',
  
  // Erreurs assets
  assetNotFound: 'Asset non trouvé',
  assetLoadError: 'Erreur lors du chargement des assets',
  assetFilenameInvalid: 'Nom de fichier asset invalide',
  assetsFileNotFound: 'Fichier assets.txt non trouvé',
  assetsRetrievalError: 'Erreur récupération assets:',
  assetsFromFrontendError: 'Impossible de récupérer depuis le frontend:',
  
  // Erreurs TTS
  ttsTextRequired: 'Texte requis',
  ttsElevenLabsError: 'Eleven Labs erreur:',
  ttsElevenLabsNoCredits: 'Plus de crédits Eleven Labs',
  ttsElevenLabsException: 'Eleven Labs exception:',
  ttsOpenAIError: 'OpenAI erreur:',
  ttsGlobalError: 'Erreur globale:',
  
  // Erreurs générales
  serverError: 'Erreur serveur',
  corsNotAllowed: 'Not allowed by CORS',
  fileMovedError: 'ERREUR : Fichier déplacé',

  // Erreurs admin
  adminUnauthorized: 'Accès admin non autorisé',
  adminNotConfigured: 'Accès admin non configuré',

  // Erreurs préférences
  preferencesMissingParams: 'Paramètres manquants',
  preferencesUserNotFound: 'Profil utilisateur non trouvé',
  preferencesSaveError: 'Erreur lors de la sauvegarde',
  preferencesUserIdMissing: 'userId manquant',

  // Erreurs tracking
  trackingMissingParams: 'Paramètres manquants (userId, link)',
  trackingUserNotFound: 'Profil utilisateur non trouvé',
  trackingInvalidLink: 'Lien invalide',

  // Erreurs historique
  historyUserIdRequired: 'userId requis',
  
  // Limites
  limitReached: 'Vous avez beaucoup discuté ! J\'espère que la démonstration vous a plu. Pour aller plus loin ou discuter d\'un projet, je vous invite à me contacter directement.',
};

// ========================================
// MESSAGES DE SUCCÈS ET INFO
// ========================================

export const SUCCESS_MESSAGES = {
  // RAG
  ragReindexSuccess: 'Contenu RAG réindexé avec succès',
  ragInitialized: 'Système RAG initialisé et prêt!',
  ragIndexUpdated: 'Index mis à jour avec succès',
  ragCacheCleared: 'Cache vidé avec succès',
  
  // Assets
  assetsLoadSuccess: 'Assets chargés avec succès depuis le frontend',
  assetsListRetrieved: 'Liste des assets récupérée',
  
  // OpenAI
  openaiResponseReceived: 'Réponse finale OpenAI reçue',
  
  // Général
  healthOK: 'OK',

  // Préférences
  preferencesSaved: 'Préférence sauvegardée',

  // Tracking
  trackingLinkSaved: 'Lien enregistré',
  trackingLinkAlreadySaved: 'Lien déjà présent ou erreur mineure',
};

// ========================================
// LOGS CONSOLE
// ========================================

export const CONSOLE_LOGS = {
  // Préfixes
  backend: '[BACKEND]',
  admin: '[ADMIN]',
  rag: '[RAG]',
  ragSystem: '[RAG-SYSTEM]',
  assets: '[ASSETS]',
  functionCall: '[FUNCTION-CALL]',
  tts: '[TTS]',
  startup: '[STARTUP]',
  
  // Messages généraux
  ragInitializing: 'Initialisation du système RAG...',
  ragReady: 'Système RAG prêt',
  ragReindexRequest: 'Demande de réindexation du RAG',
  ragFileModified: 'Fichier modifié:',
  ragReindexInProgress: 'Réindexation déjà en cours, ignorée',
  ragReindexingFolder: 'Réindexation du dossier:',
  ragUpdatingDocument: 'Mise à jour du document:',
  
  // OpenAI
  openaiCallInProgress: 'Appel OpenAI API en cours...',
  openaiWantsToCall: 'L\'IA veut appeler',
  openaiModelInfo: 'Modèle: gpt-5-mini | 🧠 Reasoning: medium | 💬 Verbosity: medium',
  openaiSystemPrompt: 'SYSTEM PROMPT:',
  openaiUserPrompt: 'USER PROMPT:',
  openaiFunction: 'Fonction:',
  openaiArguments: 'Arguments:',
  openaiFunctionCallLimitReached: 'Limite d\'appels de fonctions atteinte',
  openaiResponseStructure: 'Structure de réponse OpenAI:',
  
  // Assets
  assetsRetrieving: 'Récupération de la liste des assets',
  
  // Recherche
  searchRAG: 'Recherche RAG:',
  searchFound: 'chunk(s) trouvé(s)',
  
  // Serveur
  serverStarted: 'Serveur Venta démarré !',
  serverLocal: 'Local:',
  serverNetwork: 'Réseau (LAN):',
  serverNgrok: 'ngrok (public):',
  serverRAGSystem: 'Système RAG:',
  serverRAGActivated: 'Activé',
  serverRAGChunksIndexed: 'chunks indexés',
  serverRAGSources: 'Sources:',
  serverRAGConfig: 'Config:',
  serverRAGInitializing: 'En cours d\'initialisation...',
  serverAssets: 'Assets (REMOTE):',
  serverAssetsLoadedOnRequest: 'Chargés À CHAQUE REQUÊTE depuis',
  serverCORSFrontend: 'CORS Frontend:',
  serverNetworkAccess: 'Pour accès réseau local, utilise une de ces IPs:',
  serverStatsNotAvailable: 'stats non disponibles',
  
  // Utilisateurs
  usersListError: 'Erreur liste utilisateurs:',
  userDetailsError: 'Erreur détails utilisateur:',
};

// ========================================
// MESSAGES DIVERS
// ========================================

export const MISC_MESSAGES = {
  // Réponse par défaut
  defaultResponse: 'Voilà.',

  // Messages d'accueil standardisés (TTS + UI)
  welcomeNew: (name) => `Bienvenue ${name}, enchantée de faire votre connaissance. En quoi puis-je vous aider ?`,
  welcomeBack: (name) => `Ravie de vous revoir ${name}, en quoi puis-je vous aider ?`,
  
  // RAG
  ragNoInformation: 'Aucune information pertinente trouvée dans la base de connaissances.',
  ragAssetsListMessage: 'Liste complète des assets disponibles',
  
  // Headers HTTP
  httpContentType: 'Content-Type',
  httpContentLength: 'Content-Length',
  httpCacheControl: 'Cache-Control',
  httpNoCacheValue: 'no-cache',
  httpTTSProvider: 'X-TTS-Provider',
  
  // Types de contenu
  contentTypeJSON: 'application/json',
  contentTypeAudioMPEG: 'audio/mpeg',
};

// ========================================
// DESCRIPTIONS DES TOOLS (Function Calling)
// ========================================

export const TOOL_DESCRIPTIONS = {
  getRulePicture: {
    name: 'getRulePicture',
    description: 'Obtient les règles pour afficher des images. Appelle quand l\'utilisateur demande une image/visuel. Retourne les instructions de process (assets + tool UI).',
  },
  
  getAvailableAssets: {
    name: 'getAvailableAssets',
    description: 'Liste toutes les images disponibles (assets). Appelle uniquement si tu ne connais pas le filename exact ou si tu dois valider qu\'il existe. Si le RAG donne déjà des filenames exacts, appelle directement uiShowPicture({ filenames: [...] }).',
  },
  
  getAvailableColors: {
    name: 'getAvailableColors',
    description: 'Liste les palettes de couleurs. PRIORITAIRE sur la gestion utilisateur si l\'utilisateur mentionne une couleur (ex: "en rouge", "rose"), un thème ou demande de changer l\'apparence. Ensuite, déclenche uiSetBackground.',
  },

  setAvailableColors: {
    name: 'setAvailableColors',
    description: 'DEPRECATED: ancien tool. Ne pas utiliser.',
  },

  uiShowPicture: {
    name: 'uiShowPicture',
    description: 'Déclenche l\'affichage d\'une ou plusieurs images (assets) dans l\'interface. Utilise TOUJOURS uiShowPicture({ filenames: ["A.png","B.png"] }) pour éviter les limites. À appeler après validation via getAvailableAssets() si nécessaire. Ne pas écrire de slash-commandes dans le texte.',
  },

  uiSetBackground: {
    name: 'uiSetBackground',
    description: 'Déclenche le changement de fond (palette). À appeler après avoir validé paletteId via getAvailableColors(). Ne pas écrire de slash-commandes dans le texte.',
  },

  uiShowCode: {
    name: 'uiShowCode',
    description: 'DEPRECATED: Ne pas utiliser. Le code doit être renvoyé dans le message (bloc Markdown) et non affiché via une fenêtre UI.',
  },

  uiOpenWindow: {
    name: 'uiOpenWindow',
    description: 'Ouvre une fenêtre générique dans l\'interface avec un titre. Ne pas écrire de slash-commandes dans le texte.',
  },
  
  // searchKnowledgeBase retiré
  
  checkUser: {
    name: 'checkUser',
    description: 'CRITIQUE: Appelle CETTE fonction quand l\'utilisateur parle de son NOM/PROFIL (identité). Vérifie si le nom existe en base. INTERDIT d\'utiliser pour des couleurs (ex: "en rouge", "rose"), thèmes, ou noms de fichiers/assets. Retourne: exists, isCurrentUser. Attends le résultat avant de décider.',
  },
  
  SwitchUserProfile: {
    name: 'SwitchUserProfile',
    description: 'Bascule vers un profil existant. Appelle quand checkUser confirme que le profil existe et n\'est pas l\'actuel.',
  },
};

// ========================================
// MESSAGES DE REDIRECTION
// ========================================

export const REDIRECT_MESSAGES = {
  fileMovedTitle: '⚠️  FICHIER DE REDIRECTION',
  fileMovedMessage: 'Le serveur a été déplacé vers src/server.js',
  fileMovedInstructions: `Pour démarrer le serveur, utilisez :
  npm start       (mode production)
  npm run dev     (mode développement)

Si vous devez vraiment lancer directement avec node :
  node src/server.js`,
  fileMovedError: '❌ ERREUR : Fichier déplacé',
  fileMovedErrorDetail: 'Le fichier server.js a été déplacé vers src/server.js',
  fileMovedSolutionsTitle: '✅ Solutions :',
  fileMovedSolution1: '1. Utilisez npm start ou npm run dev (recommandé)',
  fileMovedSolution2: '2. Lancez directement : node src/server.js',
  fileMovedDocumentation: '📚 Documentation : voir STRUCTURE.md',
};

// ========================================
// CONFIGURATION TTS
// ========================================

export const TTS_CONFIG = {
  // Eleven Labs
  elevenLabsModel: 'eleven_multilingual_v2',
  elevenLabsVoiceSettings: {
    stability: 0.35,
    similarity_boost: 0.75,
    style: 0.5,
    use_speaker_boost: true,
  },
  
  // OpenAI
  openaiModel: 'tts-1',
  openaiVoice: 'nova',
  openaiSpeed: 1.0,

  // OpenAI Realtime
  openaiRealtimeModel: 'gpt-4o-mini-realtime-preview-2024-12-17',
  openaiRealtimeVoice: 'alloy',
  openaiRealtimeSampleRate: 24000,
  openaiRealtimeTemperature: 0.6,
  openaiRealtimeTimeoutMs: 15000,
  openaiRealtimeInstructions: 'Tu es un moteur TTS. Prononce uniquement le texte fourni, en français, avec un ton naturel et chaleureux, sans rien ajouter ni reformuler.',
};

// ========================================
// CONFIGURATION OPENAI
// ========================================

export const OPENAI_CONFIG = {
  model: 'gpt-5-mini',
  toolChoice: 'auto',
  reasoningEffort: 'medium',      // Effort de raisonnement: low, medium, high
  textVerbosity: 'medium',      // Verbosité du texte: low, medium, high
  maxFunctionCalls: 5,
};

// ========================================
// CONFIGURATION OPENAI 4O-MINI (Chat Completions API)
// ========================================

export const OPENAI_4O_CONFIG = {
  model: 'gpt-4o-mini',
  toolChoice: 'auto',
  temperature: 0.7,
  maxTokens: 2000,
  maxFunctionCalls: 5,
};

// ========================================
// EMOJIS ET SYMBOLES
// ========================================

export const EMOJIS = {
  // Status
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  
  // Actions
  loading: '⏳',
  refresh: '🔄',
  search: '🔍',
  tool: '🔧',
  
  // Objets
  rocket: '🚀',
  book: '📚',
  picture: '🎨',
  robot: '🤖',
  check: '✓',
  cross: '✗',
  
  // Autres
  separator: '═',
  arrow: '→',
  subitem: '└─',
};

// ========================================
// NOTES: PATTERNS REGEX SUPPRIMÉS
// ========================================
// Les patterns EXCLUDED_WORDS et NAME_PATTERNS ont été supprimés.
// La gestion des profils par tools IA est limitée à:
// 1. checkUser (vérifie l'existence)
// 2. SwitchUserProfile (bascule vers un profil existant)
// ========================================
// FONCTIONS UTILITAIRES POUR LES MESSAGES
// ========================================

/**
 * Formate un message de log avec préfixe et emoji
 */
export function formatLog(prefix, message, emoji = '') {
  return `${emoji} ${prefix} ${message}`;
}

/**
 * Formate un message utilisateur
 */
export function formatUserInfo(name, visitCount) {
  if (name) {
    return `${RAG_HEADERS.userCurrent} ${name} (${visitCount} ${RAG_HEADERS.visits})`;
  }
  return RAG_HEADERS.userAnonymous;
}

/**
 * Crée un séparateur visuel
 */
export function createSeparator(char = EMOJIS.separator, length = 60) {
  return char.repeat(length);
}

export default {
  SYSTEM_PROMPTS,
  RAG_HEADERS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  CONSOLE_LOGS,
  MISC_MESSAGES,
  TOOL_DESCRIPTIONS,
  REDIRECT_MESSAGES,
  TTS_CONFIG,
  OPENAI_CONFIG,
  EMOJIS,
  formatLog,
  formatUserInfo,
  createSeparator,
};

