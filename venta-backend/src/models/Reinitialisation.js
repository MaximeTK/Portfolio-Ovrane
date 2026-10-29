/**
 * Demande de nouveau mot de passe : seul le sha256 du jeton envoyé par e-mail est gardé, MongoDB l'efface à expireLe
 */
import mongoose from 'mongoose';

const reinitialisationSchema = new mongoose.Schema({
  _id: String,
  utilisateur: String,
  creeLe: Date,
  expireLe: { type: Date, index: { expireAfterSeconds: 0 } },
}, { collection: 'reinitialisations', versionKey: false });

export const Reinitialisation = mongoose.model('Reinitialisation', reinitialisationSchema);
