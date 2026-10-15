/**
 * Vérification de l'installation du RAG : dépendances, modules, documents, consignes, configuration et scripts
 * Lancement : npm run check:rag
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(racine, 'package.json'), 'utf8'));
let allGood = true;

function verifier(ok, message) {
  console.log(`   ${ok ? '✅' : '❌'} ${message}`);
  if (!ok) allGood = false;
}

console.log('\n🔍 Vérification de l\'installation du système RAG\n');

console.log('1️⃣ Dépendances');
for (const dep of ['openai', 'mongoose', 'express', 'dotenv']) verifier(Boolean(pkg.dependencies[dep]), dep);
verifier(!pkg.dependencies.vectra, 'vectra retiré (recherche en mémoire)');

console.log('\n2️⃣ Modules');
for (const module of ['src/lib/rag/chunker.js', 'src/lib/rag/recherche.js', 'src/lib/rag/ragSystem.js', 'src/models/RagChunk.js', 'src/lib/promptBuilder.js']) {
  verifier(fs.existsSync(path.join(racine, module)), module);
}

console.log('\n3️⃣ Connaissance (rag/) et consignes (prompts/)');
const ragDir = path.join(racine, 'rag');
const fichiers = fs.existsSync(ragDir) ? fs.readdirSync(ragDir) : [];
verifier(fichiers.some((f) => f.endsWith('.md')), `documents Markdown : ${fichiers.filter((f) => f.endsWith('.md')).join(', ')}`);
verifier(!fichiers.some((f) => f.endsWith('.txt')), 'aucun .txt opérationnel mélangé à la connaissance');
for (const fichier of ['instructions.txt', 'colors.txt', 'assets.txt']) verifier(fs.existsSync(path.join(racine, 'prompts', fichier)), `prompts/${fichier}`);

console.log('\n4️⃣ Configuration (.env)');
const env = fs.existsSync(path.join(racine, '.env')) ? dotenv.parse(fs.readFileSync(path.join(racine, '.env'))) : {};
verifier(Boolean(env.OPENAI_API_KEY), 'OPENAI_API_KEY présente');
console.log(`   ℹ️ MONGODB_DB : ${env.MONGODB_DB || 'absente (embeddings recalculés en mémoire à chaque démarrage)'}`);

console.log('\n5️⃣ Branchements');
const server = fs.readFileSync(path.join(racine, 'src', 'server.js'), 'utf8');
verifier(server.includes('initializeRAGSystem') && server.includes('watchRAGFolder'), 'initialisation et surveillance au démarrage');
verifier(fs.readFileSync(path.join(racine, 'src', 'lib', 'chat', 'responseGenerator.js'), 'utf8').includes('buildRAGContextForPrompt'), 'RAG utilisé par /api/chat');

console.log('\n6️⃣ Scripts npm');
for (const script of ['test:rag', 'test:rag:hybride', 'eval:rag', 'update-rag']) verifier(Boolean(pkg.scripts[script]), `npm run ${script}`);

console.log(`\n${allGood ? '✅ TOUT EST PRÊT' : '❌ CONFIGURATION INCOMPLÈTE'}\n`);
process.exit(allGood ? 0 : 1);
