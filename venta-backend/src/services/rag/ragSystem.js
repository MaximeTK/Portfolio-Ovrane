/**
 * Système RAG : passages Markdown en mémoire, embeddings persistés dans MongoDB, recherche hybride
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import * as log from '../../log.js';
import { RagChunk } from '../../models/RagChunk.js';
import { decouperMarkdown } from './chunker.js';
import { indexerBm25, listesClassees, fusionner, porteOuverte, SEUILS } from './recherche.js';

const MODELE = 'text-embedding-3-small';
const TOP_K = 6;
const CACHE_MAX = 200;

let client = null;
let etat = { passages: [], embeddings: [], bm25: indexerBm25([]), persistant: false, calcules: 0 };
const cacheRequetes = new Map();

export function initializeRAG(openai) {
  client = openai;
}

export async function embedder(textes) {
  const vecteurs = [];
  for (let i = 0; i < textes.length; i += 100) {
    const reponse = await client.embeddings.create({ model: MODELE, input: textes.slice(i, i + 100) });
    vecteurs.push(...reponse.data.map((d) => d.embedding));
  }
  return vecteurs;
}

/**
 * Découpe les .md, reprend les embeddings connus de MongoDB, n'embedde que les manquants et retire les obsolètes
 */
export async function reindexFolder(dossier) {
  const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith('.md')).sort();
  if (fichiers.length === 0) {
    log.warn('[RAG] Aucun document .md trouvé dans', dossier);
    return { success: false, documentsProcessed: 0, chunksIndexed: 0 };
  }
  const passages = fichiers.flatMap((f) => decouperMarkdown(fs.readFileSync(path.join(dossier, f), 'utf8'), path.basename(f, '.md')));
  const ids = passages.map((p) => crypto.createHash('sha256').update(`${MODELE}\n${p.prefixe}`).digest('hex'));
  const persistant = mongoose.connection.readyState === 1;

  const connus = new Map();
  if (persistant) {
    for (const doc of await RagChunk.find({ _id: { $in: ids } }, { embedding: 1 }).lean()) connus.set(doc._id, doc.embedding);
  }
  const manquants = [...new Set(ids.filter((id) => !connus.has(id)))];
  const parId = new Map(ids.map((id, i) => [id, passages[i]]));
  const vecteurs = manquants.length ? await embedder(manquants.map((id) => parId.get(id).prefixe)) : [];
  manquants.forEach((id, i) => connus.set(id, vecteurs[i]));

  if (persistant) {
    if (manquants.length) {
      await RagChunk.bulkWrite(manquants.map((id) => {
        const { document, section, texte } = parId.get(id);
        const ligne = { document, section, texte, embedding: connus.get(id), modele: MODELE, majLe: new Date() };
        return { updateOne: { filter: { _id: id }, update: { $set: ligne }, upsert: true } };
      }));
    }
    await RagChunk.deleteMany({ _id: { $nin: ids } });
  }

  etat = {
    passages,
    embeddings: ids.map((id) => connus.get(id)),
    bm25: indexerBm25(passages.map((p) => p.prefixe)),
    persistant,
    calcules: manquants.length,
  };
  const sources = fichiers.map((f) => path.basename(f, '.md'));
  log.info(`✅ [RAG] ${passages.length} passage(s) de ${sources.join(', ')} ; ${manquants.length} embedding(s) calculé(s)${persistant ? ', persistés dans MongoDB' : ', en mémoire'}`);
  return { success: true, documentsProcessed: fichiers.length, chunksIndexed: passages.length, embeddingsComputed: manquants.length, persisted: persistant, sources };
}

// La question et le message précédent partent dans un seul appel, les questions déjà vues sortent du cache
async function vecteursRequetes(textes) {
  const manquants = [...new Set(textes)].filter((t) => !cacheRequetes.has(t));
  if (manquants.length) {
    const vecteurs = await embedder(manquants);
    manquants.forEach((t, i) => {
      if (cacheRequetes.size >= CACHE_MAX) cacheRequetes.delete(cacheRequetes.keys().next().value);
      cacheRequetes.set(t, vecteurs[i]);
    });
  }
  return textes.map((t) => cacheRequetes.get(t));
}

/**
 * Top passages par RRF (question poids 1, message précédent poids 0.5) ; la porte ne juge que la question
 */
export async function rechercher(question, precedent = '') {
  const { passages, embeddings, bm25 } = etat;
  if (passages.length === 0) return { porte: false, passages: [], cosinusMax: 0, couverture: 0 };
  const [vQuestion, vPrecedent] = await vecteursRequetes(precedent ? [question, precedent] : [question]);
  const courant = listesClassees(bm25, embeddings, question, vQuestion);
  const listes = [{ ordre: courant.dense, poids: 1 }, { ordre: courant.bm25, poids: 1 }];
  if (precedent) {
    const avant = listesClassees(bm25, embeddings, precedent, vPrecedent);
    listes.push({ ordre: avant.dense, poids: 0.5 }, { ordre: avant.bm25, poids: 0.5 });
  }
  return {
    porte: porteOuverte(courant),
    cosinusMax: courant.cosinusMax,
    couverture: courant.couverture,
    passages: fusionner(listes).slice(0, TOP_K).map((i) => passages[i]),
  };
}

export function etatIndex() {
  return etat;
}

export function getSystemStats() {
  const sources = [...new Set(etat.passages.map((p) => p.document))];
  return {
    initialized: etat.passages.length > 0,
    config: { embeddingModel: MODELE, topK: TOP_K, seuils: SEUILS },
    index: { itemCount: etat.passages.length, sourceCount: sources.length, sources, persisted: etat.persistant, embeddingsComputed: etat.calcules },
    cache: { size: cacheRequetes.size, maxSize: CACHE_MAX },
  };
}
