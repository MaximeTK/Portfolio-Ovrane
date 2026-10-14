/**
 * CV ou lettre envoyés avec une candidature, rangés par Illusion dans la base partagée, contenu compris
 */
import mongoose from 'mongoose';

const illusionFichierSchema = new mongoose.Schema({
  utilisateur: mongoose.Schema.Types.ObjectId,
  jeton: String,
  genre: String,
  nom: String,
  type: String,
  taille: Number,
  donnees: Buffer,
  cree_le: Date
}, { collection: 'illusion_fichiers', strict: false });

export const IllusionFichier = mongoose.model('IllusionFichier', illusionFichierSchema);
