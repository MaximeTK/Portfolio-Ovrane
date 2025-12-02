/**
 * Gestion de la connexion à MongoDB
 */
import mongoose from 'mongoose';
import { EMOJIS, CONSOLE_LOGS } from './messages.js';

let isConnected = false;

export async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  if (!process.env.MONGODB_URI) {
    console.warn(`${EMOJIS.warning} [DATABASE] Attention: MONGODB_URI n'est pas défini. Le mode persistant est désactivé.`);
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'venta', // Nom de la base de données
    });

    isConnected = db.connections[0].readyState === 1;
    console.log(`${EMOJIS.success} [DATABASE] Connecté à MongoDB Atlas avec succès`);
  } catch (error) {
    console.error(`${EMOJIS.error} [DATABASE] Erreur de connexion MongoDB:`, error.message);
    // En dev, on ne crash pas l'app si la BDD échoue, on log juste l'erreur
    // En prod, c'est peut-être mieux de crash
  }
}

