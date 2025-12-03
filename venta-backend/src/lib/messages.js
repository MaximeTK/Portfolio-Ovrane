/**
 * Centralisation de tous les textes, messages et prompts du projet
 * Pour faciliter la maintenance et l'internationalisation
 */

// ========================================
// PROMPTS ET CONTEXTES SYSTÈME
// ========================================

export const SYSTEM_PROMPTS = {
  // Contexte principal de l'assistant
  mainContext: `Tu es Ovrane, l'assistant intelligent de Hopa. Tu es chargé d'accueillir, d'expliquer et de mettre en valeur les projets du portfolio de Hopa.
  Les projets disponibles sont : Pico`,

  // Instructions pour utilisation du contexte RAG (bonne pertinence)
  ragGoodCoverage: `IMPORTANT - Utilisation du contexte:
      - Tu dois mettre en valeur les projets demandés
      - Réponds UNIQUEMENT en te basant sur le CONTEXTE PERTINENT fourni ci-dessus
      - Si l'information n'est PAS dans le contexte, dis-le clairement ("Je n'ai pas cette information dans ma base de connaissances")
      - Ne JAMAIS inventer ou extrapoler au-delà du contexte fourni
      - Ne mentionne JAMAIS les commandes, fonctions techniques, ou mécanismes backend dans tes réponses
      - Réponds comme un humain normal, sans exposer les détails techniques`,

  // Instructions pour contexte RAG à faible pertinence
  ragLowCoverage: `NOTE: Le contexte fourni a une pertinence faible. Utilise-le avec prudence et indique si tu n'es pas sûr.`,

  // Instructions quand aucun contexte RAG n'est trouvé
  ragNoCoverage: `NOTE: Aucun contexte pertinent trouvé pour cette requête.
      - Si la question concerne les assets/images disponibles, utilise getAvailableAssets("assets disponibles") pour obtenir la liste
      - Si la question concerne un projet, utilise searchKnowledgeBase pour trouver les détails
      - Si tu as besoin d'informations de la base, utilise searchKnowledgeBase de manière proactive`,
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
  openaiKeyMissing: 'Clé API OpenAI manquante',
  openaiResponseEmpty: 'Réponse OpenAI vide',
  internalServerError: 'Erreur interne du serveur',
  
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
  defaultResponse: 'Voici ce que tu as demandé :',
  
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
    description: 'Obtient les règles pour afficher des images. Appelle quand l\'utilisateur demande une image/visuel. Retourne les instructions pour /ShowPicture.',
  },
  
  getAvailableAssets: {
    name: 'getAvailableAssets',
    description: 'Liste toutes les images disponibles. Appelle UNE fois après getRulePicture(). Génère ensuite ta réponse avec /ShowPicture + nom fichier.',
  },
  
  getAvailableColors: {
    name: 'getAvailableColors',
    description: 'Liste les palettes de couleurs pour changer le fond/couleur/thème. Appelle ensuite setAvailableColors().',
  },
  
  setAvailableColors: {
    name: 'setAvailableColors',
    description: 'Quand l\'utilisateur veut changer le fond/couleur/thème. Génère le texte pour la commande /SetBackground + ID palette.',
  },
  
  searchKnowledgeBase: {
    name: 'searchKnowledgeBase',
    description: 'Recherche dans la base de connaissances RAG (projets, histoires, commandes, etc.). Ne pas utiliser pour les images (utilise getAvailableAssets).',
    parameterDescription: 'Requête de recherche (ex: "projet Pico", "histoire de Toty")',
  },
  
  checkUser: {
    name: 'checkUser',
    description: 'CRITIQUE: Appelle CETTE fonction EN PREMIER dès qu\'un nom est mentionné. Vérifie si le nom existe en base. Retourne: exists, isCurrentUser, isTemporaryProfile. Attends le résultat avant de décider de créer/corriger/changer.',
  },
  
  CreateUserProfile: {
    name: 'CreateUserProfile',
    description: 'Crée un profil utilisateur. INTERDIT si checkUser n\'a pas été appelé juste avant. Appelle UNIQUEMENT si checkUser retourne exists:false.',
  },
  
  UpdateUserProfile: {
    name: 'UpdateUserProfile',
    description: 'Corrige le nom du profil actuel. STRICTEMENT RÉSERVÉ aux corrections d\'erreurs explicites. INTERDIT si l\'utilisateur se présente juste avec un nouveau nom (dans ce cas, utilise checkUser puis potentiellement CreateUserProfile).',
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
// La détection des noms est maintenant 100% gérée par l'IA via les fonctions:
// 1. checkUser (vérifie l'existence)
// 2. CreateUserProfile (crée un profil)
// 3. UpdateUserProfile (corrige un nom)
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

