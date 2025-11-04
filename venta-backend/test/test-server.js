// Script de test pour vérifier que le serveur fonctionne
import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3001';

async function testServer() {
  //console.log('🧪 Test du serveur Venta Backend...\n');

  try {
    // Test de santé
    //console.log('1. Test de santé...');
    const healthResponse = await fetch(`${SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    //console.log('✅ Santé:', healthData);

    // Test des assets
    //console.log('\n2. Test des assets disponibles...');
    const assetsResponse = await fetch(`${SERVER_URL}/api/assets`);
    const assetsData = await assetsResponse.json();
    //console.log('✅ Assets:', assetsData);

    // Test du chat avec Toty
    //console.log('\n3. Test du chat (question sur Toty)...');
    const chatResponse = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: 'Parle-moi de Toty et de son histoire avec Pypo' 
      })
    });
    const chatData = await chatResponse.json();
    //console.log('✅ Réponse chat:', {
      reply: chatData.reply?.substring(0, 100) + '...',
      commands: chatData.commands,
      hasCommands: chatData.commands?.length > 0
    });

    // Test avec demande d'image
    //console.log('\n4. Test avec demande d\'image...');
    const imageResponse = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: 'Montre-moi une image du projet exemple' 
      })
    });
    const imageData = await imageResponse.json();
    //console.log('✅ Réponse avec image:', {
      reply: imageData.reply?.substring(0, 100) + '...',
      commands: imageData.commands
    });

    //console.log('\n🎉 Tous les tests sont passés !');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
    //console.log('\n💡 Assurez-vous que :');
    //console.log('   - Le serveur est démarré (npm run dev)');
    //console.log('   - Le fichier .env est configuré avec OPENAI_API_KEY');
    //console.log('   - Le fichier "Histoire Toty.txt" existe dans le dossier parent');
  }
}

testServer();
