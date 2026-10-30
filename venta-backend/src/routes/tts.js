/**
 * Synthèse vocale d'un passage de réponse, pour l'utilisateur de la session
 */
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { generateTTS } from '../services/tts.js';
import { consommer } from '../services/budget.js';
import { sendError, requireSession, limite } from '../http.js';
import { ERROR_MESSAGES } from '../messages.js';
import * as log from '../log.js';

const MAX_TEXTE = 1000;

export function setupTTSRoutes(app, openai) {
  // Par session, comptée sur son utilisateur : une réponse part en plusieurs passages
  const parSession = limite(60 * 1000, 30, (req) => req.user.id);

  app.post('/api/tts', requireSession, parSession, async (req, res, next) => {
    try {
      const { text } = req.body || {};
      if (typeof text !== 'string' || !text) return sendError(res, 400, ERROR_MESSAGES.ttsTextRequired);
      if (text.length > MAX_TEXTE) return sendError(res, 413, ERROR_MESSAGES.ttsTextTooLong);

      // Plafond de voix du jour atteint : la voix du navigateur lit le texte, aucun fournisseur payant n'est appelé
      if (!(await consommer('tts'))) return res.json({ useClientTTS: true, text });
      const audio = await generateTTS(text, openai);
      // Sans audio, la voix du navigateur lit le texte
      if (!audio) return res.json({ useClientTTS: true, text });
      res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache', 'X-TTS-Provider': audio.provider });
      if (!audio.stream) return res.send(audio.buffer);
      // Chaque morceau part dès sa réception ; une coupure ferme la réponse, le navigateur lit ce qu'il a reçu
      await pipeline(Readable.fromWeb(audio.stream), res).catch((error) => log.warn('[TTS] Flux interrompu :', error.message));
    } catch (error) {
      next(error);
    }
  });
}
