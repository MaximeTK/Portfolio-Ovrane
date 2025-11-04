import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_DIR = path.join(__dirname, '..', 'data', 'users');

/**
 * Trouve et fusionne les profils avec le même ipHash
 */
function cleanDuplicates() {
  //console.log('🔍 Recherche de doublons...\n');
  
  try {
    const files = fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json'));
    
    // Grouper les profils par ipHash
    const profilesByIpHash = {};
    
    files.forEach(file => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(USERS_DIR, file), 'utf8'));
        const ipHash = data.ipHash;
        
        if (!profilesByIpHash[ipHash]) {
          profilesByIpHash[ipHash] = [];
        }
        
        profilesByIpHash[ipHash].push({ file, data });
      } catch (err) {
        console.error(`❌ Erreur lecture ${file}:`, err.message);
      }
    });
    
    // Traiter les doublons
    let duplicatesFound = 0;
    let mergedCount = 0;
    
    Object.entries(profilesByIpHash).forEach(([ipHash, profiles]) => {
      if (profiles.length > 1) {
        duplicatesFound++;
        //console.log(`\n📦 Doublon trouvé pour ipHash: ${ipHash}`);
        //console.log(`   ${profiles.length} profils:`);
        
        profiles.forEach(p => {
          //console.log(`   - ${p.data.id} | Visites: ${p.data.visitCount} | Nom: ${p.data.name || 'N/A'} | Conversations: ${p.data.conversations?.length || 0}`);
        });
        
        // Sélectionner le profil principal (celui avec le plus de données)
        const mainProfile = profiles.reduce((best, current) => {
          const bestScore = (best.data.visitCount || 0) + (best.data.conversations?.length || 0) * 10;
          const currentScore = (current.data.visitCount || 0) + (current.data.conversations?.length || 0) * 10;
          return currentScore > bestScore ? current : best;
        });
        
        //console.log(`   ✅ Profil principal choisi: ${mainProfile.data.id}`);
        
        // Fusionner les autres profils dans le principal
        profiles.forEach(profile => {
          if (profile.file !== mainProfile.file) {
            // Fusionner les conversations
            if (profile.data.conversations && profile.data.conversations.length > 0) {
              mainProfile.data.conversations = [
                ...(mainProfile.data.conversations || []),
                ...profile.data.conversations
              ];
              
              // Trier par timestamp et dédupliquer
              mainProfile.data.conversations = mainProfile.data.conversations
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .filter((conv, index, arr) => {
                  // Supprimer les doublons exacts (même timestamp et prompt)
                  return index === 0 || 
                    conv.timestamp !== arr[index - 1].timestamp ||
                    conv.prompt !== arr[index - 1].prompt;
                });
            }
            
            // Prendre le nom si le principal n'en a pas
            if (!mainProfile.data.name && profile.data.name) {
              mainProfile.data.name = profile.data.name;
            }
            
            // Ajouter au compteur de visites
            if (profile.data.visitCount > 1) {
              mainProfile.data.visitCount = (mainProfile.data.visitCount || 0) + (profile.data.visitCount || 0);
            }
            
            // Prendre la première visite la plus ancienne
            if (new Date(profile.data.firstVisit) < new Date(mainProfile.data.firstVisit)) {
              mainProfile.data.firstVisit = profile.data.firstVisit;
            }
            
            // Supprimer le doublon
            //console.log(`   🗑️ Suppression de: ${profile.data.id}`);
            fs.unlinkSync(path.join(USERS_DIR, profile.file));
            mergedCount++;
          }
        });
        
        // Sauvegarder le profil principal mis à jour
        fs.writeFileSync(
          path.join(USERS_DIR, mainProfile.file),
          JSON.stringify(mainProfile.data, null, 2)
        );
        
        //console.log(`   💾 Profil principal sauvegardé avec ${mainProfile.data.conversations?.length || 0} conversations`);
      }
    });
    
    //console.log('\n' + '='.repeat(60));
    //console.log(`✅ Nettoyage terminé !`);
    //console.log(`   Groupes de doublons trouvés: ${duplicatesFound}`);
    //console.log(`   Profils fusionnés: ${mergedCount}`);
    //console.log(`   Profils restants: ${fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json')).length}`);
    //console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécuter le nettoyage
cleanDuplicates();

