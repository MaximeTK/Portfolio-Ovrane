/**
 * Script de vérification de l'installation RAG
 * Vérifie que tous les fichiers et dépendances sont en place
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🔍 Vérification de l\'installation du système RAG\n');
console.log('='.repeat(60));

let allGood = true;

// 1. Vérifier les dépendances
console.log('\n1️⃣ Vérification des dépendances...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  
  const requiredDeps = ['vectra', 'openai', 'express', 'dotenv'];
  const missingDeps = [];
  
  for (const dep of requiredDeps) {
    if (!packageJson.dependencies[dep]) {
      missingDeps.push(dep);
    }
  }
  
  if (missingDeps.length > 0) {
    console.error(`   ❌ Dépendances manquantes : ${missingDeps.join(', ')}`);
    console.log('   💡 Exécutez : npm install');
    allGood = false;
  } else {
    console.log('   ✅ Toutes les dépendances sont présentes');
  }
} catch (error) {
  console.error('   ❌ Erreur lecture package.json:', error.message);
  allGood = false;
}

// 2. Vérifier les modules RAG
console.log('\n2️⃣ Vérification des modules RAG...');
const requiredModules = [
  'lib/rag/chunker.js',
  'lib/rag/embeddings.js',
  'lib/rag/vectorStore.js',
  'lib/rag/ragSystem.js'
];

for (const module of requiredModules) {
  const modulePath = path.join(__dirname, module);
  if (fs.existsSync(modulePath)) {
    console.log(`   ✅ ${module}`);
  } else {
    console.error(`   ❌ ${module} manquant`);
    allGood = false;
  }
}

// 3. Vérifier le dossier rag/
console.log('\n3️⃣ Vérification des documents RAG...');
const ragDir = path.join(__dirname, '..', 'rag');
if (!fs.existsSync(ragDir)) {
  console.error('   ❌ Dossier rag/ manquant');
  allGood = false;
} else {
  const txtFiles = fs.readdirSync(ragDir).filter(f => f.endsWith('.txt'));
  if (txtFiles.length === 0) {
    console.warn('   ⚠️ Aucun fichier .txt dans rag/');
    console.log('   💡 Ajoutez vos documents sources dans rag/');
  } else {
    console.log(`   ✅ ${txtFiles.length} fichier(s) .txt trouvé(s):`);
    txtFiles.forEach(file => console.log(`      - ${file}`));
  }
}

// 4. Vérifier .env
console.log('\n4️⃣ Vérification de la configuration...');
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('   ❌ Fichier .env manquant');
  console.log('   💡 Créez .env avec OPENAI_API_KEY=sk-...');
  allGood = false;
} else {
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (!envContent.includes('OPENAI_API_KEY')) {
    console.error('   ❌ OPENAI_API_KEY non définie dans .env');
    allGood = false;
  } else {
    console.log('   ✅ OPENAI_API_KEY présente');
  }
}

// 5. Vérifier que server.js a été modifié
console.log('\n5️⃣ Vérification de server.js...');
const serverPath = path.join(__dirname, 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error('   ❌ server.js manquant');
  allGood = false;
} else {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  const checks = [
    { pattern: 'initializeRAG', name: 'Import du système RAG' },
    { pattern: 'buildRAGContext', name: 'Utilisation du RAG dans /api/chat' },
    { pattern: 'initializeRAGSystem', name: 'Initialisation au démarrage' }
  ];
  
  for (const check of checks) {
    if (serverContent.includes(check.pattern)) {
      console.log(`   ✅ ${check.name}`);
    } else {
      console.error(`   ❌ ${check.name} manquant`);
      allGood = false;
    }
  }
}

// 6. Vérifier la documentation
console.log('\n6️⃣ Vérification de la documentation...');
const docs = [
  'RAG-SYSTEM.md',
  'MIGRATION-RAG.md',
  'test-rag-system.js'
];

for (const doc of docs) {
  const docPath = path.join(__dirname, doc);
  if (fs.existsSync(docPath)) {
    console.log(`   ✅ ${doc}`);
  } else {
    console.warn(`   ⚠️ ${doc} manquant`);
  }
}

// 7. Vérifier les scripts npm
console.log('\n7️⃣ Vérification des scripts npm...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  
  if (packageJson.scripts['test:rag']) {
    console.log('   ✅ Script npm run test:rag disponible');
  } else {
    console.warn('   ⚠️ Script test:rag manquant dans package.json');
  }
} catch (error) {
  console.error('   ❌ Erreur:', error.message);
}

// Résumé
console.log('\n' + '='.repeat(60));
if (allGood) {
  console.log('✅ TOUT EST PRÊT !');
  console.log('\nProchaines étapes :');
  console.log('  1. npm start              # Démarrer le serveur');
  console.log('  2. npm run test:rag       # Tester le système RAG');
  console.log('  3. curl http://localhost:3001/health  # Vérifier la santé');
  console.log('\n📚 Documentation : Consultez MIGRATION-RAG.md\n');
} else {
  console.log('❌ CONFIGURATION INCOMPLÈTE');
  console.log('\nVeuillez corriger les erreurs ci-dessus avant de continuer.\n');
  process.exit(1);
}

