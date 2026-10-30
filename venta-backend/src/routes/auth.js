/**
 * Authentification : visiteur, inscription, connexion, mot de passe oublié, compte courant et déconnexion ; chaque profil ouvert reçoit sa session
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { creerSession, lireSession, revoquerSession } from '../services/sessions.js';
import { demanderReinitialisation, reinitialiser } from '../services/reinitialisation.js';
import { compterVisite, profilPublic } from '../services/utilisateurs.js';
import { sendError, egal, limite } from '../http.js';
import { config } from '../config.js';
import { ERROR_MESSAGES, MISC_MESSAGES } from '../messages.js';
import * as log from '../log.js';

const QUINZE_MINUTES = 15 * 60 * 1000;
// Comparé quand le compte n'existe pas : la réponse prend le même temps
const HASH_FACTICE = '$2b$12$0L1gLi8C8ektlGfx8x6i3eeeWUWee6wpIA9Yn3PDcvG/i/M3lACEe';
const PROFIL = { _id: 0, id: 1, name: 1, visitCount: 1, messageCount: 1 };

const identifiant = (valeur) => String(valeur ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
// 8 caractères au moins, comme Illusion qui partage les comptes
const motDePasseValide = (motDePasse) => typeof motDePasse === 'string' && motDePasse.length >= 8 && motDePasse.length <= 128;
const sessionRecue = (req) => req.get('x-ovrane-session');
const accueil = (user) => ({ reply: MISC_MESSAGES.welcomeBack(user.name), userProfile: profilPublic(user, false), activeUserId: user.id });

// Nouvelle session ; celle reçue est révoquée (rotation)
async function ouvrirSession(req, utilisateur) {
  await revoquerSession(sessionRecue(req));
  return creerSession(utilisateur);
}

async function reprendreVisiteur(req, res, next) {
  try {
    const session = await lireSession(sessionRecue(req));
    const courant = session && await User.findOne({ id: session.utilisateur }, PROFIL).lean();
    if (courant) return res.json(accueil(courant));

    // Migration unique de l'ancien localStorage : un visiteur à identifiant aléatoire, jamais un compte ni un profil
    // dont l'identifiant se calcule (pseudo, IP et user-agent)
    const { ancienId } = req.body || {};
    const ancien = typeof ancienId === 'string' && /^v[0-9a-f]{24}$/.test(ancienId) && await User.findOneAndUpdate(
      { id: ancienId, name: null, email: null, passwordHash: null, migreLe: null },
      { $set: { migreLe: new Date() } },
      { returnDocument: 'after', projection: PROFIL },
    ).lean();
    if (ancien) return res.json({ ...accueil(ancien), session: await creerSession(ancien.id) });
    next();
  } catch (error) {
    next(error);
  }
}

async function creerVisiteur(req, res, next) {
  try {
    // Né avec sa session : son identifiant, affiché au client, ne s'échange jamais contre une autre
    const user = { id: `v${crypto.randomBytes(12).toString('hex')}`, migreLe: new Date(), visitCount: 1, lastVisit: new Date(), ipHashes: [], visitedLinks: [], preferences: {}, messageCount: 0, conversations: [] };
    await User.create(user);
    res.json({ reply: MISC_MESSAGES.welcomeNew(), userProfile: profilPublic(user), activeUserId: user.id, session: await creerSession(user.id) });
  } catch (error) {
    next(error);
  }
}

export function setupAuthRoutes(app) {
  const parIp = limite(QUINZE_MINUTES, 10);
  const parIdentifiant = limite(QUINZE_MINUTES, 10, (req) => identifiant(req.body?.identifier));

  // Seule la création compte dans la limite des visiteurs, pas la reprise
  app.post('/api/auth/visitor', reprendreVisiteur, limite(60 * 60 * 1000, 30), creerVisiteur);

  app.post('/api/auth/register', parIp, async (req, res, next) => {
    try {
      const { pseudo, email, password, inviteCode } = req.body || {};
      if (!pseudo || !email || !password || !inviteCode) return sendError(res, 400, ERROR_MESSAGES.fieldsRequired);
      if (!config.inviteCode || !egal(String(inviteCode).trim(), config.inviteCode)) return sendError(res, 403, ERROR_MESSAGES.inviteInvalid);
      // Longueur bornée avant la regex, quadratique sur une longue suite de points
      const emailNorm = identifiant(email);
      if (emailNorm.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) return sendError(res, 400, ERROR_MESSAGES.emailInvalid);
      if (!motDePasseValide(password)) return sendError(res, 400, ERROR_MESSAGES.passwordLength);
      const name = String(pseudo).trim();
      if (!/^[a-zA-Z0-9\s\-_]{1,25}$/.test(name)) return sendError(res, 400, ERROR_MESSAGES.pseudoInvalid);

      const nameNormalized = identifiant(name);
      // Haché avant la recherche : un pseudo ou un email pris ne répond pas plus vite
      const passwordHash = await bcrypt.hash(password, 12);
      if (await User.exists({ $or: [{ nameNormalized }, { email: emailNorm }] })) return sendError(res, 409, ERROR_MESSAGES.accountTaken);

      const id = crypto.createHash('sha256').update(`name:${nameNormalized}`).digest('hex').slice(0, 16);
      const user = { name, nameNormalized, id, email: emailNorm, passwordHash, visitCount: 1, lastVisit: new Date(), ipHashes: [], visitedLinks: [], preferences: {}, messageCount: 0, conversations: [] };
      await User.create(user);
      res.json({ reply: MISC_MESSAGES.welcomeNew(name), userProfile: profilPublic(user), activeUserId: id, session: await ouvrirSession(req, id) });
    } catch (error) {
      if (error.code === 11000) return sendError(res, 409, ERROR_MESSAGES.accountTaken);
      next(error);
    }
  });

  app.post('/api/auth/login', parIp, parIdentifiant, async (req, res, next) => {
    try {
      const { identifier, password } = req.body || {};
      if (!identifier || !password) return sendError(res, 400, ERROR_MESSAGES.loginRequired);

      const ident = identifiant(identifier);
      const compte = await User.findOne({ $or: [{ nameNormalized: ident }, { email: ident }] }, { _id: 0, id: 1, passwordHash: 1 }).lean();
      const valide = await bcrypt.compare(String(password), compte?.passwordHash || HASH_FACTICE);
      if (!compte?.passwordHash || !valide) return sendError(res, 401, ERROR_MESSAGES.invalidCredentials);

      const user = await compterVisite(compte.id);
      res.json({ reply: MISC_MESSAGES.welcomeBack(user.name), userProfile: profilPublic(user, false), activeUserId: user.id, session: await ouvrirSession(req, user.id) });
    } catch (error) {
      next(error);
    }
  });

  // Même réponse, aussitôt, que le compte existe ou non : la recherche et l'envoi se font après la réponse
  const parEmail = limite(60 * 60 * 1000, 3, (req) => identifiant(req.body?.email));
  app.post('/api/auth/oubli', parIp, parEmail, (req, res) => {
    const email = identifiant(req.body?.email);
    res.json({ envoye: true });
    if (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      demanderReinitialisation(email).catch((error) => log.error('[AUTH] mot de passe oublié :', error.message));
    }
  });

  app.post('/api/auth/reinitialiser', parIp, async (req, res, next) => {
    try {
      const { jeton, password } = req.body || {};
      if (!motDePasseValide(password)) return sendError(res, 400, ERROR_MESSAGES.passwordLength);
      if (!(await reinitialiser(jeton, password))) return sendError(res, 400, ERROR_MESSAGES.reinitInvalide);
      res.json({ reinitialise: true });
    } catch (error) {
      next(error);
    }
  });

  // Le compte de la session, null pour un visiteur : la page de connexion montre qui est connecté
  app.get('/api/auth/compte', async (req, res, next) => {
    try {
      const session = await lireSession(sessionRecue(req));
      const user = session && await User.findOne({ id: session.utilisateur }, { _id: 0, name: 1, email: 1 }).lean();
      res.json({ compte: user?.email ? { pseudo: user.name, email: user.email } : null });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', async (req, res, next) => {
    try {
      await revoquerSession(sessionRecue(req));
      res.json({ deconnexion: true });
    } catch (error) {
      next(error);
    }
  });
}
