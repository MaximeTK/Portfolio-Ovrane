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

  // Aucun repli : sans nom de base explicite, un serveur de dev écrirait dans
  // la base de production. On refuse de démarrer plutôt que de deviner.
  const dbName = process.env.MONGODB_DB;
  if (!dbName) {
    console.error(
      `${EMOJIS.error} [DATABASE] MONGODB_DB n'est pas défini. Arrêt: ` +
      `sans nom de base explicite le serveur écrirait dans la base par défaut.`,
    );
    process.exit(1);
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, { dbName });

    console.log(`${EMOJIS.info} [DATABASE] Base: ${dbName}`);

    isConnected = db.connections[0].readyState === 1;
    console.log(`${EMOJIS.success} [DATABASE] Connecté à MongoDB Atlas avec succès`);
  } catch (error) {
    console.error(`${EMOJIS.error} [DATABASE] Erreur de connexion MongoDB:`, error.message);
    // En dev, on ne crash pas l'app si la BDD échoue, on log juste l'erreur
    // En prod, c'est peut-être mieux de crash
    isConnected = false;
    console.warn(`${EMOJIS.warning} [DATABASE] Mode sans échec activé: Le serveur continue sans base de données (données volatiles).`);
  }
}

