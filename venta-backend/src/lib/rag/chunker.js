/**
 * Module de chunking pour le système RAG - max 5 fonctions, max 20 lignes
 */

/**
 * Estime le nombre de tokens
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Découpe un texte en chunks avec chevauchement
 */
export function chunkText(text, chunkSizeTokens = 500, overlapTokens = 100) {
  if (!text || text.trim().length === 0) return [];

  const chunkSizeChars = chunkSizeTokens * 4;
  const overlapChars = overlapTokens * 4;
  const stepSize = chunkSizeChars - overlapChars;
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = findChunkEnd(text, start, chunkSizeChars);
    const chunk = text.substring(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    
    start += stepSize;
    if (start < text.length && start + chunkSizeChars >= text.length) {
      const lastChunk = text.substring(start).trim();
      if (lastChunk.length > 0 && lastChunk !== chunks[chunks.length - 1]) {
        chunks.push(lastChunk);
      }
      break;
    }
  }
  return chunks;
}

function findChunkEnd(text, start, chunkSizeChars) {
  let end = start + chunkSizeChars;
  if (end >= text.length) return text.length;
  
  const textWindow = text.substring(start, end);
  const lastPeriod = textWindow.lastIndexOf('.');
  const lastExclamation = textWindow.lastIndexOf('!');
  const lastQuestion = textWindow.lastIndexOf('?');
  const lastNewline = textWindow.lastIndexOf('\n\n');
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion, lastNewline);
  
  if (lastSentenceEnd > chunkSizeChars * 0.5) {
    return start + lastSentenceEnd + 1;
  }
  
  const lastSpace = textWindow.lastIndexOf(' ');
  if (lastSpace > chunkSizeChars * 0.7) {
    return start + lastSpace;
  }
  return end;
}

/**
 * Découpe un document avec métadonnées
 */
export function chunkDocument(document, chunkSizeTokens = 500, overlapTokens = 100) {
  const { content, source, metadata = {} } = document;
  const textChunks = chunkText(content, chunkSizeTokens, overlapTokens);
  
  return textChunks.map((text, index) => ({
    id: `${source}_chunk_${index}`,
    text,
    source,
    chunkIndex: index,
    totalChunks: textChunks.length,
    tokenCount: estimateTokens(text),
    metadata: { ...metadata, createdAt: new Date().toISOString() }
  }));
}

/**
 * Découpe plusieurs documents
 */
export function chunkDocuments(documents, chunkSizeTokens = 500, overlapTokens = 100) {
  const allChunks = [];
  for (const doc of documents) {
    const chunks = chunkDocument(doc, chunkSizeTokens, overlapTokens);
    allChunks.push(...chunks);
  }
  return allChunks;
}

/**
 * Déduplique les chunks similaires par hash
 */
export function deduplicateChunks(chunks) {
  const seen = new Set();
  const deduplicated = [];
  
  for (const chunk of chunks) {
    const hash = chunk.text.trim().toLowerCase();
    if (!seen.has(hash)) {
      seen.add(hash);
      deduplicated.push(chunk);
    }
  }
  return deduplicated;
}
