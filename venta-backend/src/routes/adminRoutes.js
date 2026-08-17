/**
 * Routes d'administration
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import { reindexFolder, getSystemStats, clearCache } from '../lib/rag/ragSystem.js';
import { getAllUsers } from '../lib/userMemory.js';
import { loadAssetsFromFrontend } from '../lib/serverHelpers.js';
import { User } from '../models/User.js';
import { memoryUsers } from '../lib/memoryStore.js';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES, 
  CONSOLE_LOGS, 
  EMOJIS 
} from '../lib/messages.js';
import { isValidUserId } from '../lib/validators.js';

function extractAdminKey(req) {
  const headerKey = req.get('x-admin-key') || req.get('x-admin-token');
  if (headerKey) return headerKey.trim();
  const auth = req.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function timingSafeEquals(a, b) {
  if (!a || !b) return false;
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  try {
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function requireAdminAuth(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;

  // Refus par défaut. L'ancienne version laissait passer quand la clé n'était pas
  // configurée ET que NODE_ENV n'était pas "production" — or NODE_ENV n'était pas
  // définie sur Render, donc les routes admin servaient la base entière à qui la
  // demandait. Une porte ne s'ouvre jamais parce qu'une variable manque.
  if (!adminKey) {
    return res.status(503).json({ error: ERROR_MESSAGES.adminNotConfigured });
  }

  const provided = extractAdminKey(req);
  if (!timingSafeEquals(provided, adminKey)) {
    return res.status(401).json({ error: ERROR_MESSAGES.adminUnauthorized });
  }
  return next();
}

export function setupAdminRoutes(app, ragDir, ragInitialized) {
  // Protéger toutes les routes admin
  app.use('/api/admin', requireAdminAuth);

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
      res.status(500).json({ error: ERROR_MESSAGES.ragReindexError });
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
      res.status(500).json({ error: ERROR_MESSAGES.assetLoadError });
    }
  });
  
  // Liste des utilisateurs
  app.get('/api/admin/users', async (req, res) => {
    try {
      const users = await getAllUsers();
      res.json({ success: true, count: users.length, users: users });
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.admin} ${CONSOLE_LOGS.usersListError}`, error);
      res.status(500).json({ error: ERROR_MESSAGES.serverError });
    }
  });
  
  // Détails utilisateur
  app.get('/api/admin/users/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;

      if (!isValidUserId(userId)) {
        return res.status(400).json({ error: ERROR_MESSAGES.invalidUserId });
      }

      const includeConversations = String(req.query.includeConversations || 'false') === 'true';

      let user;
      if (mongoose.connection.readyState !== 1) {
        user = memoryUsers.get(userId) || null;
      } else {
        user = await User.findOne({ id: userId }).lean();
      }

      if (!user) {
        return res.status(404).json({ error: ERROR_MESSAGES.userNotFound });
      }

      if (!includeConversations && user.conversations) {
        const { conversations, ...rest } = user;
        const conversationCount = Array.isArray(conversations) ? conversations.length : 0;
        return res.json({ success: true, user: { ...rest, conversationCount } });
      }

      return res.json({ success: true, user });
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
      res.status(500).json({ error: ERROR_MESSAGES.ragStatsError });
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
      res.status(500).json({ error: ERROR_MESSAGES.ragCacheClearError });
    }
  });
}

