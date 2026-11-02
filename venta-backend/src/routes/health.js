/** Sonde de Render : état de la base et du RAG, sans le nom de la base */
import mongoose from 'mongoose';
import { etatIndex } from '../services/rag/ragSystem.js';
import { SUCCESS_MESSAGES } from '../messages.js';

export function setupHealthRoute(app) {
  app.get('/health', (req, res) => {
    // 503 sans base : chaque requête d'un utilisateur finirait en 500
    const connectee = mongoose.connection.readyState === 1;
    const { length: passages } = etatIndex().passages;
    res.status(connectee ? 200 : 503).json({
      status: connectee ? SUCCESS_MESSAGES.healthOK : 'degraded',
      timestamp: new Date().toISOString(),
      db: { connected: connectee },
      rag: { initialized: passages > 0, passages },
    });
  });
}
