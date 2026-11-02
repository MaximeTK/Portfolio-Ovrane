/** Défi déjà présenté : ne crée qu'un visiteur, expire à son échéance */
import mongoose from 'mongoose';

const defiSchema = new mongoose.Schema({
  // _id = sel aléatoire du défi
  _id: String,
  usages: { type: Number, default: 0 },
  expireLe: { type: Date, index: { expireAfterSeconds: 0 } },
}, { collection: 'defis', versionKey: false });

export const Defi = mongoose.model('Defi', defiSchema);
