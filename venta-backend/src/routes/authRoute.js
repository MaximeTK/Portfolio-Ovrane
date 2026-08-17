/**
 * Routes d'authentification : inscription et connexion
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { MISC_MESSAGES } from '../lib/messages.js';

function normalizeUserName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function generateUserIdFromName(nameNormalized) {
  return crypto.createHash('sha256').update(`name:${nameNormalized}`).digest('hex').substring(0, 16);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function setupAuthRoutes(app) {
  app.post('/api/auth/register', async (req, res) => {
    const { pseudo, email, password, inviteCode } = req.body || {};

    if (!pseudo || !email || !password || !inviteCode) {
      return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    const expectedInvite = process.env.INVITE_CODE;
    if (!expectedInvite || String(inviteCode).trim() !== expectedInvite) {
      return res.status(403).json({ error: 'Code d\'invitation invalide.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email invalide.' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const pseudoTrim = String(pseudo).trim();
    if (!/^[a-zA-Z0-9\s\-_]{1,25}$/.test(pseudoTrim)) {
      return res.status(400).json({ error: 'Pseudo invalide (lettres, chiffres, espace, tiret, underscore, max 25 caractères).' });
    }

    const nameNormalized = normalizeUserName(pseudoTrim);
    const userId = generateUserIdFromName(nameNormalized);
    const emailNorm = String(email).trim().toLowerCase();

    try {
      const [existingName, existingEmail] = await Promise.all([
        User.findOne({ nameNormalized }).lean(),
        User.findOne({ email: emailNorm }).lean(),
      ]);

      if (existingName) return res.status(409).json({ error: 'Ce pseudo est déjà utilisé.' });
      if (existingEmail) return res.status(409).json({ error: 'Cet email est déjà utilisé.' });

      const passwordHash = await bcrypt.hash(password, 12);
      const now = new Date();

      await User.create({
        name: pseudoTrim,
        nameNormalized,
        id: userId,
        email: emailNorm,
        passwordHash,
        visitCount: 1,
        lastVisit: now,
        ipHashes: [],
        visitedLinks: [],
        preferences: {},
        messageCount: 0,
        conversations: [],
      });

      const reply = MISC_MESSAGES.welcomeNew(pseudoTrim);
      return res.json({
        reply,
        userProfile: { name: pseudoTrim, visitCount: 1, isNewUser: true, messageCount: 0 },
        activeUserId: userId,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: 'Ce pseudo ou email est déjà utilisé.' });
      }
      console.error('❌ [AUTH] Erreur register:', error.message);
      return res.status(500).json({ error: 'Erreur interne.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
    }

    const identNorm = String(identifier).trim().toLowerCase();

    try {
      const user = await User.findOne({
        $or: [{ nameNormalized: identNorm }, { email: identNorm }],
      }).lean();

      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
      }

      const valid = await bcrypt.compare(String(password), user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
      }

      const now = new Date();
      const lastVisit = user.lastVisit ? new Date(user.lastVisit) : new Date(0);
      const shouldIncrement = now.getTime() - lastVisit.getTime() > 3_600_000;

      await User.updateOne(
        { id: user.id },
        shouldIncrement
          ? { $set: { lastVisit: now }, $inc: { visitCount: 1 } }
          : { $set: { lastVisit: now } },
      );

      const visitCount = shouldIncrement ? (user.visitCount || 0) + 1 : (user.visitCount || 0);
      const reply = MISC_MESSAGES.welcomeBack(user.name);

      return res.json({
        reply,
        userProfile: { name: user.name, visitCount, isNewUser: false, messageCount: user.messageCount || 0 },
        activeUserId: user.id,
      });
    } catch (error) {
      console.error('❌ [AUTH] Erreur login:', error.message);
      return res.status(500).json({ error: 'Erreur interne.' });
    }
  });
}
