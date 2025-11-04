import {
  generateUserHash,
  getUserProfile,
  handleNameDetection,
  addConversation
} from '../src/lib/userMemory.js';

//console.log('🧪 Test du système de profils\n');
//console.log('='.repeat(60));

const testIP = '192.168.1.100';
const testAgent = 'Mozilla/5.0 Test Browser';

//console.log('\n📌 Test 1: Première visite (anonyme)');
//console.log('-'.repeat(60));
let userId = generateUserHash(testIP, testAgent);
let profile = getUserProfile(userId, testIP);
//console.log('Profil créé:', {
  id: profile.id,
  name: profile.name,
  isTemporary: profile.isTemporary,
  visitCount: profile.visitCount
});

//console.log('\n📌 Test 2: L\'utilisateur se présente');
//console.log('-'.repeat(60));
const nameResult = handleNameDetection(profile.id, 'TestUser');
if (nameResult) {
  //console.log('Action:', nameResult.action);
  //console.log('Profil après détection:', {
    id: nameResult.profile.id,
    name: nameResult.profile.name,
    isTemporary: nameResult.profile.isTemporary
  });
}

//console.log('\n📌 Test 3: Deuxième visite (même IP, devrait trouver le profil permanent)');
//console.log('-'.repeat(60));
userId = generateUserHash(testIP, testAgent);
profile = getUserProfile(userId, testIP);
//console.log('Profil récupéré:', {
  id: profile.id,
  name: profile.name,
  isTemporary: profile.isTemporary,
  visitCount: profile.visitCount
});

//console.log('\n📌 Test 4: Visite avec User-Agent différent (même IP)');
//console.log('-'.repeat(60));
const differentAgent = 'Mozilla/5.0 Different Browser';
userId = generateUserHash(testIP, differentAgent);
profile = getUserProfile(userId, testIP);
//console.log('Profil récupéré:', {
  id: profile.id,
  name: profile.name,
  isTemporary: profile.isTemporary,
  visitCount: profile.visitCount
});

//console.log('\n' + '='.repeat(60));
//console.log('✅ Test terminé');
//console.log('='.repeat(60));

// Nettoyer le profil de test
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_DIR = path.join(__dirname, 'data', 'users');

const files = fs.readdirSync(USERS_DIR);
files.forEach(file => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(USERS_DIR, file), 'utf8'));
    if (data.name === 'TestUser') {
      fs.unlinkSync(path.join(USERS_DIR, file));
      //console.log(`🗑️ Profil de test supprimé: ${file}`);
    }
  } catch {}
});

