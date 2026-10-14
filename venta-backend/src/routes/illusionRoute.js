/**
 * Routes d'Illusion : candidatures reçues, visites des liens suivis, accueil public du recruteur
 */
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { IllusionCandidature } from '../models/IllusionCandidature.js';
import { RedirectLog } from '../models/RedirectLog.js';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES } from '../lib/messages.js';
import { isValidJeton } from '../lib/validators.js';

const MAX_LONG_TEXT = 20000;
const MAX_LETTER = 10000;
const MAX_FIELD = 2000;
const MAX_VISITS = 1000;

/**
 * Comparaison en temps constant : les empreintes ont la même longueur quelle que soit la clé fournie
 */
function isValidIllusionKey(provided, expected) {
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Authorization: Bearer <ILLUSION_API_KEY> ; refus par défaut sans clé configurée, comme l'admin
 */
function requireIllusionAuth(req, res, next) {
  const expected = process.env.ILLUSION_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: ERROR_MESSAGES.illusionNotConfigured });
  }

  const auth = req.get('authorization') || '';
  const provided = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!provided || !isValidIllusionKey(provided, expected)) {
    return res.status(401).json({ error: ERROR_MESSAGES.illusionUnauthorized });
  }
  return next();
}

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const asText = (value, max = MAX_FIELD) => (typeof value === 'string' ? value.slice(0, max) : '');
const asList = (value) => (Array.isArray(value)
  ? value.filter((item) => typeof item === 'string').slice(0, 100).map((item) => item.slice(0, 200))
  : []);

/**
 * Ne garde que les champs du schéma d'Illusion, en chaînes tronquées
 */
function normalizeCandidature(body) {
  const offre = asObject(body.offre);
  const entreprise = asObject(body.entreprise);
  const cv = asObject(body.cv);

  return {
    langue: asText(body.langue, 20),
    offre: {
      titre: asText(offre.titre),
      entreprise: asText(offre.entreprise),
      lieu: asText(offre.lieu),
      contrat: asText(offre.contrat),
      url: asText(offre.url),
      description: asText(offre.description, MAX_LONG_TEXT),
      metiers: asList(offre.metiers),
    },
    entreprise: {
      nom: asText(entreprise.nom),
      secteur: asText(entreprise.secteur),
      site: asText(entreprise.site),
      localisation: asText(entreprise.localisation),
      effectif: asText(entreprise.effectif),
      activite: asText(entreprise.activite),
    },
    cv: {
      profil: asText(cv.profil),
      competences: asList(cv.competences),
      texte: asText(cv.texte, MAX_LONG_TEXT),
    },
    lettre: asText(body.lettre, MAX_LETTER),
  };
}

function sendInternalError(res, label, error) {
  const isProd = process.env.NODE_ENV === 'production';
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} Erreur Illusion ${label}:`, msg);
  res.status(500).json({
    error: ERROR_MESSAGES.internalServerError,
    ...(isProd ? {} : { details: msg }),
  });
}

/**
 * Configuration des routes Illusion (corps JSON limité à 200 Ko dans serverConfig)
 */
export function setupIllusionRoutes(app) {
  // Limite propre aux routes Illusion, en plus du limiteur global de /api
  const illusionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/illusion', illusionLimiter);

  // Candidature envoyée par Illusion : upsert par jeton, chaque réception relance les 180 jours
  app.post('/api/illusion/candidatures', requireIllusionAuth, async (req, res) => {
    try {
      const body = asObject(req.body);
      if (!isValidJeton(body.jeton)) {
        return res.status(400).json({ error: ERROR_MESSAGES.illusionInvalidJeton });
      }

      await IllusionCandidature.updateOne(
        { jeton: body.jeton },
        { $set: { ...normalizeCandidature(body), recue_le: new Date() } },
        { upsert: true },
      );
      res.json({ ok: true });
    } catch (error) {
      sendInternalError(res, 'candidature', error);
    }
  });

  // Visites des liens à jeton après `depuis`, par date croissante, jamais l'IP ni le user-agent
  app.get('/api/illusion/visites', requireIllusionAuth, async (req, res) => {
    try {
      const since = req.query.depuis === undefined ? new Date(0) : new Date(String(req.query.depuis));
      if (Number.isNaN(since.getTime())) {
        return res.status(400).json({ error: ERROR_MESSAGES.illusionInvalidSince });
      }

      const logs = await RedirectLog.find(
        { jeton: { $exists: true }, timestamp: { $gt: since } },
        { _id: 0, jeton: 1, cible: 1, timestamp: 1, robot: 1 },
      ).sort({ timestamp: 1, _id: 1 }).limit(MAX_VISITS).lean();

      const visites = logs.map((log) => ({
        jeton: log.jeton,
        cible: log.cible ?? null,
        date: new Date(log.timestamp).toISOString(),
        robot: log.robot === true,
      }));
      // Sans nouvelle visite, le curseur reste sur `depuis`
      res.json({ visites, jusqu_a: visites.length ? visites[visites.length - 1].date : since.toISOString() });
    } catch (error) {
      sendInternalError(res, 'visites', error);
    }
  });

  // Accueil public : entreprise, poste et langue seulement, jamais la lettre, le CV ni l'offre
  app.get('/api/illusion/accueil/:jeton', async (req, res) => {
    try {
      const { jeton } = req.params;
      const candidature = isValidJeton(jeton)
        ? await IllusionCandidature.findOne(
          { jeton },
          { _id: 0, langue: 1, 'offre.titre': 1, 'offre.entreprise': 1, 'entreprise.nom': 1 },
        ).lean()
        : null;

      if (!candidature) {
        return res.status(404).json({ error: ERROR_MESSAGES.illusionNotFound });
      }

      res.json({
        entreprise: candidature.entreprise?.nom || candidature.offre?.entreprise || '',
        poste: candidature.offre?.titre || '',
        langue: candidature.langue || '',
      });
    } catch (error) {
      sendInternalError(res, 'accueil', error);
    }
  });
}
