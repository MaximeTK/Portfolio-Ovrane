import {
  generateUserHash,
  getUserProfile,
  handleNameDetection,
  detectNameInPrompt
} from '../src/lib/userMemory.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_DIR = path.join(__dirname, '..', 'data', 'users');

console.log('🧪 Test du système de correction de nom\n');
console.log('='.repeat(60));

const testIP = '192.168.1.200';
const testAgent = 'Mozilla/5.0 Test Browser';

// Nettoyer les profils de test existants
function cleanTestProfiles() {
  if (!fs.existsSync(USERS_DIR)) return;
  const files = fs.readdirSync(USERS_DIR);
  files.forEach(file => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(USERS_DIR, file), 'utf8'));
      if (data.name === 'Alice' || data.name === 'Bob' || data.ipHash === generateUserHash(testIP, testAgent).substring(0, 16)) {
        fs.unlinkSync(path.join(USERS_DIR, file));
        console.log(`🗑️ Profil de test nettoyé: ${file}`);
      }
    } catch {}
  });
}

cleanTestProfiles();

console.log('\n📌 Test 1: Création d\'un profil temporaire');
console.log('-'.repeat(60));
let userId = generateUserHash(testIP, testAgent);
let profile = getUserProfile(userId, testIP);
console.log('✓ Profil temporaire créé:', {
  id: profile.id.substring(0, 8) + '...',
  isTemporary: profile.isTemporary
});

console.log('\n📌 Test 2: L\'utilisateur se présente comme "Alice"');
console.log('-'.repeat(60));
const detectionResult1 = detectNameInPrompt("Bonjour, je m'appelle Alice");
console.log('✓ Détection:', detectionResult1);
const nameResult1 = handleNameDetection(profile.id, 'Alice', detectionResult1?.isCorrection);
if (nameResult1) {
  console.log('✓ Action:', nameResult1.action);
  console.log('✓ Profil après conversion:', {
    id: nameResult1.profile.id.substring(0, 8) + '...',
    name: nameResult1.profile.name,
    isTemporary: nameResult1.profile.isTemporary
  });
  profile = nameResult1.profile;
}

console.log('\n📌 Test 3: L\'utilisateur corrige son nom en "Bob"');
console.log('-'.repeat(60));
const detectionResult2 = detectNameInPrompt("Pardon, je voulais dire Bob");
console.log('✓ Détection:', detectionResult2);
console.log('✓ isCorrection:', detectionResult2?.isCorrection);
const nameResult2 = handleNameDetection(profile.id, 'Bob', detectionResult2?.isCorrection);
if (nameResult2) {
  console.log('✓ Action:', nameResult2.action);
  console.log('✓ Profil après correction:', {
    id: nameResult2.profile.id.substring(0, 8) + '...',
    name: nameResult2.profile.name,
    isTemporary: nameResult2.profile.isTemporary,
    sameProfileId: nameResult2.profile.id === profile.id
  });
  
  if (nameResult2.action === 'corrected' && nameResult2.profile.id === profile.id) {
    console.log('\n✅ TEST RÉUSSI: Le nom a été corrigé dans le même profil!');
  } else if (nameResult2.action === 'changeName') {
    console.log('\n❌ TEST ÉCHOUÉ: Un nouveau profil a été créé au lieu de corriger l\'existant');
  } else {
    console.log('\n⚠️ Résultat inattendu:', nameResult2.action);
  }
}

console.log('\n📌 Test 4: Vérification d\'autres patterns de correction');
console.log('-'.repeat(60));
const correctionPrompts = [
  "Non, c'est Bob",
  "En fait, c'est Bob",
  "Désolé, mon nom est Bob",
  "Je me suis trompé, c'est Bob",
  "Non Bob"
];

correctionPrompts.forEach(prompt => {
  const result = detectNameInPrompt(prompt);
  console.log(`"${prompt}"`);
  console.log('  → Détection:', result ? `${result.name} (correction: ${result.isCorrection})` : 'Aucune');
});

console.log('\n' + '='.repeat(60));
console.log('✅ Tests terminés');
console.log('='.repeat(60));

// Nettoyer les profils de test
cleanTestProfiles();

