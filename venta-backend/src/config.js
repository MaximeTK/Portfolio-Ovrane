/**
 * Configuration lue et validée une fois : tout process.env passe par ici
 */
import 'dotenv/config';

const env = process.env;
const production = env.NODE_ENV === 'production';

const erreurs = [];
// Toute autre valeur (prod, staging…) prendrait le secret public de développement
if (!['production', 'development', 'test'].includes(env.NODE_ENV)) erreurs.push('NODE_ENV absent ou inconnu : production, development ou test attendu.');
if (production && !env.SERVICE_SECRET) erreurs.push('SERVICE_SECRET absent en production.');
if (!env.MONGODB_URI) erreurs.push('MONGODB_URI absent.');
// Sans nom de base explicite, un serveur de dev écrirait dans la base de production
if (!env.MONGODB_DB) erreurs.push('MONGODB_DB absent.');
if (!env.OPENAI_API_KEY) erreurs.push('OPENAI_API_KEY absent.');

export const config = {
  production,
  // Raisons de refuser le démarrage, vérifiées par server.js
  erreurs,
  port: Number(env.PORT) || 3001,
  // Visiteurs, conversations et clics : rien n'est gardé au-delà de ce délai sans activité
  conservationJours: 90,
  trustProxy: production || env.TRUST_PROXY === 'true',
  logVerbose: env.LOG_VERBOSE === 'true',
  serviceSecret: env.SERVICE_SECRET || (production ? '' : 'dev-ovrane-service'),
  inviteCode: env.INVITE_CODE || '',
  // Adresse publique du site pour les liens des e-mails, jamais déduite de la requête (en-tête Host falsifiable)
  siteUrl: (env.SITE_URL || (production ? '' : 'http://localhost:3000')).replace(/\/+$/, ''),
  mails: { resendKey: env.RESEND_API_KEY, expediteur: env.MAIL_FROM },
  // Pages d'Illusion intégrées au site : son serveur et le secret qu'il attend de ce backend ; sans secret, le relais est coupé
  illusion: {
    url: (env.ILLUSION_URL || 'http://127.0.0.1:8000').replace(/\/+$/, ''),
    secret: env.ILLUSION_SERVICE_SECRET || '',
    // Sans un octet d'Illusion pendant ce délai, la requête est abandonnée : un CV bâti ou l'essai d'un modèle y tiennent
    delai: 120_000,
  },
  mongodbUri: env.MONGODB_URI,
  mongodbDb: env.MONGODB_DB,
  openaiApiKey: env.OPENAI_API_KEY,
  openai: {
    model: env.OPENAI_MODEL || 'gpt-5.6-luna',
    // Luna dose déjà son raisonnement selon la question ; un tri préalable coûterait ~1 s de plus
    effort: env.OPENAI_REASONING_EFFORT || 'low',
    // Commandes d'interface proposées : plus de raisonnement pour enchaîner les outils
    effortOutils: 'medium',
    verbosity: env.OPENAI_TEXT_VERBOSITY || 'low',
    maxTours: 5,
  },
  tts: {
    // Vrai : la voix du navigateur lit tout, aucun fournisseur appelé
    navigateur: env.TTS_DEFAULT === 'true',
    // Voix principale, Inès par défaut ; sans langue imposée, Cartesia lit chaque texte dans la sienne
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
