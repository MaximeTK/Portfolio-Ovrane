/**
 * Candidature envoyée par Illusion : offre, fiche entreprise, CV et lettre derrière le jeton des liens suivis
 */
import mongoose from 'mongoose';

const illusionCandidatureSchema = new mongoose.Schema({
  jeton: {
    type: String,
    required: true,
    unique: true
  },
  // Supprimée 180 jours après sa dernière réception
  recue_le: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 180
  },
  langue: { type: String, default: '' },
  offre: {
    titre: String,
    entreprise: String,
    lieu: String,
    contrat: String,
    url: String,
    description: String,
    metiers: [String]
  },
  entreprise: {
    nom: String,
    secteur: String,
    site: String,
    localisation: String,
    effectif: String,
    activite: String
  },
  cv: {
    profil: String,
    competences: [String],
    texte: String
  },
  lettre: { type: String, default: '' }
});

export const IllusionCandidature = mongoose.model('IllusionCandidature', illusionCandidatureSchema);
