/** Authentification : visiteur, inscription, connexion, oubli, compte */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { creerSession, lireSession, revoquerSession } from '../services/sessions.js';
import { demanderReinitialisation, reinitialiser } from '../services/reinitialisation.js';
import { demanderVerification, verifier } from '../services/verification.js';
import { compterVisite, profilPublic, PROFIL } from '../services/utilisateurs.js';
import { signerVoix } from '../services/voix.js';
import { defiResolu, nouveauDefi } from '../services/defi.js';
import { appareilDe, marquerAppareil } from '../services/appareils.js';
import { sendError, egal, limite, requireSession } from '../http.js';
import { config } from '../config.js';
import { ERROR_MESSAGES, MISC_MESSAGES } from '../messages.js';
import * as log from '../log.js';

const QUINZE_MINUTES = 15 * 60 * 1000;
// Comparé quand le compte n'existe pas : la réponse prend le même temps
const HASH_FACTICE = '$2b$12$0L1gLi8C8ektlGfx8x6i3eeeWUWee6wpIA9Yn3PDcvG/i/M3lACEe';

const identifiant = (valeur) => String(valeur ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
// 12 caractères au moins (CNIL 2022-100), comme Illusion
const motDePasseValide = (motDePasse) => typeof motDePasse === 'string' && motDePasse.length >= 12 && motDePasse.length <= 128;
// Longueur bornée avant la regex, quadratique sur une longue suite de points
const emailValide = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const sessionRecue = (req) => req.get('x-ovrane-session');
// L'accueil part signé : la voix du serveur ne lit que ses propres textes
const dit = (reply) => ({ reply, voix: signerVoix(reply) });
const accueil = (user) => ({ ...dit(MISC_MESSAGES.welcomeBack(user.name)), userProfile: profilPublic(user, false), activeUserId: user.id });
const bienvenue = (user) => ({ ...dit(MISC_MESSAGES.welcomeNew(user.name)), userProfile: profilPublic(user), activeUserId: user.id });
// Compteurs et listes d'un profil neuf, visite d'arrivée comptée
const neuf = () => ({ visitCount: 1, lastVisit: new Date(), ipHashes: [], visitedLinks: [], preferences: {}, messageCount: 0, conversations: [] });

// Nouvelle session, marque d'appareil ; celle reçue est révoquée (rotation)
async function ouvrirSession(req, utilisateur) {
  await revoquerSession(sessionRecue(req));
  return { session: await creerSession(utilisateur), appareil: marquerAppareil(utilisateur) };
}

async function reprendreVisiteur(req, res, next) {
  try {
    const session = await lireSession(sessionRecue(req));
    const courant = session && await User.findOne({ id: session.utilisateur }, PROFIL).lean();
    if (courant) return res.json(accueil(courant));

    // Migration de l'ancien localStorage : un visiteur aléatoire, jamais un compte
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

// Un nouveau visiteur paie une preuve de travail ; le refus porte le défi
async function exigerDefi(req, res, next) {
  try {
    const { defi, solution } = req.body || {};
    if (await defiResolu(defi, solution)) return next();
    res.status(403).json({ error: ERROR_MESSAGES.defiRequis, ...nouveauDefi() });
  } catch (error) {
    next(error);
  }
}

// Compte visé par la connexion, cherché une fois pour limite et vérification
async function compteVise(req, res, next) {
  try {
    const ident = identifiant(req.body?.identifier);
    req.compte = ident ? await User.findOne({ $or: [{ nameNormalized: ident }, { email: ident }] }, { _id: 0, id: 1, passwordHash: 1 }).lean() : null;
    next();
  } catch (error) {
    next(error);
  }
}

async function creerVisiteur(req, res, next) {
  try {
    // Né avec sa session : son identifiant ne s'échange jamais contre un autre
    const user = { id: `v${crypto.randomBytes(12).toString('hex')}`, migreLe: new Date(), ...neuf() };
    await User.create(user);
    res.json({ ...bienvenue(user), session: await creerSession(user.id) });
  } catch (error) {
    next(error);
  }
}

export function setupAuthRoutes(app) {
  const parIp = limite(QUINZE_MINUTES, 10);
  // 10 échecs par identifiant, sauf depuis un appareil déjà connu du compte
  const parIdentifiant = limite(QUINZE_MINUTES, 10, (req) => identifiant(req.body?.identifier), {
    skip: (req) => appareilDe(req.get('x-ovrane-appareil'), req.compte?.id),
    skipSuccessfulRequests: true,
  });

  // Seule la création compte dans la limite des visiteurs, défi résolu
  app.post('/api/auth/visitor', reprendreVisiteur, exigerDefi, limite(60 * 60 * 1000, 10), creerVisiteur);

  app.post('/api/auth/register', parIp, async (req, res, next) => {
    try {
      const { pseudo, email, password, inviteCode } = req.body || {};
      if (!pseudo || !email || !password || !inviteCode) return sendError(res, 400, ERROR_MESSAGES.fieldsRequired);
      if (!config.inviteCode || !egal(String(inviteCode).trim(), config.inviteCode)) return sendError(res, 403, ERROR_MESSAGES.inviteInvalid);
      const emailNorm = identifiant(email);
      if (!emailValide(emailNorm)) return sendError(res, 400, ERROR_MESSAGES.emailInvalid);
      if (!motDePasseValide(password)) return sendError(res, 400, ERROR_MESSAGES.passwordLength);
      const name = String(pseudo).trim();
      if (!/^[a-zA-Z0-9\s\-_]{1,25}$/.test(name)) return sendError(res, 400, ERROR_MESSAGES.pseudoInvalid);

      const nameNormalized = identifiant(name);
      // Haché avant la recherche : un pseudo ou un email pris ne répond pas plus vite
      const passwordHash = await bcrypt.hash(password, 12);
      if (await User.exists({ $or: [{ nameNormalized }, { email: emailNorm }] })) return sendError(res, 409, ERROR_MESSAGES.accountTaken);

      const id = crypto.createHash('sha256').update(`name:${nameNormalized}`).digest('hex').slice(0, 16);
      const user = { name, nameNormalized, id, email: emailNorm, passwordHash, ...neuf() };
      await User.create(user);
      res.json({ ...bienvenue(user), ...await ouvrirSession(req, id) });
      // Après la réponse : l'adresse se prouve par le lien, avant d'ouvrir Illusion
      demanderVerification({ id, name, email: emailNorm }).catch((error) => log.error('[AUTH] vérification :', error.message));
    } catch (error) {
      if (error.code === 11000) return sendError(res, 409, ERROR_MESSAGES.accountTaken);
      next(error);
    }
  });

  app.post('/api/auth/login', parIp, compteVise, parIdentifiant, async (req, res, next) => {
    try {
      const { identifier, password } = req.body || {};
      if (!identifier || !password) return sendError(res, 400, ERROR_MESSAGES.loginRequired);

      const { compte } = req;
      const valide = await bcrypt.compare(String(password), compte?.passwordHash || HASH_FACTICE);
      if (!compte?.passwordHash || !valide) return sendError(res, 401, ERROR_MESSAGES.invalidCredentials);

      const user = await compterVisite(compte.id);
      res.json({ ...accueil(user), ...await ouvrirSession(req, user.id) });
    } catch (error) {
      next(error);
    }
  });

  // Même réponse aussitôt, compte existant ou non ; envoi après la réponse
  const parEmail = limite(60 * 60 * 1000, 3, (req) => identifiant(req.body?.email));
  app.post('/api/auth/oubli', parIp, parEmail, (req, res) => {
    const email = identifiant(req.body?.email);
    res.json({ envoye: true });
    if (emailValide(email)) demanderReinitialisation(email).catch((error) => log.error('[AUTH] mot de passe oublié :', error.message));
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

  // Compte de la session, null pour un visiteur
  app.get('/api/auth/compte', async (req, res, next) => {
    try {
      const session = await lireSession(sessionRecue(req));
      const user = session && await User.findOne({ id: session.utilisateur }, { _id: 0, name: 1, email: 1, emailVerifieLe: 1 }).lean();
      res.json({ compte: user?.email ? { pseudo: user.name, email: user.email, emailVerifie: Boolean(user.emailVerifieLe) } : null });
    } catch (error) {
      next(error);
    }
  });

  // Nouveau lien pour l'adresse de la session, 3 par heure ; sinon déjà vérifiée
  const parCompte = limite(60 * 60 * 1000, 3, (req) => req.user.id);
  app.post('/api/auth/verification', requireSession, parCompte, async (req, res, next) => {
    try {
      const user = await User.findOne({ id: req.user.id }, { _id: 0, id: 1, name: 1, email: 1, emailVerifieLe: 1 }).lean();
      if (!user?.email) return sendError(res, 400, ERROR_MESSAGES.illusionAccountRequired);
      res.json({ envoye: true });
      if (!user.emailVerifieLe) demanderVerification(user).catch((error) => log.error('[AUTH] vérification :', error.message));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/verifier', parIp, async (req, res, next) => {
    try {
      if (!(await verifier(req.body?.jeton))) return sendError(res, 400, ERROR_MESSAGES.verificationInvalide);
      res.json({ verifie: true });
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
