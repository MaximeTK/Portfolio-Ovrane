/**
 * Routes d'Illusion : accueil public du recruteur et CV de sa candidature, lus dans la base partagée qu'Illusion remplit
 */
import rateLimit from 'express-rate-limit';
import { IllusionCandidature } from '../models/IllusionCandidature.js';
import { IllusionFichier } from '../models/IllusionFichier.js';
import { CONSOLE_LOGS, EMOJIS, ERROR_MESSAGES } from '../lib/messages.js';
import { isValidJeton } from '../lib/validators.js';

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
 * Le contenu binaire d'un document lu en lean : Binary du pilote MongoDB ou Buffer
 */
function contenu(donnees) {
  if (!donnees) return null;
  if (Buffer.isBuffer(donnees)) return donnees;
  return donnees.buffer ? Buffer.from(donnees.buffer) : null;
}

/**
 * Configuration des routes Illusion
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

  // CV envoyé avec la candidature du jeton : le recruteur voit celui qu'il a reçu, pas un CV générique
  app.get('/api/illusion/cv/:jeton', async (req, res) => {
    try {
      const { jeton } = req.params;
      const candidature = isValidJeton(jeton)
        ? await IllusionCandidature.findOne({ jeton }, { _id: 0, 'cv.fichier': 1 }).lean()
        : null;
      const fichier = candidature?.cv?.fichier
        ? await IllusionFichier.findById(candidature.cv.fichier, { donnees: 1, type: 1 }).lean()
        : null;
      const pdf = contenu(fichier?.donnees);

      if (!pdf) {
        return res.status(404).json({ error: ERROR_MESSAGES.illusionCvNotFound });
      }

      res.set({
        'Content-Type': fichier.type || 'application/pdf',
        'Content-Disposition': 'inline; filename="CV.pdf"',
        'Cache-Control': 'private, no-store',
      });
      res.send(pdf);
    } catch (error) {
      sendInternalError(res, 'cv', error);
    }
  });
}
