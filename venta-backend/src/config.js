/** Configuration validée une fois : tout process.env passe par ici */
import 'dotenv/config';

const env = process.env;
const production = env.NODE_ENV === 'production';

const erreurs = [];
// Toute autre valeur (prod, staging…) prendrait le secret public de dev
if (!['production', 'development', 'test'].includes(env.NODE_ENV)) erreurs.push('NODE_ENV absent ou inconnu : production, development ou test attendu.');
if (production && !env.SERVICE_SECRET) erreurs.push('SERVICE_SECRET absent en production.');
if (!env.MONGODB_URI) erreurs.push('MONGODB_URI absent.');
// Sans nom de base explicite, un serveur de dev écrirait en production
if (!env.MONGODB_DB) erreurs.push('MONGODB_DB absent.');
if (!env.OPENAI_API_KEY) erreurs.push('OPENAI_API_KEY absent.');

// Le relais d'Illusion porte secret, e-mail et CV : jamais en clair en prod
const illusionUrl = (env.ILLUSION_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
if (production && env.ILLUSION_SERVICE_SECRET) {
  try {
    const { protocol, hostname } = new URL(illusionUrl);
    if (protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
      erreurs.push('ILLUSION_URL doit être en https:// en production, sauf sur la machine elle-même.');
    }
  } catch {
    erreurs.push('ILLUSION_URL invalide.');
  }
}

export const config = {
  production,
  // Raisons de refuser le démarrage, vérifiées par server.js
  erreurs,
  port: Number(env.PORT) || 3001,
  // Rien n'est gardé au-delà de ce délai sans activité
  conservationJours: 90,
  // Plafonds de dépense par jour, tous visiteurs : 0 = sans limite, sinon veille
  budget: {
    chat: Number(env.BUDGET_CHAT_PAR_JOUR) || 0,
    tts: Number(env.BUDGET_TTS_PAR_JOUR) || 0,
  },
  // Preuve de travail : 14 bits ≈ 16 000 essais, chaque bit double le temps
  defi: { difficulte: env.DEFI_DIFFICULTE ? Math.min(24, Math.max(0, Math.trunc(Number(env.DEFI_DIFFICULTE)) || 0)) : 14 },
  trustProxy: production || env.TRUST_PROXY === 'true',
  logVerbose: env.LOG_VERBOSE === 'true',
  serviceSecret: env.SERVICE_SECRET || (production ? '' : 'dev-ovrane-service'),
  inviteCode: env.INVITE_CODE || '',
  // Adresse publique pour les liens des e-mails, jamais tirée de l'en-tête Host
  siteUrl: (env.SITE_URL || (production ? '' : 'http://localhost:3000')).replace(/\/+$/, ''),
  mails: { resendKey: env.RESEND_API_KEY, expediteur: env.MAIL_FROM },
  // Pages d'Illusion intégrées : son serveur et son secret, sans lui relais coupé
  illusion: {
    url: illusionUrl,
    secret: env.ILLUSION_SERVICE_SECRET || '',
    // Sans octet d'Illusion pendant ce délai, la requête est abandonnée
    delai: 120_000,
  },
  mongodbUri: env.MONGODB_URI,
  mongodbDb: env.MONGODB_DB,
  openaiApiKey: env.OPENAI_API_KEY,
  openai: {
    model: env.OPENAI_MODEL || 'gpt-5.6-luna',
    // Luna dose déjà son raisonnement ; un tri préalable coûterait ~1 s
    effort: env.OPENAI_REASONING_EFFORT || 'low',
    // Commandes d'interface : plus de raisonnement pour enchaîner les outils
    effortOutils: 'medium',
    verbosity: env.OPENAI_TEXT_VERBOSITY || 'low',
    maxTours: 5,
    // Plafond de sortie par appel, raisonnement compris : borne le coût
    maxOutputTokens: Number(env.OPENAI_MAX_OUTPUT_TOKENS) || 1500,
    // Réécriture des relances et reclassement du RAG ; vide : désactivés
    rag: env.OPENAI_RAG_MODEL ?? 'gpt-5.4-mini',
  },
  tts: {
    // Vrai : la voix du navigateur lit tout, aucun fournisseur appelé
    navigateur: env.TTS_DEFAULT === 'true',
    // Voix principale Inès ; sans langue imposée, Cartesia lit dans celle du texte
    cartesiaKey: env.CARTESIA_API_KEY,
    cartesiaVoice: env.CARTESIA_VOICE_ID || '7c58f4a4-a72c-42fa-a503-41b9408820f3',
    cartesiaModel: 'sonic-3.6',
    elevenKey: env.ELEVEN_API_KEY,
    elevenVoice: env.ELEVEN_VOICE_ID,
    // Flash : le modèle multilingue le plus rapide d'ElevenLabs, français compris
    elevenModel: 'eleven_flash_v2_5',
    elevenVoiceSettings: { stability: 0.35, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true },
    openaiModel: 'tts-1',
    openaiVoice: 'nova',
    openaiSpeed: 1.0,
  },
};
