/**
 * Application Express : en-têtes, sonde, limite globale, secret de service, routes et erreur finale
 */
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { requireService, limite, sendError, sendInternalError } from './http.js';
import { ERROR_MESSAGES } from './messages.js';
import { setupHealthRoute } from './routes/health.js';
import { setupAuthRoutes } from './routes/auth.js';
import { setupChatRoutes } from './routes/chat.js';
import { setupPreferencesRoutes } from './routes/preferences.js';
import { setupTrackingRoutes } from './routes/tracking.js';
import { setupTTSRoutes } from './routes/tts.js';
import { setupIllusionRoutes } from './routes/illusion.js';

export function createApp({ openai }) {
  const app = express();
  app.disable('x-powered-by');
  // req.ip derrière le proxy de Render ; l'IP d'un visiteur relayé par Next arrive dans X-Ovrane-Client-Ip
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));

  // Avant la limite et le secret : la sonde de Render passe toujours
  setupHealthRoute(app);
  app.use(limite(15 * 60 * 1000, config.production ? 300 : 5000));
  app.use(requireService);
  app.use(express.json());

  setupAuthRoutes(app);
  setupChatRoutes(app, openai);
  setupPreferencesRoutes(app);
  setupTrackingRoutes(app);
  setupTTSRoutes(app, openai);
  setupIllusionRoutes(app);
  // Illusion derrière la connexion se montera ici : app.use('/api/illusion', requireSession, ...)

  app.use((req, res) => sendError(res, 404, ERROR_MESSAGES.notFound));
  app.use(sendInternalError);
  return app;
}
