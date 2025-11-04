import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_DIR = path.join(__dirname, '..', 'data', 'users');

/**
 * Migre les profils existants vers le nouveau système
 * - Ajoute le flag isTemporary
 * - Les profils avec nom = permanent (false)
 * - Les profils sans nom = temporaire (true)
 */
function migrateProfiles() {
  //console.log('🔄 Migration des profils vers le nouveau système...\n');
  
  try {
    const files = fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json'));
    
    let migratedCount = 0;
    let permanentCount = 0;
    let temporaryCount = 0;
    
    files.forEach(file => {
      try {
        const filePath = path.join(USERS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Vérifier si le profil a déjà été migré
        if (data.hasOwnProperty('isTemporary')) {
          //console.log(`⏭️ ${data.id} - Déjà migré (${data.isTemporary ? 'temporaire' : 'permanent'})`);
          if (data.isTemporary) temporaryCount++;
          else permanentCount++;
          return;
        }
        
        // Déterminer si temporaire ou permanent
        const isPermanent = !!data.name;
        data.isTemporary = !isPermanent;
        
        // Sauvegarder
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        
        //console.log(`✅ ${data.id} - Migré: ${data.isTemporary ? 'TEMPORAIRE' : 'PERMANENT'} ${data.name ? `(${data.name})` : '(anonyme)'}`);
        migratedCount++;
        
        if (data.isTemporary) temporaryCount++;
        else permanentCount++;
        
      } catch (err) {
        console.error(`❌ Erreur migration ${file}:`, err.message);
      }
    });
    
    //console.log('\n' + '='.repeat(60));
    //console.log(`✅ Migration terminée !`);
    //console.log(`   Profils migrés: ${migratedCount}`);
    //console.log(`   Profils permanents: ${permanentCount}`);
    //console.log(`   Profils temporaires: ${temporaryCount}`);
    //console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécuter la migration
migrateProfiles();

