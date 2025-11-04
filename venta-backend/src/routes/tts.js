/**
 * Route TTS avec système de fallback - max 5 fonctions, max 20 lignes
 */
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { 
  ERROR_MESSAGES, 
  CONSOLE_LOGS, 
  EMOJIS, 
  TTS_CONFIG,
  MISC_MESSAGES 
} from '../lib/messages.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Essaie Eleven Labs TTS
 */
async function tryElevenLabs(text) {
  const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
  const ELEVEN_VOICE_ID = process.env.ELEVEN_VOICE_ID;
  if (!ELEVEN_API_KEY || !ELEVEN_VOICE_ID) return null;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: TTS_CONFIG.elevenLabsModel,
        voice_settings: TTS_CONFIG.elevenLabsVoiceSettings
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.tts} ${ERROR_MESSAGES.ttsElevenLabsError}`, response.status, errorText);
      if (response.status === 401 || response.status === 402) {
        console.warn(`💳 ${CONSOLE_LOGS.tts} ${ERROR_MESSAGES.ttsElevenLabsNoCredits}`);
      }
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    return { buffer: audioBuffer, provider: 'elevenlabs' };
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.tts} ${ERROR_MESSAGES.ttsElevenLabsException}`, error.message);
    return null;
  }
}

/**
 * Essaie OpenAI TTS (fallback)
 */
async function tryOpenAI(text) {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const response = await openai.audio.speech.create({
      model: TTS_CONFIG.openaiModel,
      voice: TTS_CONFIG.openaiVoice,
      input: text,
      speed: TTS_CONFIG.openaiSpeed
    });
    const audioBuffer = await response.arrayBuffer();
    return { buffer: audioBuffer, provider: 'openai' };
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.tts} ${ERROR_MESSAGES.ttsOpenAIError}`, error.message);
    return null;
  }
}

/**
 * Route TTS avec système de fallback
 */
export async function handleTTS(req, res) {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: ERROR_MESSAGES.ttsTextRequired });
    }

    let result = await tryElevenLabs(text);
    if (!result) result = await tryOpenAI(text);
    
    if (!result) {
      return res.json({ useClientTTS: true, text: text });
    }

    res.set({
      [MISC_MESSAGES.httpContentType]: MISC_MESSAGES.contentTypeAudioMPEG,
      [MISC_MESSAGES.httpContentLength]: result.buffer.byteLength,
      [MISC_MESSAGES.httpCacheControl]: MISC_MESSAGES.httpNoCacheValue,
      [MISC_MESSAGES.httpTTSProvider]: result.provider
    });
    res.send(Buffer.from(result.buffer));
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.tts} ${ERROR_MESSAGES.ttsGlobalError}:`, error);
    res.json({ useClientTTS: true, text: req.body.text || '' });
  }
}
