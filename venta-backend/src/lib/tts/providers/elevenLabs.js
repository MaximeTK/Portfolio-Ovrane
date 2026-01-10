import {
  ERROR_MESSAGES,
  CONSOLE_LOGS,
  EMOJIS,
  TTS_CONFIG,
} from '../../messages.js';
import { MIME_TYPE_MPEG } from '../constants.js';

const ELEVEN_URL =
  'https://api.elevenlabs.io/v1/text-to-speech';

function getEnv() {
  return {
    key: process.env.ELEVEN_API_KEY,
    voice: process.env.ELEVEN_VOICE_ID,
  };
}

function createPayload(text) {
  return JSON.stringify({
    text,
    model_id: TTS_CONFIG.elevenLabsModel,
    voice_settings: TTS_CONFIG.elevenLabsVoiceSettings,
  });
}

function createHeaders(key) {
  return {
    'xi-api-key': key,
    'Content-Type': 'application/json',
  };
}

function logNoCredits(status) {
  if (status === 401 || status === 402) {
    console.warn(
      `${EMOJIS.warning} ${CONSOLE_LOGS.tts} ` +
        `${ERROR_MESSAGES.ttsElevenLabsNoCredits}`,
    );
  }
}

export async function getElevenLabsAudio(text) {
  const { key, voice } = getEnv();
  if (!key || !voice) {
    return null;
  }
  try {
    const url = `${ELEVEN_URL}/${voice}/stream`;
    const response = await fetch(url, {
      method: 'POST',
      headers: createHeaders(key),
      body: createPayload(text),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      logNoCredits(response.status);
      console.error(
        `${EMOJIS.error} ${CONSOLE_LOGS.tts} ` +
          `${ERROR_MESSAGES.ttsElevenLabsError}`,
      );
      return null;
    }
    const buffer = await response.arrayBuffer();
    return {
      buffer,
      provider: 'elevenlabs',
      mimeType: MIME_TYPE_MPEG,
    };
  } catch (error) {
    // IMPORTANT: en cas d'erreur réseau (ex: ECONNRESET), on retourne null
    // pour permettre au ttsGenerator de tenter le provider suivant (OpenAI).
    console.error(
      `${EMOJIS.error} ${CONSOLE_LOGS.tts} ` +
        `${ERROR_MESSAGES.ttsElevenLabsException}`,
      error,
    );
    return null;
  }
}

