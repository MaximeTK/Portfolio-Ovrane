/**
 * Session d'un navigateur : seul le sha256 du jeton est gardé, MongoDB efface la session à expireLe
 */
import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  _id: String,
  utilisateur: String,
  creeLe: Date,
  vuLe: Date,
  expireLe: { type: Date, index: { expireAfterSeconds: 0 } },
}, { collection: 'sessions', versionKey: false });

export const Session = mongoose.model('Session', sessionSchema);
