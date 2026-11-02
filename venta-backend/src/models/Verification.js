/** Vérification d'e-mail : sha256 du jeton seul gardé, expire à expireLe */
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
