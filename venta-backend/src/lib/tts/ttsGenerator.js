import dotenv from 'dotenv';
import { getElevenLabsAudio } from './providers/elevenLabs.js';
import { getOpenAIAudio } from './providers/openai.js';

dotenv.config();

const PROVIDERS = [
  getElevenLabsAudio,
  getOpenAIAudio,
];

function normalizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return text.trim();
}

function usesClientFallback() {
  const flag = process.env['TTS-DEFAULT'];
  if (!flag) {
    return false;
  }
  return flag.toLowerCase() === 'true';
}

async function runProviders(text) {
  for (const load of PROVIDERS) {
    const result = await load(text);
    if (result) {
      return result;
    }
  }
  return null;
}

export async function generateTTS(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }
  if (usesClientFallback()) {
    return { useClientTTS: true, text: normalized };
  }
  const result = await runProviders(normalized);
  if (result) {
    return result;
  }
  return { useClientTTS: true };
}

