/** Réponses du chat notées par promptfoo : justesse, fidélité, coût, délais */
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../src/config.js';
import { initializeRAG, reindexFolder } from '../src/services/rag/ragSystem.js';
import { generateResponse } from '../src/services/chat/generer.js';

// Ni télémétrie ni partage : les réponses parlent du profil de Maxime
Object.assign(process.env, { PROMPTFOO_DISABLE_TELEMETRY: '1', PROMPTFOO_DISABLE_SHARING: '1', PROMPTFOO_DISABLE_UPDATE: '1', PROMPTFOO_DISABLE_REMOTE_GENERATION: '1' });
const { evaluate } = await import('promptfoo');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'rag-questions.json'), 'utf8'));
// $ par million de jetons (entrée, en cache, sortie) : table de promptfoo
const PRIX = { 'gpt-5.6-luna': [0.2, 0.02, 1.2], 'gpt-5.4-mini': [0.75, 0.075, 4.5], 'text-embedding-3-small': [0.02, 0, 0] };
// gpt-5.4-mini rend des verdicts de fidélité que promptfoo ne sait pas lire
const JUGE = { text: 'openai:chat:gpt-5.4', embedding: 'openai:embedding:text-embedding-3-small' };
const HORS_SUJET = 'La réponse n\'invente aucun fait : ni météo ni heure qu\'elle ne peut connaître. Une demande de code reçoit du code, une salutation un accueil. Une demande de fond, de couleur ou de thème est confirmée ; si la palette n\'existe pas, la réponse le dit et en propose d\'autres.';

// Client OpenAI qui relève jetons et contexte injecté, sans toucher au code
const reel = new OpenAI({ apiKey: config.openaiApiKey });
let releve = { jetons: {}, contexte: '' };
function noter(modele, entree = 0, cache = 0, sortie = 0) {
  const j = (releve.jetons[modele] ??= { entree: 0, cache: 0, sortie: 0 });
  Object.assign(j, { entree: j.entree + entree, cache: j.cache + cache, sortie: j.sortie + sortie });
}
const noterReponse = (modele, u) => noter(modele, u?.input_tokens, u?.input_tokens_details?.cached_tokens, u?.output_tokens);
const client = {
  embeddings: {
    create: async (params, options) => {
      const r = await reel.embeddings.create(params, options);
      noter(params.model, r.usage?.prompt_tokens);
      return r;
    },
  },
  responses: {
    create: async (params, options) => {
      if (!params.stream) {
        const r = await reel.responses.create(params, options);
        noterReponse(params.model, r.usage);
        return r;
      }
      // Premier tour du chat : le dernier message porte le bloc <contexte>
      releve.contexte ||= String(params.input.at(-1)?.content ?? '').match(/<contexte>[\s\S]*<\/contexte>/)?.[0] ?? '';
      const flux = await reel.responses.create(params, options);
      return (async function* relayer() {
        for await (const e of flux) {
          if (e.type === 'response.completed') noterReponse(params.model, e.response.usage);
          yield e;
        }
      })();
    },
  },
};

const ovrane = {
  id: () => 'ovrane-chat',
  async callApi(prompt, { vars }) {
    releve = { jetons: {}, contexte: '' };
    const user = { name: null, visitCount: 1, preferences: {}, conversations: vars.precedent ? [{ role: 'user', content: vars.precedent }] : [] };
    const ctx = { uiCommands: [], signal: AbortSignal.timeout(90_000) };
    const debut = performance.now();
    let premierTexteMs = 0;
    const output = await generateResponse(client, prompt, user, null, ctx, () => {
      premierTexteMs ||= Math.round(performance.now() - debut);
    });
    const latencyMs = Math.round(performance.now() - debut);
    let cost = 0;
    const total = { prompt: 0, cached: 0, completion: 0 };
    for (const [modele, j] of Object.entries(releve.jetons)) {
      const [entree, cache, sortie] = PRIX[modele] ?? [0, 0, 0];
      if (!PRIX[modele]) console.warn(`Prix inconnu pour ${modele} : compté à 0`);
      cost += ((j.entree - j.cache) * entree + j.cache * cache + j.sortie * sortie) / 1e6;
      Object.assign(total, { prompt: total.prompt + j.entree, cached: total.cached + j.cache, completion: total.completion + j.sortie });
    }
    return {
      output,
      latencyMs,
      cost,
      tokenUsage: { ...total, total: total.prompt + total.completion },
      metadata: { contexte: releve.contexte, premierTexteMs, commandes: ctx.uiCommands, jetons: releve.jetons },
    };
  },
};

// Le chat reçoit la question seule ; les juges, la relance avec ce qui précède
const tests = questions.map((q) => ({
  description: `${q.precedent ? '(relance) ' : ''}${q.question}`,
  vars: { question: q.question, query: q.precedent ? `${q.precedent} → ${q.question}` : q.question, ...(q.precedent ? { precedent: q.precedent } : {}) },
  assert: q.attendu.length
    ? [
      { type: 'llm-rubric', metric: 'justesse', value: `La réponse transmet cette information ; seul le sens compte, pas les mots exacts : « ${q.attendu.join(' » ou « ')} ».` },
      { type: 'context-faithfulness', metric: 'fidélité', threshold: 0.8, contextTransform: 'context.metadata.contexte' },
      // Une réponse riche s'écarte de la question : seuil bas, score suivi
      { type: 'answer-relevance', metric: 'pertinence', threshold: 0.5 },
      { type: 'cost', threshold: 0.01 },
    ]
    : [{ type: 'llm-rubric', metric: 'hors sujet', value: HORS_SUJET }, { type: 'cost', threshold: 0.01 }],
}));

initializeRAG(client);
await reindexFolder(path.join(__dirname, '..', 'rag'));
console.log(`\n${tests.length} questions, réponses par ${config.openai.model}, RAG par ${config.openai.rag || 'aucun modèle'}, juge ${JUGE.text}\n`);
// Une question à la fois : délais réalistes et jetons rattachés à leur question
const resultat = await evaluate({
  description: 'Réponses du chat d\'Ovrane',
  prompts: ['{{question}}'],
  providers: [ovrane],
  tests,
  defaultTest: { options: { provider: JUGE } },
  writeLatestResults: true,
}, { maxConcurrency: 1, showProgressBar: false });

const { results } = await resultat.toEvaluateSummary();
const metriques = {};
const premiers = [];
const durees = [];
const couts = [];
for (const r of results) {
  const m = r.response?.metadata ?? {};
  for (const [nom, score] of Object.entries(r.namedScores ?? {})) (metriques[nom] ??= []).push(score);
  if (m.premierTexteMs) premiers.push(m.premierTexteMs);
  durees.push(r.latencyMs);
  couts.push(r.cost ?? 0);
  const scores = Object.entries(r.namedScores ?? {}).map(([nom, s]) => `${nom} ${s.toFixed(2)}`).join(', ');
  console.log(`${r.success ? '✔' : '✖'} ${r.testCase.description.slice(0, 60).padEnd(60)} | ${scores} | 1er texte ${m.premierTexteMs ?? '-'} ms, ${r.latencyMs} ms, ${((r.cost ?? 0) * 100).toFixed(3)} c`);
  if (!r.success) {
    for (const c of r.gradingResult?.componentResults ?? []) if (!c.pass) console.log(`    ${c.assertion?.metric ?? c.assertion?.type} : ${String(c.reason).slice(0, 220)}`);
    if (r.error) console.log(`    erreur : ${String(r.error).slice(0, 220)}`);
  }
}
const median = (l) => [...l].sort((a, b) => a - b)[l.length >> 1] ?? 0;
const p90 = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length * 0.9)] ?? 0;
console.log(`\nRéussite : ${results.filter((r) => r.success).length}/${results.length}`);
for (const [nom, l] of Object.entries(metriques)) console.log(`${nom.padEnd(16)} moyenne ${(l.reduce((a, b) => a + b, 0) / l.length).toFixed(3)} sur ${l.length}`);
console.log(`Premier texte : médiane ${median(premiers)} ms, p90 ${p90(premiers)} ms ; réponse complète : médiane ${median(durees)} ms`);
console.log(`Coût d'une réponse : médiane ${(median(couts) * 100).toFixed(3)} c, total ${(couts.reduce((a, b) => a + b, 0) * 100).toFixed(2)} c (juge non compté)`);
console.log('Détail : npx promptfoo view');
process.exit(0);
