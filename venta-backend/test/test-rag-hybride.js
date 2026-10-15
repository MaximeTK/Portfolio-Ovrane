/**
 * Tests hors ligne du RAG : découpage Markdown, termes, BM25, fusion RRF, porte et prompt fixe
 * Lancement : npm run test:rag:hybride
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decouperMarkdown } from '../src/lib/rag/chunker.js';
import { termes, indexerBm25, bm25, listesClassees, fusionner, porteOuverte, SEUILS } from '../src/lib/rag/recherche.js';
import { SYSTEM_FIXE, buildVisitorContext } from '../src/lib/promptBuilder.js';
import { SYSTEM_PROMPTS } from '../src/lib/messages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`❌ ${name}\n   ${error instanceof Error ? error.message : String(error)}`);
  }
}

test('découpage : un passage par section, fil d\'Ariane, titres de code ignorés', () => {
  const md = '# Doc\n\nIntro.\n\n## A\n\nTexte A.\n\n### A1\n\nTexte A1.\n\n```sh\n# pas un titre\n```\n\n## B\n\n### B1\n\nTexte B1.';
  const passages = decouperMarkdown(md, 'Doc');
  assert.deepEqual(passages.map((p) => p.section), ['Doc', 'Doc > A', 'Doc > A > A1', 'Doc > B > B1']);
  assert.ok(passages[2].texte.includes('# pas un titre'));
  assert.equal(passages[1].prefixe, 'Doc > A\n\nTexte A.');
  assert.ok(passages.every((p) => p.document === 'Doc'));
});

test('découpage : une section de plus de ~350 tokens est coupée entre paragraphes', () => {
  const paragraphe = 'mot '.repeat(150).trim();
  const passages = decouperMarkdown(`# D\n\n## Long\n\n${[paragraphe, paragraphe, paragraphe].join('\n\n')}`, 'D');
  assert.ok(passages.length >= 2);
  assert.ok(passages.every((p) => p.section === 'D > Long' && p.texte.length <= 1400));
  assert.equal(passages.map((p) => p.texte).join('\n\n'), [paragraphe, paragraphe, paragraphe].join('\n\n'));
});

test('termes : minuscules, sans accents ni mots vides, pluriels en s/x retirés', () => {
  assert.deepEqual(termes("Les Pièces récoltées d'Hikup"), ['piece', 'recoltee', 'hikup']);
  assert.deepEqual(termes("L'œil de l'UX/UI"), ['oeil', 'ux', 'ui']);
  assert.deepEqual(termes('Comment est-ce que tu vas ?'), []);
});

test('BM25 : le terme rare classe son passage en tête, couverture par passage', () => {
  const index = indexerBm25(['Pico interface quatre zones', 'Hikup gamification pièces', 'Pico modèle économique']);
  const { scores, couverture } = bm25(index, 'interface de Pico');
  assert.ok(scores[0] > scores[2] && scores[2] > 0 && scores[1] === 0);
  assert.equal(couverture, 1);
  assert.equal(bm25(index, 'interface de Hikup').couverture, 0.5);
  assert.equal(bm25(index, 'bonjour').couverture, 0);
});

test('listes classées : cosinus sur tous les passages, BM25 sur ceux qui partagent un terme', () => {
  const index = indexerBm25(['Pico interface', 'Hikup carte', 'Ovrane voix']);
  const embeddings = [[1, 0], [0, 1], [Math.SQRT1_2, Math.SQRT1_2]];
  const listes = listesClassees(index, embeddings, 'carte de Hikup', [0, 1]);
  assert.deepEqual(listes.dense, [1, 2, 0]);
  assert.deepEqual(listes.bm25, [1]);
  assert.equal(listes.cosinusMax, 1);
  assert.equal(listes.couverture, 1);
});

test('fusion RRF : somme des poids / (60 + rang), le poids du message précédent compte moitié', () => {
  assert.deepEqual(fusionner([{ ordre: [0, 1, 2], poids: 1 }, { ordre: [2, 0], poids: 1 }]), [0, 2, 1]);
  assert.deepEqual(fusionner([{ ordre: [0, 1], poids: 1 }, { ordre: [1, 0], poids: 0.5 }]), [0, 1]);
  assert.deepEqual(fusionner([{ ordre: [0], poids: 0.5 }, { ordre: [1], poids: 1 }]), [1, 0]);
});

test('porte : cosinus seul, ou couverture au-dessus du plancher', () => {
  assert.equal(porteOuverte({ cosinusMax: SEUILS.cosinus, couverture: 0 }), true);
  assert.equal(porteOuverte({ cosinusMax: SEUILS.plancher, couverture: 1 }), true);
  assert.equal(porteOuverte({ cosinusMax: SEUILS.plancher - 0.01, couverture: 1 }), false);
  assert.equal(porteOuverte({ cosinusMax: SEUILS.cosinus - 0.01, couverture: 0.5 }), false);
});

test('corpus : cinq documents Markdown de connaissance, consignes rangées dans prompts/', () => {
  const ragDir = path.join(__dirname, '..', 'rag');
  const fichiers = fs.readdirSync(ragDir);
  assert.deepEqual(fichiers.sort(), ['Hikup.md', 'Illusion.md', 'Ovrane.md', 'Pico.md', 'Profil.md']);
  const passages = fichiers.flatMap((f) => decouperMarkdown(fs.readFileSync(path.join(ragDir, f), 'utf8'), f.replace('.md', '')));
  assert.ok(passages.length > 100, `${passages.length} passages`);
  assert.ok(passages.every((p) => p.section && p.texte.trim()));
  assert.ok(!passages.some((p) => /uiShowPicture|uiSetBackground/.test(p.texte)), 'aucune consigne d\'outil dans la connaissance');
  for (const fichier of ['instructions.txt', 'colors.txt', 'assets.txt']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'prompts', fichier)), fichier);
  }
});

test('prompt : consignes fixes sans donnée du visiteur, contexte visiteur à part', () => {
  assert.ok(SYSTEM_FIXE.startsWith(SYSTEM_PROMPTS.mainContext));
  assert.ok(SYSTEM_FIXE.endsWith(SYSTEM_PROMPTS.contextRule));
  assert.ok(!SYSTEM_FIXE.includes('UTILISATEUR ACTUEL') && !SYSTEM_FIXE.includes('VISITEUR RECRUTEUR'));
  const visiteur = buildVisitorContext({ name: 'Léa', visitCount: 3, preferences: { backgroundColor: 'ocean' } });
  assert.equal(visiteur, 'UTILISATEUR ACTUEL: Léa (3 visites)\n\nFOND ACTUEL (palette): ocean');
  console.log(`   prompt fixe : ${SYSTEM_FIXE.length} caractères, ~${Math.round(SYSTEM_FIXE.length / 4)} tokens estimés`);
});

console.log(`\n${passed} réussi(s), ${failures.length} échec(s)`);
process.exit(failures.length ? 1 : 0);
