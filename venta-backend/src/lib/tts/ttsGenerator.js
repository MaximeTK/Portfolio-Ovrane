/**
 * Générateur TTS réutilisable pour intégration dans le chat
 */
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { 
  ERROR_MESSAGES, 
  CONSOLE_LOGS, 
  EMOJIS, 
  TTS_CONFIG
} from '../messages.js';

dotenv.config();

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
    // Créer l'instance OpenAI uniquement quand nécessaire
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
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
 * Génère l'audio TTS pour un texte donné
 * Retourne { buffer: ArrayBuffer, provider: string } ou null
 */
export async function generateTTS(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return null;
  }

  // Tentative 1 : Eleven Labs
  let result = await tryElevenLabs(text);
  if (result) {
    return result;
  }

  // Tentative 2 : OpenAI TTS
  result = await tryOpenAI(text);
  if (result) {
    return result;
  }

  // Pas de TTS disponible côté serveur
  return { useClientTTS: true };
}

