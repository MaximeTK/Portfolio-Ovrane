/**
 * Évaluation chiffrée du RAG sur scripts/rag-questions.json : recall@5, MRR@5 par variante et faux positifs de la porte
 */
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeRAG, reindexFolder, rechercher, embedder, etatIndex } from '../src/services/rag/ragSystem.js';
import { listesClassees, fusionner, normaliser, porteOuverte, SEUILS } from '../src/services/rag/recherche.js';
import { config } from '../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'rag-questions.json'), 'utf8'));
const K = 5;

const phrase = (texte) => ` ${normaliser(texte).replace(/[^a-z0-9]+/g, ' ').trim()} `;

// Rang (1..K) du premier passage contenant une phrase attendue, 0 si absent
function rang(passages, attendu) {
  const i = passages.slice(0, K).findIndex((p) => attendu.some((a) => phrase(p.prefixe).includes(phrase(a))));
  return i < 0 ? 0 : i + 1;
}

function resume(rangs) {
  const n = rangs.length;
  const recall = rangs.filter(Boolean).length / n;
  const mrr = rangs.reduce((somme, r) => somme + (r ? 1 / r : 0), 0) / n;
  return `recall@${K} ${recall.toFixed(3)}  MRR@${K} ${mrr.toFixed(3)}`;
}

initializeRAG(new OpenAI({ apiKey: config.openaiApiKey }));
await reindexFolder(path.join(__dirname, '..', 'rag'));
const { passages, embeddings, bm25 } = etatIndex();

const textes = [...new Set(questions.flatMap((q) => [q.question, q.precedent].filter(Boolean)))];
const vecteurs = new Map((await embedder(textes)).map((v, i) => [textes[i], v]));

const variantes = { 'dense seul': [], 'BM25 seul': [], hybride: [], 'hybride + historique': [], 'injecté (porte)': [] };
// L'ancien corpus n'avait pas Illusion : la comparaison avant/après se fait aussi sans ces questions
const sansIllusion = Object.fromEntries(Object.keys(variantes).map((nom) => [nom, []]));
const relances = { hybride: [], 'hybride + historique': [], 'injecté (porte)': [] };
const hors = [];
const pertinentes = [];
console.log('\nQuestion | cosinus max | couverture BM25 | porte | rangs dense/BM25/hybride/historique/injecté');
for (const q of questions) {
  const courant = listesClassees(bm25, embeddings, q.question, vecteurs.get(q.question));
  const resultat = await rechercher(q.question, q.precedent || '');
  const signal = { cosinusMax: courant.cosinusMax, couverture: courant.couverture, porte: resultat.porte };
  const ligne = `${q.question.slice(0, 55).padEnd(55)} | ${courant.cosinusMax.toFixed(3)} | ${courant.couverture.toFixed(2)} | ${resultat.porte ? 'ouverte' : 'fermée '}`;
  if (q.attendu.length === 0) {
    hors.push(signal);
    console.log(`${ligne} | hors sujet`);
    continue;
  }
  pertinentes.push(signal);
  const rangs = {
    'dense seul': rang(courant.dense.map((i) => passages[i]), q.attendu),
    'BM25 seul': rang(courant.bm25.map((i) => passages[i]), q.attendu),
    hybride: rang(fusionner([{ ordre: courant.dense, poids: 1 }, { ordre: courant.bm25, poids: 1 }]).map((i) => passages[i]), q.attendu),
    'hybride + historique': rang(resultat.passages, q.attendu),
  };
  rangs['injecté (porte)'] = resultat.porte ? rangs['hybride + historique'] : 0;
  for (const [nom, r] of Object.entries(rangs)) {
    variantes[nom].push(r);
    if (!/illusion/i.test(`${q.precedent || ''} ${q.question}`)) sansIllusion[nom].push(r);
  }
  if (q.precedent) for (const nom of Object.keys(relances)) relances[nom].push(rangs[nom]);
  console.log(`${ligne} | ${Object.values(rangs).join('/')}${q.precedent ? ' (relance)' : ''}`);
}

console.log(`\n${passages.length} passages, ${pertinentes.length} questions pertinentes dont ${relances.hybride.length} relances, ${hors.length} hors sujet\n`);
for (const [nom, rangs] of Object.entries(variantes)) console.log(`${nom.padEnd(22)} ${resume(rangs)} | sans Illusion (${sansIllusion[nom].length}) ${resume(sansIllusion[nom])}`);
for (const [nom, rangs] of Object.entries(relances)) console.log(`relances, ${nom.padEnd(20)} ${resume(rangs)}`);

const taux = (liste, test) => `${liste.filter(test).length}/${liste.length}`;
const litterale = (s) => porteOuverte(s, { cosinus: SEUILS.cosinus, couverture: Number.MIN_VALUE, plancher: 0 });
console.log(`\nPorte (cosinus ≥ ${SEUILS.cosinus}, ou couverture ≥ ${SEUILS.couverture} et cosinus ≥ ${SEUILS.plancher}) : faux positifs ${taux(hors, (s) => s.porte)}, ouverte sur ${taux(pertinentes, (s) => s.porte)} questions pertinentes`);
console.log(`Porte littérale (cosinus ≥ ${SEUILS.cosinus} ou au moins un terme trouvé) : faux positifs ${taux(hors, litterale)}, ouverte sur ${taux(pertinentes, litterale)}`);
console.log(`Cosinus max hors sujet : ${Math.max(...hors.map((s) => s.cosinusMax)).toFixed(3)} ; cosinus min des questions pertinentes : ${Math.min(...pertinentes.map((s) => s.cosinusMax)).toFixed(3)}`);
process.exit(0);
