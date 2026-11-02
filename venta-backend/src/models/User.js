/** Modèle Mongoose des utilisateurs */
import mongoose from 'mongoose';

const CommandSchema = new mongoose.Schema({
  command: String,
  parameter: String,
}, { _id: false, strict: false });

const ConversationSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'] },
  content: String,
  timestamp: { type: Date, default: Date.now },
  prompt: String,
  response: String,
  // Commandes de l'IA : garder toutes celles d'un message
  commands: { type: [CommandSchema], default: [] },
}, { _id: false, strict: false });

const UserSchema = new mongoose.Schema({
  // Ordre volontaire des champs (lisibilité dans MongoDB)
  name: { type: String, default: null },
  nameNormalized: { type: String, default: null },
  id: { type: String, required: true, unique: true },
  // Absent plutôt que null : l'index sparse unique n'admet qu'un seul null
  email: String,
  passwordHash: { type: String, default: null },
  ipHashes: { type: [String], default: [] },
  lastVisit: { type: Date, default: Date.now },
  // Doit valoir 0 par défaut pour que le 1er login donne visitCount=1
  visitCount: { type: Number, default: 0 },
  visitedLinks: { type: [String], default: [] },
  preferences: { type: Map, of: String },
  messageCount: { type: Number, default: 0 },
  conversations: [ConversationSchema],
}, { timestamps: true, strict: false });

// Index sparse pour email (null autorisé, unicité sur les valeurs non-null)
UserSchema.index({ email: 1 }, { sparse: true, unique: true });

// Connexion et inscription cherchent aussi par pseudo : pas de parcours complet
UserSchema.index({ nameNormalized: 1 });

export const User = mongoose.model('User', UserSchema);
