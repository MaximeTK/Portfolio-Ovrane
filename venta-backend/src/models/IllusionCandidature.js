/**
 * Candidature rangée par Illusion dans la base partagée : offre, fiche entreprise, CV et lettre derrière le jeton des liens suivis
 */
import mongoose from 'mongoose';

// Fichier du CV ou de la lettre dans illusion_fichiers, rangé par Illusion
const fichierLie = { type: mongoose.Schema.Types.ObjectId, default: null };

const illusionCandidatureSchema = new mongoose.Schema({
  jeton: {
    type: String,
    required: true,
    unique: true
  },
  // Les données d'un utilisateur ne se mêlent jamais à celles d'un autre
  utilisateur: mongoose.Schema.Types.ObjectId,
  statut: { type: String, default: '' },
  envoyee_le: Date,
  // Dernière activité : clic humain ou retour du recruteur (Ovrane), mail reçu (Illusion) ; la conservation en part
  activite_le: Date,
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
    texte: String,
    fichier: fichierLie
  },
  lettre: {
    texte: String,
    fichier: fichierLie
  }
}, { collection: 'illusion_candidatures', strict: false });

export const IllusionCandidature = mongoose.model('IllusionCandidature', illusionCandidatureSchema);
