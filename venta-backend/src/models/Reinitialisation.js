/** Demande de mot de passe : sha256 du jeton seul gardé, expire à expireLe */
import mongoose from 'mongoose';

const reinitialisationSchema = new mongoose.Schema({
  _id: String,
  utilisateur: String,
  creeLe: Date,
  expireLe: { type: Date, index: { expireAfterSeconds: 0 } },
}, { collection: 'reinitialisations', versionKey: false });

export const Reinitialisation = mongoose.model('Reinitialisation', reinitialisationSchema);
