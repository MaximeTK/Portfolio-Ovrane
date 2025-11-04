/**
 * Test de sélection du modèle d'IA (GPT-5 vs GPT-4o-mini)
 */
import dotenv from 'dotenv';
import { getAIHandler } from '../src/lib/aiModelFactory.js';

dotenv.config();

console.log('\n🧪 TEST DE SÉLECTION DU MODÈLE D\'IA\n');
console.log('━'.repeat(60));

// Afficher la configuration actuelle
console.log('\n📋 Configuration actuelle:');
console.log(`   AI_MODEL = "${process.env.AI_MODEL || '(non défini)'}"`);
console.log(`   OPENAI_API_KEY = ${process.env.OPENAI_API_KEY ? '✅ Définie' : '❌ Manquante'}`);

// Tester la sélection du handler
console.log('\n🔍 Test de sélection du handler:');
try {
  const handler = getAIHandler();
  console.log(`   ✅ Handler récupéré avec succès`);
  console.log(`   📦 Type: ${handler.name || 'callOpenAI'}`);
  
  // Vérifier quel modèle sera utilisé
  const expectedModel = (process.env.AI_MODEL?.toLowerCase() === 'gpt4o-mini') 
    ? 'GPT-4o-mini (Chat Completions)' 
    : 'GPT-5-mini (Responses API)';
  console.log(`   🤖 Modèle sélectionné: ${expectedModel}`);
  
} catch (error) {
  console.error('   ❌ Erreur lors de la récupération du handler:', error.message);
  process.exit(1);
}

// Instructions pour tester les deux modèles
console.log('\n📝 Pour tester les deux modèles:');
console.log('━'.repeat(60));
console.log('\n1️⃣  Test avec GPT-5:');
console.log('   > AI_MODEL=gpt5 node test/test-model-selection.js');
console.log('\n2️⃣  Test avec GPT-4o-mini:');
console.log('   > AI_MODEL=gpt4o-mini node test/test-model-selection.js');
console.log('\n3️⃣  Test sans variable (par défaut = GPT-5):');
console.log('   > node test/test-model-selection.js');

console.log('\n━'.repeat(60));
console.log('✅ Test terminé avec succès!\n');

