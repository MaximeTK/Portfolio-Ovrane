import {
  generateUserHash,
  getUserProfile,
  addConversation,
  updateUserProfile,
  getConversationHistory,
  detectNameInPrompt,
  getAllUsers
} from '../src/lib/userMemory.js';

//console.log('🧪 ===== TEST DU SYSTÈME DE MÉMOIRE =====\n');

// Test 1 : Génération de hash utilisateur
//console.log('📝 Test 1 : Génération de hash utilisateur');
const userId = generateUserHash('192.168.1.100', 'Mozilla/5.0...');
//console.log('✅ User ID généré:', userId);
//console.log('');

// Test 2 : Création d'un profil utilisateur
//console.log('📝 Test 2 : Création d\'un profil utilisateur');
const profile = getUserProfile(userId, '192.168.1.100');
//console.log('✅ Profil créé:', {
  id: profile.id,
  visitCount: profile.visitCount,
  firstVisit: profile.firstVisit
});
//console.log('');

// Test 3 : Détection de nom
//console.log('📝 Test 3 : Détection de nom dans les messages');
const testMessages = [
  "Bonjour, je m'appelle Pierre",
  "Mon nom est Marie",
  "Je suis Thomas",
  "Salut, c'est Sophie",
  "Hello"
];

testMessages.forEach(msg => {
  const name = detectNameInPrompt(msg);
  //console.log(`  "${msg}" → ${name ? `✅ Nom détecté: ${name}` : '❌ Aucun nom'}`);
});
//console.log('');

// Test 4 : Ajout de conversations
//console.log('📝 Test 4 : Ajout de conversations');
addConversation(userId, "Bonjour, je m'appelle Pierre", "Bonjour Pierre ! Enchanté !");
addConversation(userId, "Quel temps fait-il ?", "Je suis une IA, je n'ai pas accès à la météo.");
addConversation(userId, "Raconte-moi une blague", "Pourquoi les plongeurs plongent toujours en arrière ? Parce que sinon ils tombent dans le bateau !");
//console.log('✅ 3 conversations ajoutées');
//console.log('');

// Test 5 : Mise à jour du profil
//console.log('📝 Test 5 : Mise à jour du nom d\'utilisateur');
updateUserProfile(userId, { name: 'Pierre' });
//console.log('✅ Nom mis à jour');
//console.log('');

// Test 6 : Récupération de l'historique
//console.log('📝 Test 6 : Récupération de l\'historique');
const history = getConversationHistory(userId, 3);
//console.log('✅ Historique récupéré:');
//console.log(history);
//console.log('');

// Test 7 : Simulation d'une nouvelle visite
//console.log('📝 Test 7 : Simulation d\'une nouvelle visite');
const profile2 = getUserProfile(userId, '192.168.1.100');
//console.log('✅ Nouvelle visite enregistrée:', {
  visitCount: profile2.visitCount,
  name: profile2.name,
  conversationCount: profile2.conversations.length
});
//console.log('');

// Test 8 : Liste de tous les utilisateurs
//console.log('📝 Test 8 : Liste de tous les utilisateurs');
const allUsers = getAllUsers();
//console.log('✅ Nombre d\'utilisateurs:', allUsers.length);
allUsers.forEach(user => {
  //console.log(`  - ${user.name || 'Anonyme'} (${user.id}): ${user.visitCount} visites, ${user.conversationCount} conversations`);
});
//console.log('');

//console.log('✅ ===== TOUS LES TESTS SONT PASSÉS =====');
//console.log('');
//console.log('💡 Pour voir les données générées:');
//console.log('   - Fichiers utilisateurs: venta-backend/data/users/*.json');
//console.log('   - Interface admin: http://localhost:3000/admin/users');

