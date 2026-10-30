/**
 * Demande de vérification d'une adresse e-mail : seul le sha256 du jeton envoyé est gardé, MongoDB l'efface à expireLe
 */
import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
  _id: String,
  utilisateur: String,
  // L'adresse vérifiée : changée depuis l'envoi, le lien ne vaut plus rien
  email: String,
  creeLe: Date,
  expireLe: { type: Date, index: { expireAfterSeconds: 0 } },
}, { collection: 'verifications', versionKey: false });

export const Verification = mongoose.model('Verification', verificationSchema);
