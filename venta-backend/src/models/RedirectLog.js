/**
 * Modèle pour les logs de redirection (tracking CV, etc.)
 * Indépendant des profils utilisateurs classiques.
 */
import mongoose from 'mongoose';

// Cibles des liens suivis, transmises par le middleware du frontend
export const REDIRECT_CIBLES = ['cv', 'cvdesign', 'linkedin', 'github', 'portfolio'];

const redirectLogSchema = new mongoose.Schema({
  path: {
    type: String,
    required: true,
    index: true // Pour pouvoir filtrer par campagne facilement (ex: "combien de clics sur ubisoft")
  },
  target: {
    type: String,
    required: true
  },
  // Liens d'Illusion : jeton de la candidature, absent sur les anciens liens
  jeton: {
    type: String,
    index: true,
    sparse: true
  },
  cible: {
    type: String,
    enum: REDIRECT_CIBLES
  },
  // Déduit du user-agent par le serveur, qui ne garde que ce verdict : scanner de messagerie, aperçu, crawler...
  robot: {
    type: Boolean
  },
  // Pas de TTL : la purge quotidienne suit l'activité de la candidature (services/conservation.js)
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export const RedirectLog = mongoose.model('RedirectLog', redirectLogSchema);

