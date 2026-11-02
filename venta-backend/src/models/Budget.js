/** Dépense du jour (UTC) : plafonne les appels payants de tous les visiteurs */
import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  // _id = jour « AAAA-MM-JJ »
  _id: String,
  chat: { type: Number, default: 0 },
  tts: { type: Number, default: 0 },
  // MongoDB efface le compteur d'un jour passé : seul le jour en cours compte
  expireLe: { type: Date, index: { expireAfterSeconds: 0 } },
}, { collection: 'budgets', versionKey: false });

export const Budget = mongoose.model('Budget', budgetSchema);
