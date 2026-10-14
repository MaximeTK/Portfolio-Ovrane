/**
 * Configuration du serveur Express
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES } from '../messages.js';

/**
 * Crée le middleware CORS
 */
function isNgrokOrigin(origin) {
  const o = origin.toLowerCase();
  return o.includes('ngrok') || o.endsWith('.ngrok.io') || o.endsWith('.ngrok-free.app');
}

function createCorsMiddleware(allowedOrigins, { allowNgrok = false, logCors = false } = {}) {
  const allowAll = allowedOrigins.includes('*');
  return cors({
    origin: (origin, callback) => {
      if (logCors) {
        console.log(`🌐 [CORS] Origine: ${origin || 'No Origin'}`);
      }

      // Autoriser les requêtes sans origine (par ex. server-to-server / Postman)
      if (!origin) return callback(null, true);

      if (allowAll) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (allowNgrok && isNgrokOrigin(origin)) return callback(null, true);

      if (logCors) {
        console.log(`❌ [CORS] Origine non autorisée: ${origin}`);
        console.log(`📋 [CORS] Origines autorisées:`, allowedOrigins);
      }

      return callback(new Error(ERROR_MESSAGES.corsNotAllowed));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Admin-Key', 'X-Admin-Token']
  });
}

/**
 * Configure l'application Express
 */
export function configureServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  // Important pour req.ip derrière proxy (Nginx, Vercel, etc.)
  // En prod on active par défaut.
  if (isProd || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');

  // Headers de sécurité (API + assets)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // Limite de taille body (DoS)
  const bodyLimit = process.env.REQUEST_BODY_LIMIT || '1mb';
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: bodyLimit }));

  const allowedOriginsRaw = process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL;
  const allowedOrigins = allowedOriginsRaw
    ? allowedOriginsRaw.split(',').map(s => s.trim()).filter(Boolean)
    : ['http://localhost:3000'];

  const allowNgrok = process.env.ALLOW_NGROK_ORIGINS === 'true' || (!isProd && process.env.ALLOW_NGROK_ORIGINS !== 'false');
  const logCors = !isProd && process.env.LOG_CORS === 'true';

  console.log(`${EMOJIS.tool} ${CONSOLE_LOGS.startup} CORS autorisées:`, allowedOrigins);
  if (allowNgrok) {
    console.log(`${EMOJIS.warning} ${CONSOLE_LOGS.startup} CORS: origines ngrok autorisées (dev/flag)`);
  }

  app.use(createCorsMiddleware(allowedOrigins, { allowNgrok, logCors }));

  // Rate limiting global (anti-abus)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProd ? 300 : 5000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);

  return { app, allowedOrigins };
}

