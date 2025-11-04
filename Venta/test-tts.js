/**
 * Script de test pour le système TTS avec fallback
 * 
 * Usage: node test-tts.js
 */

const testText = "Bonjour, ceci est un test du système de synthèse vocale avec fallback automatique.";

//console.log('🧪 Test du système TTS');
//console.log('='.repeat(60));
//console.log(`Texte à synthétiser: "${testText}"`);
//console.log('='.repeat(60));
//console.log('');

async function testTTS() {
  try {
    //console.log('📡 Envoi de la requête à /api/tts...\n');
    
    const response = await fetch('http://localhost:3000/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: testText }),
    });

    //console.log(`Status: ${response.status}`);
    //console.log(`Content-Type: ${response.headers.get('Content-Type')}`);
    //console.log(`TTS Provider: ${response.headers.get('X-TTS-Provider') || 'N/A'}`);
    //console.log('');

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Erreur:', errorData);
      return;
    }

    const contentType = response.headers.get('Content-Type');
    
    if (contentType?.includes('application/json')) {
      // C'est un fallback client-side
      const data = await response.json();
      
      if (data.useClientTTS) {
        //console.log('✅ Serveur demande fallback Web Speech API');
        //console.log('   → L\'audio sera généré côté navigateur (gratuit)');
        return;
      }
    }
    
    // C'est un audio
    const audioBuffer = await response.arrayBuffer();
    const provider = response.headers.get('X-TTS-Provider');
    
    //console.log(`✅ Audio reçu de: ${provider}`);
    //console.log(`   Taille: ${audioBuffer.byteLength} octets (${(audioBuffer.byteLength / 1024).toFixed(2)} KB)`);
    
    if (provider === 'elevenlabs') {
      //console.log('   💎 Qualité: Premium (Eleven Labs)');
    } else if (provider === 'openai') {
      //console.log('   🤖 Qualité: Bonne (OpenAI TTS)');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Vérifier que le serveur est accessible
//console.log('🔍 Vérification du serveur frontend...');
fetch('http://localhost:3000')
  .then(() => {
    //console.log('✅ Frontend accessible\n');
    return testTTS();
  })
  .catch(() => {
    console.error('❌ Frontend non accessible sur http://localhost:3000');
    //console.log('   Démarrez le frontend avec: npm run dev');
  });

