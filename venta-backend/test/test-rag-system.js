/**
 * Test de bout en bout du RAG avec OpenAI (sans MongoDB) : index, recherche, porte, ordre du prompt, cache
 * Lancement : npm run test:rag
 */
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeRAG, reindexFolder, rechercher, getSystemStats } from '../src/lib/rag/ragSystem.js';
import { buildRAGContextForPrompt, SYSTEM_FIXE } from '../src/lib/promptBuilder.js';
import { generateResponse } from '../src/lib/chat/responseGenerator.js';
import { processResponse } from '../src/lib/chat/responseProcessor.js';
import { resolveModelConfig } from '../src/lib/openai/apiParams.js';
import { getRawConversationHistory } from '../src/lib/userMemory.js';
import { memoryUsers } from '../src/lib/memoryStore.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`❌ ${name}\n   ${error instanceof Error ? error.message : String(error)}`);
  }
}

const enCache = (usage) => usage?.input_tokens_details?.cached_tokens ?? 0;

assert.ok(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY manquante');
initializeRAG(process.env.OPENAI_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

await test('index : cinq documents découpés et embeddés en mémoire sans MongoDB', async () => {
  const result = await reindexFolder(path.join(__dirname, '..', 'rag'));
  assert.equal(result.success, true);
  assert.equal(result.persisted, false);
  assert.deepEqual(result.sources, ['Hikup', 'Illusion', 'Ovrane', 'Pico', 'Profil']);
  assert.equal(result.embeddingsComputed, result.chunksIndexed);
  assert.equal(getSystemStats().index.itemCount, result.chunksIndexed);
});

await test('recherche : le bon document en tête, la relance suit le message précédent', async () => {
  const pico = await rechercher("Qu'est-ce que Pico ?");
  assert.equal(pico.porte, true);
  assert.equal(pico.passages[0].document, 'Pico');
  const relance = await rechercher('Comment est organisée son interface ?', 'Parle-moi de Pico');
  assert.equal(relance.passages[0].document, 'Pico');
});

await test('porte : un salut ou une commande d\'interface n\'injecte rien', async () => {
  for (const question of ['Bonjour !', 'Mets le fond en rouge', 'Passe en cyberpunk']) {
    const { ragContext, ragCoverage } = await buildRAGContextForPrompt(question, '', true);
    assert.equal(ragContext, '', question);
    assert.equal(ragCoverage, 'none', question);
  }
});

await test('contexte : blocs <source> sans score, sources par document', async () => {
  const { ragContext, ragSources, ragCoverage } = await buildRAGContextForPrompt('Quel stage a-t-il fait en Italie ?', '', true);
  assert.equal(ragCoverage, 'good');
  assert.ok(ragContext.startsWith('<contexte>\n<source document="Profil" section="Profil de Maxime Thiong-kay > Stages'));
  assert.ok(ragContext.endsWith('</contexte>'));
  assert.ok(!/score|%/i.test(ragContext.replace(/<source[^>]*>[\s\S]*?<\/source>/g, '')));
  assert.ok(ragSources.includes('Profil'));
});

await test('cache : le prompt fixe dépasse 1024 tokens et se réutilise', async () => {
  const { model } = resolveModelConfig();
  const appel = (question) => openai.responses.create({
    model,
    input: [{ role: 'system', content: SYSTEM_FIXE }, { role: 'user', content: question }],
    reasoning: { effort: 'minimal' },
    max_output_tokens: 64,
  });
  const premier = await appel('Bonjour');
  const second = await appel('Salut');
  console.log(`   prompt fixe : ${premier.usage.input_tokens} tokens en entrée ; 2e appel : ${enCache(second.usage)} en cache`);
  assert.ok(premier.usage.input_tokens >= 1024, `${premier.usage.input_tokens} tokens`);
});

await test('chat : consignes fixes, visiteur, historique, puis <contexte> et question ; question brute enregistrée', async () => {
  const appels = [];
  const create = openai.responses.create.bind(openai.responses);
  const espion = { responses: { create: async (params) => { const r = await create(params); appels.push({ input: params.input, usage: r.usage }); return r; } } };
  const userId = 'test-rag-e2e';
  const profil = { id: userId, name: null, visitCount: 1, messageCount: 0, preferences: {}, conversations: [] };
  memoryUsers.set(userId, profil);

  const q1 = "Qu'est-ce que Pico ?";
  const q2 = "Et c'est payant pour les familles ?";
  const r1 = await generateResponse(espion, q1, userId, profil, true);
  await processResponse(r1, userId, profil, q1);
  const debut2 = appels.length;
  const r2 = await generateResponse(espion, q2, userId, profil, true);

  const [fixe, visiteur, ...reste] = appels[0].input;
  assert.equal(fixe.role, 'system');
  assert.equal(fixe.content, SYSTEM_FIXE);
  assert.equal(visiteur.role, 'system');
  assert.ok(visiteur.content.includes('FOND ACTUEL (palette): default'));
  assert.ok(reste.at(-1).content.startsWith('<contexte>') && reste.at(-1).content.endsWith(q1));
  assert.equal(r1.ragCoverage, 'good');
  assert.ok(r1.ragSources.includes('Pico'));
  assert.ok(String(r1.rawResponse).trim());

  assert.equal((await getRawConversationHistory(userId, 8, 0))[0].prompt, q1);
  const second = appels[debut2].input;
  assert.equal(second[0].content, fixe.content);
  assert.deepEqual(second[2], { role: 'user', content: q1 });
  assert.ok(second.at(-1).content.endsWith(q2));
  assert.ok(String(r2.rawResponse).trim());
  console.log(`   ${q1} → ${appels[0].usage.input_tokens} tokens, ${enCache(appels[0].usage)} en cache`);
  console.log(`   ${q2} → ${appels[debut2].usage.input_tokens} tokens, ${enCache(appels[debut2].usage)} en cache ; sources ${r2.ragSources.join(', ')}`);
  console.log(`   Réponse : ${String(r2.rawResponse).slice(0, 160).replace(/\s+/g, ' ')}…`);
});

console.log(`\n${passed} réussi(s), ${failures.length} échec(s)`);
process.exit(failures.length ? 1 : 0);
