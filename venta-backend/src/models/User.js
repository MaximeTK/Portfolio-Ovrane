/**
 * Modèle Mongoose pour les utilisateurs
 */
import mongoose from 'mongoose';

const CommandSchema = new mongoose.Schema({
  // Format actuel (frontend) : { command, parameter }
  command: { type: String },
  parameter: { type: String },
  // Compat legacy / outils (si jamais utilisé)
  args: mongoose.Schema.Types.Mixed,
}, { _id: false, strict: false });

const ConversationSchema = new mongoose.Schema({
  // Champs standards
  role: { type: String, enum: ['user', 'assistant', 'system'] },
  content: { type: String },
  timestamp: { type: Date, default: Date.now },
  
  // Champs legacy / spécifiques à Venta (prompt/response pair)
  prompt: String,
  response: String,
  
  // Commandes utilisées par l'IA (si présentes) - conserver TOUTES les commandes d'un message
  commands: { type: [CommandSchema], default: [] },
}, { _id: false, strict: false });

const UserSchema = new mongoose.Schema({
  // Ordre volontaire des champs (lisibilité dans MongoDB)
  name: { type: String, default: null },
  nameNormalized: { type: String, default: null },
  id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  // Gestion des IPs (Hashées)
  ipHashes: { type: [String], default: [] },
  // Métadonnées de visite
  lastVisit: { type: Date, default: Date.now },
  // IMPORTANT: doit être 0 par défaut pour que le 1er login (pipeline +1) donne visitCount=1
  // et permette de détecter correctement un nouveau compte.
  visitCount: { type: Number, default: 0 },
  
  // Historique des liens visités
  visitedLinks: { type: [String], default: [] },

  // Préférences utilisateur
  preferences: {
    theme: String,
    language: String,
    voice: String,
    // Autoriser d'autres préférences dynamiques
    type: Map,
    of: String
  },
  
  // Statistiques
  messageCount: { type: Number, default: 0 },

  // Historique des conversations (dernier champ)
  conversations: [ConversationSchema],
}, {
  timestamps: true, // Ajoute createdAt et updatedAt automatiquement
  strict: false // Permet d'ajouter des champs non prévus si nécessaire (flexibilité)
});

// Création de l'index pour la recherche rapide par IP
UserSchema.index({ ipHashes: 1 });

// Empêcher la recompilation du modèle si le fichier est réimporté (Hot Reload)
export const User = mongoose.models.User || mongoose.model('User', UserSchema);

