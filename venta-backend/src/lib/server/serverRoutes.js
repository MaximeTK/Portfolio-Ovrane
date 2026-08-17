/**
 * Configuration de toutes les routes du serveur
 */
import fs from 'fs';
import path from 'path';
import { setupChatRoute } from '../../routes/chatRoute.js';
import { setupAuthRoutes } from '../../routes/authRoute.js';
import { setupAdminRoutes } from '../../routes/adminRoutes.js';
import { setupPreferencesRoute } from '../../routes/preferencesRoute.js';
import { setupTrackingRoute } from '../../routes/trackingRoute.js';
import { handleTTS } from '../../routes/tts.js';
import { loadAssetsFromFrontend } from '../serverHelpers.js';
import { getSystemStats } from '../rag/ragSystem.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../messages.js';
import { isValidAssetFilename } from '../validators.js';

/**
 * Configure les routes principales
 */
export function setupRoutes(app, openai, ragDir, ragInitialized, __dirname) {
  setupChatRoute(app, openai, ragInitialized);
  setupAuthRoutes(app);
  setupAdminRoutes(app, ragDir, ragInitialized);
  setupPreferencesRoute(app);
  setupTrackingRoute(app);
  app.post('/api/tts', handleTTS);
  
  setupAssetRoute(app, __dirname);
  setupHealthRoute(app, ragInitialized);
  setupAssetsListRoute(app);
}

/**
 * Route pour récupérer un asset
 */
function setupAssetRoute(app, __dirname) {
  const assetsDir = path.join(__dirname, '..', '..', 'Venta', 'public', 'assets');
  const assetsDirResolved = path.resolve(assetsDir);
  const assetsDirPrefix = assetsDirResolved.endsWith(path.sep) ? assetsDirResolved : assetsDirResolved + path.sep;

  app.get('/api/assets/:filename', (req, res) => {
    const filename = String(req.params.filename || '').trim();

    if (!isValidAssetFilename(filename)) {
      return res.status(400).json({ error: ERROR_MESSAGES.assetFilenameInvalid });
    }

    const assetPath = path.resolve(path.join(assetsDirResolved, filename));
    if (!assetPath.startsWith(assetsDirPrefix)) {
      return res.status(400).json({ error: ERROR_MESSAGES.assetFilenameInvalid });
    }

    if (fs.existsSync(assetPath)) {
      return res.sendFile(assetPath);
    }

    return res.status(404).json({ error: ERROR_MESSAGES.assetNotFound });
  });
}

/**
 * Route de health check
 */
function setupHealthRoute(app, ragInitialized) {
  app.get('/health', async (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    let ragStats = { initialized: false };
    if (ragInitialized) {
      try {
        ragStats = await getSystemStats();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        ragStats = { initialized: true, error: isProd ? ERROR_MESSAGES.internalServerError : msg };
      }
    }
    res.json({ 
      status: SUCCESS_MESSAGES.healthOK, 
      timestamp: new Date().toISOString(), 
      rag: ragStats 
    });
  });
}

/**
 * Route pour lister les assets
 */
function setupAssetsListRoute(app) {
  app.get('/api/assets', async (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    try {
      const assets = await loadAssetsFromFrontend(frontendUrl);
      res.json({ assets: assets });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(502).json({
        error: ERROR_MESSAGES.assetLoadError,
        ...(isProd ? {} : { details: msg }),
      });
    }
  });
}

