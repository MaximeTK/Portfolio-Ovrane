/**
 * Routes d'administration
 */
import fs from 'fs';
import path from 'path';
import { reindexFolder, getSystemStats, clearCache } from '../lib/rag/ragSystem.js';
import { getAllUsers } from '../lib/userMemory.js';
import { loadAssetsFromFrontend } from '../lib/serverHelpers.js';
import { fileURLToPath } from 'url';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES, 
  CONSOLE_LOGS, 
  EMOJIS 
} from '../lib/messages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupAdminRoutes(app, ragDir, ragInitialized) {
  // Rechargement du RAG
  app.post('/api/admin/reload-rag', async (req, res) => {
    try {
      console.log(`${EMOJIS.refresh} ${CONSOLE_LOGS.admin} ${CONSOLE_LOGS.ragReindexRequest}`);
      if (!ragInitialized) {
        return res.status(503).json({ error: ERROR_MESSAGES.ragSystemNotInitialized, success: false });
      }
      clearCache(); // Vider le cache avant la réindexation
      const result = await reindexFolder(ragDir, true);
      res.json({ success: result.success, message: SUCCESS_MESSAGES.ragReindexSuccess, ...result });
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.admin} ${ERROR_MESSAGES.ragReindexError}:`, error);
      res.status(500).json({ error: ERROR_MESSAGES.ragReindexError, details: error.message });
    }
  });
  
  // Chargement des assets
  app.post('/api/admin/reload-assets', async (req, res) => {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const assets = await loadAssetsFromFrontend(frontendUrl);
      res.json({ success: true, message: SUCCESS_MESSAGES.assetsLoadSuccess, assets: assets, count: assets.length });
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.admin} ${ERROR_MESSAGES.assetLoadError}:`, error);
      res.status(500).json({ error: ERROR_MESSAGES.assetLoadError, details: error.message });
    }
  });
  
  // Liste des utilisateurs
  app.get('/api/admin/users', (req, res) => {
    try {
      const users = getAllUsers();
      res.json({ success: true, count: users.length, users: users });
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.admin} ${CONSOLE_LOGS.usersListError}`, error);
      res.status(500).json({ error: ERROR_MESSAGES.serverError });
    }
  });
  
  // Détails utilisateur
  app.get('/api/admin/users/:userId', (req, res) => {
    try {
      const userId = req.params.userId;
      const userFile = path.join(__dirname, '..', '..', 'data', 'users', `${userId}.json`);
      if (!fs.existsSync(userFile)) {
        return res.status(404).json({ error: ERROR_MESSAGES.userNotFound });
      }
      const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
      res.json({ success: true, user: userData });
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.admin} ${CONSOLE_LOGS.userDetailsError}`, error);
      res.status(500).json({ error: ERROR_MESSAGES.serverError });
    }
  });
  
  // Stats RAG
  app.get('/api/admin/rag/stats', async (req, res) => {
    try {
      if (!ragInitialized) {
        return res.status(503).json({ error: ERROR_MESSAGES.ragSystemNotInitialized, initialized: false });
      }
      const stats = await getSystemStats();
      res.json({ success: true, ...stats });
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.admin} ${ERROR_MESSAGES.ragStatsError}:`, error);
      res.status(500).json({ error: ERROR_MESSAGES.ragStatsError, details: error.message });
    }
  });
  
  // Vider cache
  app.post('/api/admin/rag/clear-cache', (req, res) => {
    try {
      if (!ragInitialized) {
        return res.status(503).json({ error: ERROR_MESSAGES.ragSystemNotInitialized, success: false });
      }
      clearCache();
      res.json({ success: true, message: SUCCESS_MESSAGES.ragCacheCleared });
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.admin} ${ERROR_MESSAGES.ragCacheClearError}:`, error);
      res.status(500).json({ error: ERROR_MESSAGES.ragCacheClearError, details: error.message });
    }
  });
}

