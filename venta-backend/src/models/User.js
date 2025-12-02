/**
 * Modèle Mongoose pour les utilisateurs
 */
import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
  // Champs standards
  role: { type: String, enum: ['user', 'assistant', 'system'] },
  content: { type: String },
  timestamp: { type: Date, default: Date.now },
  
  // Champs legacy / spécifiques à Venta (prompt/response pair)
  prompt: String,
  response: String,
  
  commands: [{ 
    command: String, 
    args: mongoose.Schema.Types.Mixed 
  }]
}, { _id: false, strict: false });

const UserSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  name: { type: String, default: null },
  isTemporary: { type: Boolean, default: true },
  
  // Gestion des IPs (Hashées)
  ipHashes: { type: [String], default: [] },
  
  // Métadonnées de visite
  firstVisit: { type: Date, default: Date.now },
  lastVisit: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 1 },
  
  // Préférences utilisateur
  preferences: {
    theme: String,
    language: String,
    voice: String,
    // Autoriser d'autres préférences dynamiques
    type: Map,
    of: String
  },
  
  // Historique des conversations
  conversations: [ConversationSchema]
}, {
  timestamps: true, // Ajoute createdAt et updatedAt automatiquement
  strict: false // Permet d'ajouter des champs non prévus si nécessaire (flexibilité)
});

// Création de l'index pour la recherche rapide par IP
UserSchema.index({ ipHashes: 1 });

// Empêcher la recompilation du modèle si le fichier est réimporté (Hot Reload)
export const User = mongoose.models.User || mongoose.model('User', UserSchema);

