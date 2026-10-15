/**
 * Recherche hybride en mémoire : BM25, cosinus, fusion RRF et porte de pertinence
 */

const MOTS_VIDES = new Set(`a ai alors apres as au aussi aux avait avaient avant avec avez avoir avons beaucoup bien ca ce ceci cela celle celles celui ces cet cette ceux chez combien comme comment dans de depuis des dire dis dit doit dois donc donne donner du elle elles en encore entre es est et etaient etait ete etes etre eu eux explique expliquer fait faire fais font il ils je la le les leur leurs lui ma mais me meme mes moi mon montre montrer ne ni nos notre nous on ont ou par parle parler pas pendant peu peut peuvent peux plus pour pourquoi pouvez presente presenter puis qu quand que quel quelle quelles quels qui quoi raconte sa sans se selon sera ses son sont sous suis sur ta te tes toi ton tous tout toute toutes tres tu un une va vas vers vont vos votre vous`.split(' '));

// Seuils de la porte, calibrés par test/eval-rag.js : un mot isolé (« heure ») ne l'ouvre pas sous le plancher
export const SEUILS = { cosinus: 0.45, couverture: 0.6, plancher: 0.3 };

export function normaliser(texte) {
  return String(texte ?? '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Termes indexés : sans accents ni mots vides, pluriels en s/x ramenés au singulier
 */
export function termes(texte) {
  return normaliser(texte)
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length > 1 && !MOTS_VIDES.has(mot))
    .map((mot) => (mot.length > 3 ? mot.replace(/[sx]$/, '') : mot));
}

export function indexerBm25(textes) {
  const docs = textes.map((texte) => {
    const liste = termes(texte);
    const tf = new Map();
    for (const terme of liste) tf.set(terme, (tf.get(terme) || 0) + 1);
    return { tf, longueur: liste.length };
  });
  const df = new Map();
  for (const doc of docs) for (const terme of doc.tf.keys()) df.set(terme, (df.get(terme) || 0) + 1);
  const moyenne = docs.reduce((somme, doc) => somme + doc.longueur, 0) / (docs.length || 1);
  return { docs, df, moyenne };
}

/**
 * Scores BM25 (k1 1.2, b 0.75) et part maximale des termes de la requête réunis dans un même passage
 */
export function bm25(index, requete) {
  const requis = [...new Set(termes(requete))];
  const n = index.docs.length;
  let couverture = 0;
  const scores = index.docs.map((doc) => {
    let score = 0;
    let trouves = 0;
    for (const terme of requis) {
      const f = doc.tf.get(terme);
      if (!f) continue;
      trouves += 1;
      const df = index.df.get(terme);
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += (idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * doc.longueur) / index.moyenne));
    }
    if (requis.length) couverture = Math.max(couverture, trouves / requis.length);
    return score;
  });
  return { scores, couverture };
}

function ordre(scores) {
  return scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
}

/**
 * Classements d'une requête : tous les passages par cosinus, ceux qui partagent un terme par BM25
 */
export function listesClassees(index, embeddings, requete, vecteur) {
  // Les embeddings OpenAI sont normés : le produit scalaire est le cosinus
  const cosinus = embeddings.map((e) => e.reduce((somme, v, i) => somme + v * vecteur[i], 0));
  const { scores, couverture } = bm25(index, requete);
  return {
    dense: ordre(cosinus),
    bm25: ordre(scores).filter((i) => scores[i] > 0),
    cosinusMax: Math.max(...cosinus),
    couverture,
  };
}

/**
 * Reciprocal Rank Fusion : somme de poids / (60 + rang) sur chaque liste
 */
export function fusionner(listes) {
  const total = new Map();
  for (const { ordre: liste, poids } of listes) {
    liste.forEach((i, rang) => total.set(i, (total.get(i) || 0) + poids / (60 + rang + 1)));
  }
  return [...total.entries()].sort((a, b) => b[1] - a[1]).map(([i]) => i);
}

export function porteOuverte({ cosinusMax, couverture }, seuils = SEUILS) {
  return cosinusMax >= seuils.cosinus || (couverture >= seuils.couverture && cosinusMax >= seuils.plancher);
}
