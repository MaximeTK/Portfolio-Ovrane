/**
 * Script de test pour le nouveau système RAG
 * Teste le chunking, les embeddings et la recherche
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  initializeRAG,
  reindexFolder,
  retrieveRelevantChunks,
  buildRAGContext,
  getSystemStats
} from '../src/lib/rag/ragSystem.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testRAGSystem() {
  console.log('🧪 Test du système RAG\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Initialisation
    console.log('\n1️⃣ Initialisation du système RAG...');
    await initializeRAG(process.env.OPENAI_API_KEY, {
      chunkSize: 500,
      overlap: 100,
      topK: 5,
      minScore: 0.5
    });
    console.log('✅ Système initialisé\n');

    // 2. Indexation
    console.log('2️⃣ Indexation des documents...');
    const ragDir = path.join(__dirname, '..', 'rag');
    const indexResult = await reindexFolder(ragDir, true);
    console.log(`✅ ${indexResult.chunksIndexed} chunks indexés depuis ${indexResult.documentsProcessed} document(s)\n`);

    // 3. Statistiques
    console.log('3️⃣ Statistiques du système:');
    const stats = await getSystemStats();
    console.log(`   📊 Chunks totaux: ${stats.index.itemCount}`);
    console.log(`   📁 Sources: ${stats.index.sources.join(', ')}`);
    console.log(`   ⚙️ Config: chunks=${stats.config.chunkSize}tok, overlap=${stats.config.overlap}tok`);
    console.log('');

    // 4. Tests de requêtes
    console.log('4️⃣ Tests de retrieval:\n');
    
    const testQueries = [
      "Qui est Pico ?",
      "Quelles commandes sont disponibles ?",
      "Comment afficher une image ?",
      "Parle-moi de Toty",
      "Qu'est-ce que Cracotille ?",
    ];

    for (const query of testQueries) {
      console.log(`\n📝 Requête: "${query}"`);
      console.log('-'.repeat(60));
      
      try {
        const result = await buildRAGContext(query, 3);
        
        if (result.hasSources) {
          console.log(`✅ ${result.chunks.length} chunk(s) trouvé(s)`);
          console.log(`📊 Score moyen: ${(result.averageScore * 100).toFixed(1)}%`);
          console.log(`📁 Sources: ${result.sources.join(', ')}`);
          
          result.chunks.forEach((chunk, idx) => {
            console.log(`\n   [${idx + 1}] ${chunk.source} (score: ${(chunk.score * 100).toFixed(1)}%)`);
            console.log(`   └─ ${chunk.text.substring(0, 150)}...`);
          });
        } else {
          console.log('❌ Aucun résultat pertinent');
        }
      } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Tests terminés avec succès!\n');
    
  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter les tests
testRAGSystem().then(() => {
  console.log('👋 Test terminé');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erreur fatale:', error);
  process.exit(1);
});

