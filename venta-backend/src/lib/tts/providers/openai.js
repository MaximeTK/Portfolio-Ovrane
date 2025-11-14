import OpenAI from 'openai';
import {
  ERROR_MESSAGES,
  CONSOLE_LOGS,
  EMOJIS,
  TTS_CONFIG,
} from '../../messages.js';
import { MIME_TYPE_MPEG } from '../constants.js';

function getApiKey() {
  return process.env.OPENAI_API_KEY;
}

export async function getOpenAIAudio(text) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }
  try {
    const client = new OpenAI({ apiKey });
    const response = await client.audio.speech.create({
      model: TTS_CONFIG.openaiModel,
      voice: TTS_CONFIG.openaiVoice,
      input: text,
      speed: TTS_CONFIG.openaiSpeed,
    });
    const buffer = await response.arrayBuffer();
    return {
      buffer,
      provider: 'openai',
      mimeType: MIME_TYPE_MPEG,
    };
  } catch (error) {
    console.error(
      `${EMOJIS.error} ${CONSOLE_LOGS.tts} ` +
        `${ERROR_MESSAGES.ttsOpenAIError}`,
      error,
    );
    return null;
  }
}

