/**
 * Configuration de toutes les routes du serveur
 */
import fs from 'fs';
import path from 'path';
import { setupChatRoute } from '../../routes/chatRoute.js';
import { setupAdminRoutes } from '../../routes/adminRoutes.js';
import { setupPreferencesRoute } from '../../routes/preferencesRoute.js';
import { handleTTS } from '../../routes/tts.js';
import { loadAssetsFromFrontend } from '../serverHelpers.js';
import { getSystemStats } from '../rag/ragSystem.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../messages.js';

/**
 * Configure les routes principales
 */
export function setupRoutes(app, openai, ragDir, ragInitialized, __dirname) {
  setupChatRoute(app, openai, ragInitialized);
  setupAdminRoutes(app, ragDir, ragInitialized);
  setupPreferencesRoute(app);
  app.post('/api/tts', handleTTS);
  
  setupAssetRoute(app, __dirname);
  setupHealthRoute(app, ragInitialized);
  setupAssetsListRoute(app);
}

/**
 * Route pour récupérer un asset
 */
function setupAssetRoute(app, __dirname) {
  app.get('/api/assets/:filename', (req, res) => {
    const filename = req.params.filename;
    const assetPath = path.join(__dirname, '..', '..', 'Venta', 'public', 'assets', filename);
    if (fs.existsSync(assetPath)) {
      res.sendFile(assetPath);
    } else {
      res.status(404).json({ error: ERROR_MESSAGES.assetNotFound });
    }
  });
}

/**
 * Route de health check
 */
function setupHealthRoute(app, ragInitialized) {
  app.get('/health', async (req, res) => {
    let ragStats = { initialized: false };
    if (ragInitialized) {
      try {
        ragStats = await getSystemStats();
      } catch (error) {
        ragStats = { initialized: true, error: error.message };
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const assets = await loadAssetsFromFrontend(frontendUrl);
    res.json({ assets: assets });
  });
}

