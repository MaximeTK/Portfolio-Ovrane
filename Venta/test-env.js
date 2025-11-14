// Test script pour vérifier les variables d'environnement
async function loadEnvironment() {
  const { config } = await import('dotenv');
  config({ path: '.env.local' });
}

void loadEnvironment();

//console.log('=== Test des variables d\'environnement ===');
//console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Présente' : '❌ Manquante');
//console.log('ELEVEN_API_KEY:', process.env.ELEVEN_API_KEY ? '✅ Présente' : '❌ Manquante');
//console.log('ELEVEN_VOICE_ID:', process.env.ELEVEN_VOICE_ID ? '✅ Présente' : '❌ Manquante');

if (process.env.OPENAI_API_KEY) {
  //console.log('Longueur OPENAI_API_KEY:', process.env.OPENAI_API_KEY.length);
}
if (process.env.ELEVEN_API_KEY) {
  //console.log('Longueur ELEVEN_API_KEY:', process.env.ELEVEN_API_KEY.length);
}
if (process.env.ELEVEN_VOICE_ID) {
  //console.log('ELEVEN_VOICE_ID:', process.env.ELEVEN_VOICE_ID);
}
