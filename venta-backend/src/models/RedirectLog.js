/** Logs de redirection (tracking CV), indépendants des profils utilisateurs */
import mongoose from 'mongoose';

// Cibles des liens suivis, transmises par le middleware du frontend
export const REDIRECT_CIBLES = ['cv', 'cvdesign', 'linkedin', 'github', 'portfolio'];

const redirectLogSchema = new mongoose.Schema({
  path: { type: String, required: true, index: true },
  target: { type: String, required: true },
  // Liens d'Illusion : jeton de la candidature, absent sur les anciens liens
  jeton: { type: String, index: true, sparse: true },
  cible: { type: String, enum: REDIRECT_CIBLES },
  // Verdict déduit du user-agent : scanner, aperçu, crawler…
  robot: Boolean,
  // Pas de TTL : la purge suit l'activité de la candidature (conservation.js)
  timestamp: { type: Date, default: Date.now },
});

export const RedirectLog = mongoose.model('RedirectLog', redirectLogSchema);

