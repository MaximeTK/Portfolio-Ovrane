/**
 * Générateur TTS réutilisable pour intégration dans le chat
 */
import OpenAI from 'openai';
import { OpenAIRealtimeWS } from 'openai/beta/realtime/ws';
import dotenv from 'dotenv';
import { 
  ERROR_MESSAGES, 
  CONSOLE_LOGS, 
  EMOJIS, 
  TTS_CONFIG
} from '../messages.js';

dotenv.config();

const MIME_TYPE_MPEG = 'audio/mpeg';
const MIME_TYPE_WAV = 'audio/wav';

function getRealtimeConfig() {
  const model = process.env.OPENAI_REALTIME_MODEL || TTS_CONFIG.openaiRealtimeModel;
  const voice = process.env.OPENAI_REALTIME_VOICE || TTS_CONFIG.openaiRealtimeVoice;
  const sampleRate = Number(process.env.OPENAI_REALTIME_SAMPLE_RATE || TTS_CONFIG.openaiRealtimeSampleRate || 24000);
  const temperature = Number(process.env.OPENAI_REALTIME_TEMPERATURE || TTS_CONFIG.openaiRealtimeTemperature || 0.85);
  const timeoutMs = Number(process.env.OPENAI_REALTIME_TIMEOUT_MS || TTS_CONFIG.openaiRealtimeTimeoutMs || 15000);
  const instructions = process.env.OPENAI_REALTIME_INSTRUCTIONS || TTS_CONFIG.openaiRealtimeInstructions;

  return { model, voice, sampleRate, temperature, timeoutMs, instructions };
}

function pcm16ToWav(pcmBuffer, sampleRate = 24000, channels = 1) {
  if (!pcmBuffer || pcmBuffer.length === 0) {
    return Buffer.alloc(0);
  }

  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const totalSize = 44 + dataSize;

  const wavBuffer = Buffer.alloc(totalSize);
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(totalSize - 8, 4);
  wavBuffer.write('WAVE', 8);
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16); // PCM chunk size
  wavBuffer.writeUInt16LE(1, 20);  // PCM format
  wavBuffer.writeUInt16LE(channels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer;
}

/**
 * Essaie OpenAI Realtime (latence très faible)
 */
async function tryOpenAIRealtime(text) {
  if (!process.env.OPENAI_API_KEY) return null;

  const { model, voice, sampleRate, temperature, timeoutMs, instructions } = getRealtimeConfig();
  if (!model || !voice) return null;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const realtime = new OpenAIRealtimeWS({ model }, openai);

    const result = await new Promise((resolve, reject) => {
      const audioChunks = [];
      let isResolved = false;
      const timeoutHandle = setTimeout(() => {
        if (isResolved) return;
        isResolved = true;
        realtime.close({ code: 4000, reason: 'timeout' });
        resolve(null);
      }, timeoutMs);

      const cleanUp = () => {
        clearTimeout(timeoutHandle);
        realtime.off('response.audio.delta', onAudioDelta);
        realtime.off('response.audio.done', onAudioDone);
        realtime.off('response.content_part.added', onContentPart);
        realtime.off('response.failed', onFailed);
        realtime.off('error', onError);
      };

      const finish = (value) => {
        if (isResolved) return;
        isResolved = true;
        cleanUp();
        realtime.close({ code: 1000, reason: 'completed' });
        resolve(value);
      };

      const fail = (error) => {
        if (isResolved) return;
        isResolved = true;
        cleanUp();
        realtime.close({ code: 4001, reason: 'error' });
        reject(error);
      };

      const onAudioDelta = (event) => {
        if (event?.delta) {
          audioChunks.push(event.delta);
        }
      };

      const onContentPart = (event) => {
        if (event?.part?.audio) {
          audioChunks.push(event.part.audio);
        }
      };

      const onAudioDone = () => {
        const base64Audio = audioChunks.join('');
        if (!base64Audio) {
          finish(null);
          return;
        }
        const pcmBuffer = Buffer.from(base64Audio, 'base64');
        const wavBuffer = pcm16ToWav(pcmBuffer, sampleRate);
        finish({
          buffer: wavBuffer,
          provider: 'openai-realtime',
          mimeType: MIME_TYPE_WAV,
        });
      };

      const onFailed = (event) => {
        const message = event?.error?.message || 'Realtime response failed';
        fail(new Error(message));
      };

      const onError = (error) => {
        fail(error instanceof Error ? error : new Error(String(error)));
      };

      realtime.on('response.audio.delta', onAudioDelta);
      realtime.on('response.audio.done', onAudioDone);
      realtime.on('response.content_part.added', onContentPart);
      realtime.on('response.failed', onFailed);
      realtime.on('error', onError);

      realtime.once('session.created', () => {
        realtime.send({
          type: 'session.update',
          session: {
            voice,
            modalities: ['audio', 'text'],
            output_audio_format: 'pcm16',
            temperature,
            instructions,
          },
        });

        const sanitizedText = text?.trim() || '';
        const systemPrompt =
          'Tu es un moteur TTS. Prononce exclusivement le texte balisé <texte> ... </texte> sans rien ajouter, traduire ni reformuler.';
        const userPayload = `<texte>${sanitizedText}</texte>`;

        realtime.send({
          type: 'response.create',
          response: {
            conversation: 'none',
            modalities: ['audio', 'text'],
            output_audio_format: 'pcm16',
            instructions,
            temperature,
            input: [
              {
                type: 'message',
                role: 'system',
                content: [
                  {
                    type: 'input_text',
                    text: systemPrompt,
                  },
                ],
              },
              {
                type: 'message',
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: userPayload,
                  },
                ],
              },
            ],
          },
        });
      });
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.tts} Realtime OpenAI erreur:`, message);
    return null;
  }
}

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
    return { buffer: audioBuffer, provider: 'elevenlabs', mimeType: MIME_TYPE_MPEG };
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
    return { buffer: audioBuffer, provider: 'openai', mimeType: MIME_TYPE_MPEG };
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

  const shouldUseDefaultTTS = String(process.env['TTS-DEFAULT'] || '').toLowerCase() === 'true';
  if (shouldUseDefaultTTS) {
    return { useClientTTS: true, text };
  }

  // Tentative 1 : OpenAI Realtime
  let result = await tryOpenAIRealtime(text);
  if (result) {
    return result;
  }

  // Tentative 2 : Eleven Labs
  result = await tryElevenLabs(text);
  if (result) {
    return result;
  }

  // Tentative 3 : OpenAI TTS (classique)
  result = await tryOpenAI(text);
  if (result) {
    return result;
  }

  // Pas de TTS disponible côté serveur
  return { useClientTTS: true };
}

