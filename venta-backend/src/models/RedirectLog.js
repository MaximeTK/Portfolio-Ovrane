/**
 * Modèle pour les logs de redirection (tracking CV, etc.)
 * Indépendant des profils utilisateurs classiques.
 */
import mongoose from 'mongoose';

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
  timestamp: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 365 // Optionnel: Auto-suppression après 1 an pour éviter de saturer la DB ? (à voir)
  }
});

export const RedirectLog = mongoose.model('RedirectLog', redirectLogSchema);

