/** Synthèse vocale d'un passage de réponse, pour l'utilisateur de la session */
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { generateTTS } from '../services/tts.js';
import { consommer } from '../services/budget.js';
import { voixPermise } from '../services/voix.js';
import { sendError, requireSession, limite } from '../http.js';
import { ERROR_MESSAGES } from '../messages.js';
import * as log from '../log.js';

const MAX_TEXTE = 1000;

export function setupTTSRoutes(app, openai) {
  // Comptée par session : une réponse part en plusieurs passages
  const parSession = limite(60 * 1000, 30, (req) => req.user.id);

  app.post('/api/tts', requireSession, parSession, async (req, res, next) => {
    try {
      const { text, source, voix } = req.body || {};
      if (typeof text !== 'string' || !text) return sendError(res, 400, ERROR_MESSAGES.ttsTextRequired);
      if (text.length > MAX_TEXTE) return sendError(res, 413, ERROR_MESSAGES.ttsTextTooLong);

      // Seul un passage d'un texte signé part chez un fournisseur de voix
      if (!voixPermise(text, source, voix)) return res.json({ useClientTTS: true, text });
      // Plafond de voix atteint : la voix du navigateur lit, aucun appel payant
      if (!(await consommer('tts'))) return res.json({ useClientTTS: true, text });
      const audio = await generateTTS(text, openai);
      // Sans audio, la voix du navigateur lit le texte
      if (!audio) return res.json({ useClientTTS: true, text });
      res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache', 'X-TTS-Provider': audio.provider });
      if (!audio.stream) return res.send(audio.buffer);
      // Chaque morceau part dès réception ; une coupure ferme la réponse
      await pipeline(Readable.fromWeb(audio.stream), res).catch((error) => log.warn('[TTS] Flux interrompu :', error.message));
    } catch (error) {
      next(error);
    }
  });
}
