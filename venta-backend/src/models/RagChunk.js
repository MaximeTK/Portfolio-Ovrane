/**
 * Passage du RAG avec son embedding, identifié par le hash du modèle et du texte préfixé
 */
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
