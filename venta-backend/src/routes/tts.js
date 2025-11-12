/**
 * Route TTS avec système de fallback - max 5 fonctions, max 20 lignes
 */
import dotenv from 'dotenv';
import { 
  ERROR_MESSAGES, 
  CONSOLE_LOGS, 
  EMOJIS, 
  MISC_MESSAGES 
} from '../lib/messages.js';
import { generateTTS } from '../lib/tts/ttsGenerator.js';

dotenv.config();

/**
 * Route TTS avec système de fallback
 */
export async function handleTTS(req, res) {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: ERROR_MESSAGES.ttsTextRequired });
    }

    const result = await generateTTS(text);

    if (!result || result.useClientTTS || !result.buffer) {
      return res.json({ useClientTTS: true, text: text });
    }

    const audioBuffer = Buffer.isBuffer(result.buffer)
      ? result.buffer
      : Buffer.from(result.buffer);
    const mimeType = result.mimeType || MISC_MESSAGES.contentTypeAudioMPEG;
    const provider = result.provider || 'unknown';

    res.set({
      [MISC_MESSAGES.httpContentType]: mimeType,
      [MISC_MESSAGES.httpContentLength]: audioBuffer.length,
      [MISC_MESSAGES.httpCacheControl]: MISC_MESSAGES.httpNoCacheValue,
      [MISC_MESSAGES.httpTTSProvider]: provider
    });
    res.send(audioBuffer);
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.tts} ${ERROR_MESSAGES.ttsGlobalError}:`, error);
    res.json({ useClientTTS: true, text: req.body.text || '' });
  }
}
