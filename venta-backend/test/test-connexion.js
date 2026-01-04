// Script de test de connexion MongoDB (Version détaillée)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('--- DIAGNOSTIC APPROFONDI MONGODB ---');
const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('❌ ERREUR: MONGODB_URI non trouvé !');
    process.exit(1);
}

const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
console.log(`📡 URL cible : ${maskedUri}`);

async function testConnection() {
    try {
        console.log('⏳ Tentative de connexion...');
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 5000,
        });
        console.log('✅ SUCCÈS ! Connexion établie.');
        await mongoose.disconnect();
    } catch (error) {
        console.error('\n❌ ÉCHEC FATAL DE CONNEXION');
        console.error('============================');
        // Afficher l'objet erreur complet
        console.error(error);
        console.error('============================');
        
        if (error.reason) console.error('Raison:', error.reason);
        if (error.code) console.error('Code:', error.code);
        if (error.codeName) console.error('CodeName:', error.codeName);
    }
}

testConnection();
