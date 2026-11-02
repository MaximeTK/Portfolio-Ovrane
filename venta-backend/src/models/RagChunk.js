/** Passage du RAG et son embedding, identifié par le hash modèle + texte */
import mongoose from 'mongoose';

const ragChunkSchema = new mongoose.Schema({
  _id: String,
  document: String,
  section: String,
  texte: String,
  embedding: [Number],
  modele: String,
  majLe: Date
}, { collection: 'rag_chunks', versionKey: false });

export const RagChunk = mongoose.model('RagChunk', ragChunkSchema);
