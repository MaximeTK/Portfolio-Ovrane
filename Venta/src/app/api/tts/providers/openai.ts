import OpenAI from 'openai';

const MODEL = 'tts-1';
const VOICE = 'nova';
const SPEED = 1;

function getApiKey() {
  return process.env.OPENAI_API_KEY;
}

export async function getOpenAIAudio(
  text: string,
): Promise<ArrayBuffer | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }
  const client = new OpenAI({ apiKey });
  const response = await client.audio.speech.create({
    model: MODEL,
    voice: VOICE,
    input: text,
    speed: SPEED,
  });
  return response.arrayBuffer();
}

