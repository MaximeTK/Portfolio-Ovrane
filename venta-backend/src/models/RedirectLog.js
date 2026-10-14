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
  ip: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: 'unknown'
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
  // Déduit du user-agent par le serveur : scanner de messagerie, aperçu, crawler...
  robot: {
    type: Boolean
  },
  timestamp: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 365 // Optionnel: Auto-suppression après 1 an pour éviter de saturer la DB ? (à voir)
  }
});

export const RedirectLog = mongoose.model('RedirectLog', redirectLogSchema);

