/** Session d'un navigateur : sha256 du jeton seul gardé, expire à expireLe */
import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  _id: String,
  utilisateur: String,
  creeLe: Date,
  vuLe: Date,
  expireLe: { type: Date, index: { expireAfterSeconds: 0 } },
}, { collection: 'sessions', versionKey: false });

export const Session = mongoose.model('Session', sessionSchema);
