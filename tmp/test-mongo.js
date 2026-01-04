// Script de test de connexion MongoDB isolé
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger le .env du backend
dotenv.config({ path: path.join(__dirname, '../venta-backend/.env') });

console.log('--- TEST DE CONNEXION MONGODB ---');
const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('❌ ERREUR: MONGODB_URI non trouvé dans le .env !');
    process.exit(1);
}

// Masquer le mot de passe pour l'affichage
const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
console.log(`📡 Tentative de connexion à : ${maskedUri}`);

async function testConnection() {
    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000 // Timeout rapide de 5s pour voir l'erreur vite
        });
        console.log('✅ SUCCÈS : Connexion établie avec MongoDB Atlas !');
        console.log('État de la connexion :', mongoose.connection.readyState);
        await mongoose.disconnect();
        console.log('👋 Déconnecté.');
    } catch (error) {
        console.error('❌ ÉCHEC DE CONNEXION :');
        console.error('Nom de l\'erreur :', error.name);
        console.error('Message :', error.message);
        if (error.cause) console.error('Cause :', error.cause);
        
        // Conseils basés sur l'erreur
        if (error.message.includes('bad auth')) {
            console.log('\n💡 CONSEIL : Vérifiez votre utilisateur et mot de passe.');
        } else if (error.message.includes('ENOTFOUND')) {
            console.log('\n💡 CONSEIL : L\'adresse du cluster est introuvable. Vérifiez l\'URL.');
        } else if (error.message.includes('ETIMEDOUT') || error.message.includes('buffering timed out')) {
            console.log('\n💡 CONSEIL : Timeout réseau. Vérifiez votre IP Whitelist dans Atlas (Network Access).');
        }
    }
}

testConnection();

