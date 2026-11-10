/** RAG : passages en mémoire, embeddings dans MongoDB, recherche hybride */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import * as log from '../../log.js';
import { config } from '../../config.js';
import { SYSTEM_PROMPTS } from '../../messages.js';
import { RagChunk } from '../../models/RagChunk.js';
import { decouperMarkdown } from './chunker.js';
import { indexerBm25, listesClassees, fusionner, porteOuverte } from './recherche.js';

const MODELE = 'text-embedding-3-small';
const TOP_K = 6;
const CANDIDATS = 12;
const CACHE_MAX = 200;
// Au-delà, la recherche se passe de l'étape plutôt que de faire attendre
const DELAI_MS = 2500;
const CLASSEMENT = {
  type: 'json_schema',
  name: 'classement',
  strict: true,
  schema: { type: 'object', properties: { utiles: { type: 'array', items: { type: 'integer' } } }, required: ['utiles'], additionalProperties: false },
};

let client = null;
let etat = { passages: [], embeddings: [], bm25: indexerBm25([]) };
const cacheRequetes = new Map();
// Premières questions déjà classées (suggestions surtout) : ~1,4 s gagnée
const cacheClassements = new Map();

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

/** Découpe les .md, reprend les embeddings connus, embedde les manquants */
export async function reindexFolder(dossier) {
  const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith('.md')).sort();
  if (fichiers.length === 0) {
    log.warn('[RAG] Aucun document .md trouvé dans', dossier);
    return { success: false };
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
  };
  cacheClassements.clear();
  const sources = fichiers.map((f) => path.basename(f, '.md'));
  log.info(`✅ [RAG] ${passages.length} passage(s) de ${sources.join(', ')} ; ${manquants.length} embedding(s) calculé(s)${persistant ? ', persistés dans MongoDB' : ', en mémoire'}`);
  return { success: true, chunksIndexed: passages.length, embeddingsComputed: manquants.length, persisted: persistant, sources };
}

// Question et message précédent en un appel ; questions vues en cache
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

// Appel court sans raisonnement ; null si coupé, en erreur ou désactivé
async function demander(instructions, input, format, signal) {
  if (!config.openai.rag) return null;
  try {
    const reponse = await client.responses.create({
      model: config.openai.rag,
      instructions,
      input,
      reasoning: { effort: 'none' },
      max_output_tokens: 300,
      prompt_cache_key: 'ovrane-rag',
      ...(format ? { text: { format } } : {}),
    }, { signal: AbortSignal.any([AbortSignal.timeout(DELAI_MS), ...(signal ? [signal] : [])]) });
    return reponse.output_text?.trim() || null;
  } catch (error) {
    log.warn('[RAG] Étape du modèle passée :', error.message);
    return null;
  }
}

/** Relance réécrite en requête autonome ; vide si l'étape est passée */
export async function reformuler(question, precedent, reponse = '', signal) {
  const echange = `Visiteur : ${precedent}${reponse ? `\nOvrane : ${reponse.slice(0, 800)}` : ''}`;
  return (await demander(SYSTEM_PROMPTS.ragReformulation, `Échange précédent :\n${echange}\n\nQuestion : ${question}`, null, signal)) || '';
}

/** Rangs des candidats utiles, du plus utile au moins ; null si passé */
export async function reclasser(question, candidats, signal) {
  const liste = candidats.map((p, i) => `[${i}] ${p.prefixe}`).join('\n\n');
  const texte = await demander(SYSTEM_PROMPTS.ragReclassement, `Question : ${question}\n\nPassages :\n${liste}`, CLASSEMENT, signal);
  try {
    return texte && [...new Set(JSON.parse(texte).utiles)].filter((i) => Number.isInteger(i) && i >= 0 && i < candidats.length);
  } catch {
    return null;
  }
}

/** Relance réécrite, RRF des deux requêtes, candidats reclassés par modèle */
export async function rechercher(question, precedent = '', reponse = '', signal) {
  const { passages, embeddings, bm25 } = etat;
  if (passages.length === 0) return { porte: false, passages: [], cosinusMax: 0, couverture: 0, requete: question };
  // La réécriture part pendant que la question s'embedde
  const [requete] = await Promise.all([precedent ? reformuler(question, precedent, reponse, signal) : '', vecteursRequetes([question])]);
  // Sans réécriture, le message précédent reste une requête de poids moitié
  const seconde = requete || precedent;
  const [vQuestion, vSeconde] = await vecteursRequetes(seconde ? [question, seconde] : [question]);
  const courant = listesClassees(bm25, embeddings, question, vQuestion);
  const listes = [{ ordre: courant.dense, poids: 1 }, { ordre: courant.bm25, poids: 1 }];
  let porte = porteOuverte(courant);
  if (seconde) {
    const autre = listesClassees(bm25, embeddings, seconde, vSeconde);
    const poids = requete ? 1 : 0.5;
    listes.push({ ordre: autre.dense, poids }, { ordre: autre.bm25, poids });
    // Réécrite, la relance porte seule son sens : elle peut ouvrir la porte
    if (requete) porte ||= porteOuverte(autre);
  }
  const ordre = fusionner(listes);
  let choix = ordre.slice(0, TOP_K);
  if (porte) {
    const garde = !precedent && cacheClassements.get(question);
    const utiles = garde ? null : await reclasser(requete || question, ordre.slice(0, CANDIDATS).map((i) => passages[i]), signal);
    if (utiles) {
      choix = utiles.slice(0, TOP_K).map((k) => ordre[k]);
      if (!precedent) {
        if (cacheClassements.size >= CACHE_MAX) cacheClassements.delete(cacheClassements.keys().next().value);
        cacheClassements.set(question, choix);
      }
    }
    if (garde) choix = garde;
    // Le modèle qui n'en garde aucun ferme la porte
    porte = choix.length > 0;
  }
  return { porte, cosinusMax: courant.cosinusMax, couverture: courant.couverture, requete: requete || question, passages: choix.map((i) => passages[i]) };
}

export function etatIndex() {
  return etat;
}
