/**
 * Configuration du serveur Express
 */
import express from 'express';
import cors from 'cors';
import { ERROR_MESSAGES } from '../messages.js';

/**
 * Crée le middleware CORS
 */
function createCorsMiddleware(allowedOrigins) {
  return cors({
    origin: (origin, callback) => {
      // Log pour debugging
      console.log(`🌐 [CORS] Requête depuis l'origine: ${origin || 'No Origin'}`);
      
      // Autoriser les requêtes sans origine (par ex. Postman)
      if (!origin) {
        console.log(`✅ [CORS] Autorisation: No Origin`);
        return callback(null, true);
      }
      
      // Autoriser si dans la liste des origines autorisées
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        console.log(`✅ [CORS] Autorisation: Origine autorisée`);
        return callback(null, true);
      }
      
      // Autoriser automatiquement toutes les URL ngrok
      if (origin.includes('ngrok')) {
        console.log(`✅ [CORS] Autorisation: URL ngrok détectée`);
        return callback(null, true);
      }
      
      console.log(`❌ [CORS] Blocage: Origine non autorisée`);
      console.log(`📋 [CORS] Origines autorisées:`, allowedOrigins);
      callback(new Error(ERROR_MESSAGES.corsNotAllowed));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });
}

/**
 * Configure l'application Express
 */
export function configureServer() {
  const app = express();
  const allowedOrigins = process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',') 
    : ['http://localhost:3000'];
  
  console.log(`🔧 [SERVER CONFIG] Origines CORS autorisées:`, allowedOrigins);
  console.log(`🔧 [SERVER CONFIG] Toutes les URLs ngrok seront autorisées automatiquement`);
  
  app.use(createCorsMiddleware(allowedOrigins));
  app.use(express.json());
  
  return { app, allowedOrigins };
}

