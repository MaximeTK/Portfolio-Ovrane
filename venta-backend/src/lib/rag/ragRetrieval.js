/**
 * Retrieval de chunks pertinents - max 5 fonctions, max 20 lignes
 */
import { generateEmbedding } from './embeddings.js';
import { searchSimilarChunks } from './vectorStore.js';
import { getConfig, getInitializedStatus } from './ragInit.js';
import { getVectorIndex } from './vectorStoreCore.js';

const queryCache = new Map();
const CACHE_MAX_SIZE = 100;

const STOPWORDS_FR = new Set([
  'a','à','au','aux','avec','ce','ces','cette','c','d','de','des','du','dans','en','et','est','elle','elles','il','ils',
  'je','j','la','le','les','l','ma','mais','me','m','mon','ne','nos','notre','nous','on','ou','pas','pour','que','qui',
  'quoi','sa','se','ses','son','sur','ta','te','tes','toi','ton','tu','un','une','vos','votre','vous','y',
  'ca','ça','cest','c\'est','est-ce','estce','es','suis','sont','etre','être'
]);

function normalizeForMatch(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, ' ') // garde lettres/chiffres pour tokenisation simple
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(query) {
  const normalized = normalizeForMatch(query);
  if (!normalized) return [];
  const tokens = normalized.split(' ').filter(Boolean);
  const keywords = [];
  const seen = new Set();

  for (const t of tokens) {
    if (t.length < 3) continue;
    if (STOPWORDS_FR.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    keywords.push(t);
  }

  return keywords;
}

async function lexicalFallback(query, topK) {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const vectorIndex = getVectorIndex();
  if (!vectorIndex) return [];

  const items = await vectorIndex.listItems();
  const scored = [];

  for (const item of items) {
    const source = normalizeForMatch(item?.metadata?.source);
    const text = normalizeForMatch(item?.metadata?.text);

    let score = 0;
    for (const kw of keywords) {
      if (source && source.includes(kw)) score += 3;
      if (text && text.includes(kw)) score += 1;
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);
  const maxScore = scored[0]?.score || 1;

  return scored.slice(0, topK).map(({ item, score }) => ({
    id: item.metadata.id,
    text: item.metadata.text,
    source: item.metadata.source,
    chunkIndex: item.metadata.chunkIndex,
    totalChunks: item.metadata.totalChunks,
    tokenCount: item.metadata.tokenCount,
    // Score "approx" pour garder la compatibilité avec l'affichage / ragCoverage
    score: Math.max(0.35, Math.min(0.9, 0.35 + 0.55 * (score / maxScore))),
    metadata: { createdAt: item.metadata.createdAt }
  }));
}

/**
 * Recherche les chunks pertinents pour une requête
 */
export async function retrieveRelevantChunks(query, topK = null, minScore = null) {
  if (!getInitializedStatus()) {
    throw new Error('RAG system not initialized. Call initializeRAG() first.');
  }

  const config = getConfig();
  const k = topK || config.topK;
  const threshold = minScore !== null ? minScore : config.minScore;
  
  try {
    const cacheKey = `${query}:${k}:${threshold}`;
    if (queryCache.has(cacheKey)) {
      console.log('⚡ [RAG-SYSTEM] Résultat récupéré du cache');
      return queryCache.get(cacheKey);
    }

    const queryEmbedding = await generateEmbedding(query, config.embeddingModel);
    let results = await searchSimilarChunks(queryEmbedding, k, threshold);

    // Fallback: si aucun chunk n'est trouvé (souvent à cause d'un seuil trop strict ou d'une requête
    // contenant surtout des mots "généraux"), on tente une recherche lexicale sur les chunks.
    // Objectif: récupérer un doc si l'utilisateur mentionne un nom propre (ex: "Toty").
    if (!results || results.length === 0) {
      const lexical = await lexicalFallback(query, k);
      if (lexical.length > 0) {
        console.log('🔎 [RAG-SYSTEM] Fallback lexical activé (aucun résultat vectoriel)');
        results = lexical;
      }
    }
    
    cacheResults(cacheKey, results);
    return results;
  } catch (error) {
    console.error('❌ [RAG-SYSTEM] Erreur de retrieval:', error.message);
    throw error;
  }
}

function cacheResults(cacheKey, results) {
  if (queryCache.size >= CACHE_MAX_SIZE) {
    const firstKey = queryCache.keys().next().value;
    queryCache.delete(firstKey);
  }
  queryCache.set(cacheKey, results);
}

/**
 * Log détaillé des chunks utilisés
 */
function logChunksDetails(chunks, query, averageScore) {
  console.log(`\n📊 [RAG] ${chunks.length} chunks utilisés | Score: ${(averageScore * 100).toFixed(1)}% | Requête: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
  
  chunks.forEach((chunk, index) => {
    console.log(`   ${index + 1}. ${chunk.source} [${chunk.chunkIndex + 1}/${chunk.totalChunks}] ${(chunk.score * 100).toFixed(1)}% - ${chunk.text.substring(0, 100)}...`);
  });
  console.log('');
}

/**
 * Construit le contexte RAG pour le prompt
 */
export async function buildRAGContext(query, topK = null) {
  let chunks = await retrieveRelevantChunks(query, topK);

  // Déduplication à la source: on ne doit jamais avoir plusieurs fois le même chunk
  // (ex: "Pico [1/2]" répété). Clé: source + chunkIndex (fallback lexical / index peuvent dupliquer).
  if (Array.isArray(chunks) && chunks.length > 1) {
    const byKey = new Map();
    for (const c of chunks) {
      const source = String(c?.source ?? '');
      const idx = Number.isFinite(c?.chunkIndex) ? c.chunkIndex : String(c?.chunkIndex ?? '');
      const key = `${source}::${idx}`;
      const prev = byKey.get(key);
      // Garder le meilleur score si doublon
      if (!prev || (c?.score ?? 0) > (prev?.score ?? 0)) {
        byKey.set(key, c);
      }
    }
    chunks = Array.from(byKey.values());
  }
  
  if (chunks.length === 0) {
    console.log('📭 [RAG-SYSTEM] Aucun chunk pertinent trouvé');
    return { contextText: '', chunks: [], hasSources: false, averageScore: 0 };
  }
  
  const averageScore = chunks.reduce((sum, chunk) => sum + chunk.score, 0) / chunks.length;
  logChunksDetails(chunks, query, averageScore);
  
  const contextParts = chunks.map((chunk) => {
    return `[SOURCE: ${chunk.source} | Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} | Score: ${(chunk.score * 100).toFixed(1)}%]\n${chunk.text}`;
  });
  
  const contextText = contextParts.join('\n\n---\n\n');
  
  return {
    contextText,
    chunks,
    hasSources: true,
    averageScore,
    sources: [...new Set(chunks.map(c => c.source))]
  };
}

/**
 * Vide le cache des requêtes
 */
export function clearCache() {
  queryCache.clear();
  console.log('🗑️ [RAG-SYSTEM] Cache vidé');
}

