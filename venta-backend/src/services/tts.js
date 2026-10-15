/**
 * Synthèse vocale : Cartesia, puis ElevenLabs, puis OpenAI ; null laisse la voix du navigateur lire le texte
 */
import { config } from '../config.js';
import * as log from '../log.js';
import { MISC_MESSAGES } from '../messages.js';

// Accueils sans nom : voix générée une fois dans Venta/public par `npm run voix:accueil`, à relancer si le texte change
export const VOIX_ACCUEIL = {
  nouveau: { texte: MISC_MESSAGES.welcomeNew(), url: '/voix/accueil-nouveau.mp3' },
  retour: { texte: MISC_MESSAGES.welcomeBack(), url: '/voix/accueil-retour.mp3' },
};

// Le texte affiché reste complet ; seul l'audio perd le code, les liens et le Markdown
function nettoyer(text) {
  return text
    .replace(/```[\s\S]*?```/g, " Je t'ai affiché un exemple de code. ")
    .replace(/`([^`]+)`/g, '$1')
    .replace(/https?:\/\/[^\s]+/g, 'un lien')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

async function cartesia(texte) {
  const { cartesiaKey, cartesiaVoice, cartesiaModel } = config.tts;
  if (!cartesiaKey) return null;
  try {
    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cartesiaKey}`, 'Cartesia-Version': '2026-08-14', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: cartesiaModel,
        transcript: texte,
        voice: { id: cartesiaVoice },
        output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      // Crédits du mois épuisés, dépassement coupé : le fournisseur suivant prend le relais
      log.warn(`[TTS] Cartesia a répondu ${response.status}`);
      return null;
    }
    return { buffer: Buffer.from(await response.arrayBuffer()), provider: 'cartesia' };
  } catch (error) {
    log.error('[TTS] Cartesia :', error.message);
    return null;
  }
}

async function elevenLabs(texte) {
  const { elevenKey, elevenVoice, elevenModel, elevenVoiceSettings } = config.tts;
  if (!elevenKey || !elevenVoice) return null;
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice}/stream`, {
      method: 'POST',
      headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texte, model_id: elevenModel, voice_settings: elevenVoiceSettings }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      log.warn(`[TTS] ElevenLabs a répondu ${response.status}${[401, 402].includes(response.status) ? ' (plus de crédits ?)' : ''}`);
      return null;
    }
    return { buffer: Buffer.from(await response.arrayBuffer()), provider: 'elevenlabs' };
  } catch (error) {
    // Une erreur réseau laisse OpenAI prendre le relais
    log.error('[TTS] ElevenLabs :', error.message);
    return null;
  }
}

async function voixOpenAI(texte, openai) {
  try {
    const response = await openai.audio.speech.create({
      model: config.tts.openaiModel,
      voice: config.tts.openaiVoice,
      input: texte,
      speed: config.tts.openaiSpeed,
    });
    return { buffer: Buffer.from(await response.arrayBuffer()), provider: 'openai' };
  } catch (error) {
    log.error('[TTS] OpenAI :', error.message);
    return null;
  }
}

export async function generateTTS(text, openai) {
  const texte = nettoyer(text);
  if (!texte || config.tts.navigateur) return null;
  return (await cartesia(texte)) || (await elevenLabs(texte)) || voixOpenAI(texte, openai);
}
