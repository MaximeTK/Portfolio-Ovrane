/**
 * Dépense du jour, un document par date (UTC) : de quoi plafonner les appels payants (modèle, voix) sur l'ensemble des visiteurs
 */
import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  // _id = jour « AAAA-MM-JJ »
  _id: String,
  chat: { type: Number, default: 0 },
  tts: { type: Number, default: 0 },
  // MongoDB efface le compteur d'un jour passé : il ne sert qu'à plafonner la journée en cours
  expireLe: { type: Date, index: { expireAfterSeconds: 0 } },
}, { collection: 'budgets', versionKey: false });

export const Budget = mongoose.model('Budget', budgetSchema);
