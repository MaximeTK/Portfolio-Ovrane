/**
 * Illusion : accueil du recruteur et CV de sa candidature, lus dans la base partagée qu'Illusion remplit
 */
import { IllusionCandidature } from '../models/IllusionCandidature.js';
import { IllusionFichier } from '../models/IllusionFichier.js';
import { noterActivite } from '../services/conservation.js';
import { sendError } from '../http.js';
import * as log from '../log.js';
import { ERROR_MESSAGES, MISC_MESSAGES } from '../messages.js';
import { signerVoix } from '../services/voix.js';
import { isValidJeton } from '../validators.js';

// Contenu binaire d'un document lu en lean : Binary du pilote MongoDB ou Buffer
function contenu(donnees) {
  if (!donnees) return null;
  if (Buffer.isBuffer(donnees)) return donnees;
  return donnees.buffer ? Buffer.from(donnees.buffer) : null;
}

export function setupIllusionRoutes(app) {
  // Entreprise, poste et langue seulement, jamais la lettre, le CV ni l'offre
  app.get('/api/illusion/accueil', async (req, res, next) => {
    try {
      const { jeton } = req.query;
      const candidature = isValidJeton(jeton)
        ? await IllusionCandidature.findOne({ jeton }, { _id: 0, langue: 1, 'offre.titre': 1, 'offre.entreprise': 1, 'entreprise.nom': 1 }).lean()
        : null;
      if (!candidature) return sendError(res, 404, ERROR_MESSAGES.illusionNotFound);
      const accueil = {
        entreprise: candidature.entreprise?.nom || candidature.offre?.entreprise || '',
        poste: candidature.offre?.titre || '',
        langue: candidature.langue || '',
      };
      const texte = MISC_MESSAGES.recruiterWelcome(accueil);
      res.json({ ...accueil, texte, voix: texte ? signerVoix(texte) : '' });
      // Après la réponse : le recruteur n'attend pas l'écriture qui garde sa candidature active
      noterActivite(jeton).catch((error) => log.error('[ILLUSION] Activité non notée :', error.message));
    } catch (error) {
      next(error);
    }
  });

  // CV envoyé avec la candidature du jeton : le recruteur voit celui qu'il a reçu, pas un CV générique
  app.get('/api/illusion/cv/:jeton', async (req, res, next) => {
    try {
      const { jeton } = req.params;
      const candidature = isValidJeton(jeton)
        ? await IllusionCandidature.findOne({ jeton }, { _id: 0, 'cv.fichier': 1 }).lean()
        : null;
      const fichier = candidature?.cv?.fichier
        ? await IllusionFichier.findById(candidature.cv.fichier, { donnees: 1 }).lean()
        : null;
      const pdf = contenu(fichier?.donnees);
      if (!pdf) return sendError(res, 404, ERROR_MESSAGES.illusionCvNotFound);

      res.set({
        // Jamais le type rangé en base : un text/html s'exécuterait sur le domaine du portfolio
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="CV.pdf"',
        'Cache-Control': 'private, no-store',
      });
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });
}
