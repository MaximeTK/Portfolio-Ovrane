import dotenv from 'dotenv';
import { getElevenLabsAudio } from './providers/elevenLabs.js';
import { getOpenAIAudio } from './providers/openai.js';

dotenv.config();

const PROVIDERS = [
  getElevenLabsAudio,
  getOpenAIAudio,
];

/**
 * Nettoie le texte spécifiquement pour le TTS
 * Retire le code, les URLs, et simplifie la lecture.
 */
function cleanTextForTTS(text) {
  if (typeof text !== 'string') return '';

  let clean = text;

  // 1. Remplacer les blocs de code Markdown (```...```)
  // On remplace par une phrase courte indiquant qu'il y a du code
  if (clean.includes('```')) {
    clean = clean.replace(/```[\s\S]*?```/g, " Je t'ai affiché un exemple de code. ");
  }

  // 2. Nettoyer les backticks inline (`code`)
  // On garde le contenu mais on enlève les backticks
  clean = clean.replace(/`([^`]+)`/g, "$1");

  // 3. Remplacer les URLs longues
  // http://google.com/tres/long/chemin -> "un lien"
  clean = clean.replace(/https?:\/\/[^\s]+/g, "un lien");

  // 4. Nettoyer les caractères spéciaux Markdown restants
  // Gras (**texte**) -> texte
  clean = clean.replace(/\*\*([^*]+)\*\*/g, "$1");
  // Italique (*texte*) -> texte
  clean = clean.replace(/\*([^*]+)\*/g, "$1");
  
  // 5. Nettoyer les espaces multiples et trim
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

function normalizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return cleanTextForTTS(text);
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
  // On nettoie le texte AVANT de l'envoyer au TTS
  // Note : Le texte affiché à l'écran restera complet (avec le code),
  // seul l'audio sera modifié.
  const normalized = normalizeText(text);
  
  if (!normalized) {
    return null;
  }
  
  // Si le texte nettoyé est vide (ex: le message n'était QUE du code), on ne génère rien
  if (normalized.length === 0) {
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
