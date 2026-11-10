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
  // Part du plafond du jour par IP : un seul visiteur ne l'épuise pas pour tous
  const parJour = limite(24 * 3600 * 1000, 60);

  app.post('/api/tts', requireSession, parJour, parSession, async (req, res, next) => {
    try {
      const { text, source, voix } = req.body || {};
      if (typeof text !== 'string' || !text) return sendError(res, 400, ERROR_MESSAGES.ttsTextRequired);
      if (text.length > MAX_TEXTE) return sendError(res, 413, ERROR_MESSAGES.ttsTextTooLong);

      // Seul un passage d'un texte signé part chez un fournisseur, sous le plafond
      const audio = voixPermise(text, source, voix) && await consommer('tts') && await generateTTS(text, openai);
      // Sinon la voix du navigateur lit le texte, aucun appel payant
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
