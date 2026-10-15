/**
 * Tests du RAG et du chat avec le vrai OpenAI, sans MongoDB : index, recherche, porte, cache du prompt et ordre des messages
 * Lancement : npm run test:openai (quelques fractions de centime)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { config } from '../src/config.js';
import { initializeRAG, reindexFolder, rechercher, getSystemStats } from '../src/services/rag/ragSystem.js';
import { buildRAGContextForPrompt, generateResponse, SYSTEM_FIXE } from '../src/services/chat/generer.js';
import { processResponse } from '../src/services/chat/reponse.js';
import { User } from '../src/models/User.js';

assert.ok(config.openaiApiKey, 'OPENAI_API_KEY manquante');
const openai = new OpenAI({ apiKey: config.openaiApiKey });
initializeRAG(openai);
const enCache = (usage) => usage?.input_tokens_details?.cached_tokens ?? 0;

test('index : cinq documents découpés et embeddés en mémoire sans MongoDB', async () => {
  const result = await reindexFolder(fileURLToPath(new URL('../rag', import.meta.url)));
  assert.equal(result.success, true);
  assert.equal(result.persisted, false);
  assert.deepEqual(result.sources, ['Hikup', 'Illusion', 'Ovrane', 'Pico', 'Profil']);
  assert.equal(result.embeddingsComputed, result.chunksIndexed);
  assert.equal(getSystemStats().index.itemCount, result.chunksIndexed);
});

test('recherche : le bon document en tête, la relance suit le message précédent', async () => {
  const pico = await rechercher("Qu'est-ce que Pico ?");
  assert.equal(pico.porte, true);
  assert.equal(pico.passages[0].document, 'Pico');
  const relance = await rechercher('Comment est organisée son interface ?', 'Parle-moi de Pico');
  assert.equal(relance.passages[0].document, 'Pico');
});

test('porte : un salut ou une commande d\'interface n\'injecte rien', async () => {
  for (const question of ['Bonjour !', 'Mets le fond en rouge', 'Passe en cyberpunk']) {
    assert.equal(await buildRAGContextForPrompt(question, ''), '', question);
  }
});

test('contexte : blocs <source> sans score', async () => {
  const contexte = await buildRAGContextForPrompt('Quel stage a-t-il fait en Italie ?', '');
  assert.ok(contexte.startsWith('<contexte>\n<source document="Profil" section="Profil de Maxime Thiong-kay > Stages'), contexte.slice(0, 120));
  assert.ok(contexte.endsWith('</contexte>'));
  assert.ok(!/score|%/i.test(contexte.replace(/<source[^>]*>[\s\S]*?<\/source>/g, '')));
});

test('cache : le prompt fixe dépasse 1024 tokens et se réutilise', async () => {
  const appel = (question) => openai.responses.create({
    model: config.openai.model,
    input: [{ role: 'system', content: SYSTEM_FIXE }, { role: 'user', content: question }],
    reasoning: { effort: 'minimal' },
    max_output_tokens: 64,
  });
  const premier = await appel('Bonjour');
  const second = await appel('Salut');
  console.log(`   prompt fixe : ${premier.usage.input_tokens} tokens en entrée ; 2e appel : ${enCache(second.usage)} en cache`);
  assert.ok(premier.usage.input_tokens >= 1024, `${premier.usage.input_tokens} tokens`);
});

test('chat : consignes fixes, visiteur, historique, puis <contexte> et question ; question brute enregistrée', async () => {
  const appels = [];
  const create = openai.responses.create.bind(openai.responses);
  const espion = { responses: { create: async (params) => {
    const reponse = await create(params);
    appels.push({ input: params.input, usage: reponse.usage });
    return reponse;
  } } };
  const profil = { id: 'test-openai', name: null, visitCount: 1, messageCount: 0, preferences: {}, conversations: [] };
  // L'échange enregistré rejoint le profil, comme dans la base
  User.updateOne = async (filtre, maj) => {
    profil.conversations.push(...(maj.$push?.conversations.$each || []));
    return { matchedCount: 1 };
  };

  const q1 = "Qu'est-ce que Pico ?";
  const q2 = "Et c'est payant pour les familles ?";
  const r1 = await generateResponse(espion, q1, profil, null, { uiCommands: [] });
  await processResponse(r1, q1, profil, { uiCommands: [] }, false);
  const debut2 = appels.length;
  const r2 = await generateResponse(espion, q2, profil, null, { uiCommands: [] });

  const [fixe, visiteur, ...reste] = appels[0].input;
  assert.equal(fixe.content, SYSTEM_FIXE);
  assert.equal(visiteur.role, 'system');
  assert.ok(visiteur.content.includes('FOND ACTUEL (palette): default'));
  assert.ok(reste.at(-1).content.startsWith('<contexte>') && reste.at(-1).content.endsWith(q1));
  assert.ok(r1.trim());

  assert.equal(profil.conversations[0].prompt, q1);
  const second = appels[debut2].input;
  assert.equal(second[0].content, fixe.content);
  assert.deepEqual(second[2], { role: 'user', content: q1 });
  assert.ok(second.at(-1).content.endsWith(q2));
  assert.ok(r2.trim());
  console.log(`   ${q1} → ${appels[0].usage.input_tokens} tokens, ${enCache(appels[0].usage)} en cache`);
  console.log(`   ${q2} → ${appels[debut2].usage.input_tokens} tokens, ${enCache(appels[debut2].usage)} en cache`);
});
