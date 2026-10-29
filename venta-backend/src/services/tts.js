/**
 * Synthèse vocale : Cartesia, puis ElevenLabs, puis OpenAI ; null laisse la voix du navigateur lire le texte
 */
import { config } from '../config.js';
import * as log from '../log.js';

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
    // Le corps reste un flux : la route le transmet à mesure que Cartesia synthétise
    return { stream: response.body, provider: 'cartesia' };
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

const CARTESIA_WS = 'wss://api.cartesia.ai/tts/websocket?cartesia_version=2026-08-14';
const FORMAT_FLUX = { container: 'raw', encoding: 'pcm_s16le', sample_rate: 24000 };

// Morceau lisible à voix haute, espaces gardés pour que les morceaux se recollent : sans code, liens ni Markdown
export function preparerPourVoix(segment, etat) {
  let sortie = '';
  segment.split('```').forEach((partie, i) => {
    if (i > 0) {
      etat.dansCode = !etat.dansCode;
      if (!etat.dansCode) sortie += ' Je vous ai affiché un exemple de code. ';
    }
    if (!etat.dansCode) sortie += partie;
  });
  return sortie.replace(/https?:\/\/\S+/g, 'un lien').replace(/[*_#`>|]/g, '').replace(/\s+/g, ' ');
}

/**
 * Voix d'une réponse écrite en flux : les mots complets partent en continuation d'un même contexte Cartesia,
 * l'audio PCM revient à mesure ; null sans clé ; surEchec seulement si la voix tombe avant tout son
 */
export function ouvrirVoixFlux({ surAudio, surEchec }) {
  const { cartesiaKey, cartesiaVoice, cartesiaModel, navigateur } = config.tts;
  if (!cartesiaKey || navigateur) return null;
  const contexte = crypto.randomUUID();
  const ws = new WebSocket(CARTESIA_WS, { headers: { 'X-API-Key': cartesiaKey } });
  const enAttente = [];
  const etat = { dansCode: false };
  let reste = '';
  let audioRecu = false;
  let termine = false;
  let signalerFin;
  const fin = new Promise((ok) => { signalerFin = ok; });
  const terminer = (raison) => {
    if (termine) return;
    termine = true;
    if (raison) {
      log.warn('[TTS] Voix en flux :', raison);
      if (!audioRecu) surEchec();
    }
    signalerFin();
  };
  const envoyer = (transcript, suite) => {
    const message = JSON.stringify({ model_id: cartesiaModel, transcript, voice: { id: cartesiaVoice }, output_format: FORMAT_FLUX, context_id: contexte, continue: suite, max_buffer_delay_ms: 200 });
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
    else enAttente.push(message);
  };
  ws.onopen = () => {
    for (const message of enAttente.splice(0)) ws.send(message);
  };
  ws.onmessage = (evenement) => {
    let message;
    try {
      message = JSON.parse(evenement.data);
    } catch {
      return;
    }
    if (message.type === 'chunk' && message.data) {
      audioRecu = true;
      surAudio(message.data);
    }
    if (message.type === 'error') terminer(`${message.status_code} ${message.title ?? ''} ${message.message ?? ''}`);
    if (message.type === 'done') terminer();
  };
  ws.onerror = () => terminer('connexion impossible');
  ws.onclose = () => terminer('connexion fermée avant la fin');

  return {
    // Seuls les mots complets partent : le dernier, peut-être coupé, attend le morceau suivant
    dire(delta) {
      if (termine) return;
      reste += delta;
      const coupe = reste.search(/\s\S*$/);
      if (coupe < 0) return;
      const segment = preparerPourVoix(reste.slice(0, coupe + 1), etat);
      reste = reste.slice(coupe + 1);
      if (segment.trim()) envoyer(segment, true);
    },
    // Dernier morceau puis attente de la fin de la synthèse, bornée à deux minutes
    async finir() {
      if (!termine) envoyer(preparerPourVoix(reste, etat), false);
      await Promise.race([fin, new Promise((ok) => setTimeout(ok, 120_000).unref())]);
      ws.close();
    },
    annuler() {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ context_id: contexte, cancel: true }));
      termine = true;
      signalerFin();
      ws.close();
    },
  };
}

export async function generateTTS(text, openai) {
  const texte = nettoyer(text);
  if (!texte || config.tts.navigateur) return null;
  return (await cartesia(texte)) || (await elevenLabs(texte)) || voixOpenAI(texte, openai);
}
