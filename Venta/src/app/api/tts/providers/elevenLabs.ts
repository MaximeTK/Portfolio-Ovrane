const ELEVEN_URL =
  'https://api.elevenlabs.io/v1/text-to-speech';

type ElevenEnv = {
  key?: string;
  voice?: string;
};

function getEnv(): ElevenEnv {
  return {
    key: process.env.ELEVEN_API_KEY,
    voice: process.env.ELEVEN_VOICE_ID,
  };
}

function buildBody(text: string) {
  return JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.35,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true,
    },
  });
}

export async function getElevenAudio(
  text: string,
): Promise<ArrayBuffer | null> {
  const { key, voice } = getEnv();
  if (!key || !voice) {
    return null;
  }
  const url = `${ELEVEN_URL}/${voice}/stream`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
    },
    body: buildBody(text),
  });
  if (!response.ok) {
    const noCredits = response.status === 401 || response.status === 402;
    if (noCredits) {
      console.warn('[TTS] Eleven Labs sans crédits');
    }
    return null;
  }
  return response.arrayBuffer();
}

