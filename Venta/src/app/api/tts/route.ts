import { NextRequest, NextResponse } from 'next/server';
import { getElevenAudio } from './providers/elevenLabs';
import { getOpenAIAudio } from './providers/openai';

type Provider = {
  id: string;
  load: (text: string) => Promise<ArrayBuffer | null>;
};

const PROVIDERS: Provider[] = [
  { id: 'elevenlabs', load: getElevenAudio },
  { id: 'openai', load: getOpenAIAudio },
];

type SynthesisResult = {
  buffer: ArrayBuffer | null;
  provider: string;
};

async function synthesize(
  text: string,
): Promise<SynthesisResult> {
  for (const provider of PROVIDERS) {
    const buffer = await provider.load(text);
    if (buffer) {
      return { buffer, provider: provider.id };
    }
  }
  return { buffer: null, provider: 'none' };
}

function buildHeaders(
  buffer: ArrayBuffer,
  provider: string,
) {
  return {
    'Content-Type': 'audio/mpeg',
    'Content-Length': buffer.byteLength.toString(),
    'Cache-Control': 'no-cache',
    'X-TTS-Provider': provider,
  };
}

export async function POST(request: NextRequest) {
  let text = '';
  try {
    const body = await request.json();
    text = typeof body?.text === 'string' ? body.text : '';
    if (!text) {
      return NextResponse.json({ error: 'Texte requis' }, {
        status: 400,
      });
    }
    const result = await synthesize(text);
    if (!result.buffer) {
      return NextResponse.json({ useClientTTS: true, text }, {
        status: 200,
      });
    }
    return new NextResponse(result.buffer, {
      headers: buildHeaders(result.buffer, result.provider),
    });
  } catch (error) {
    console.error('[TTS] Route erreur', error);
    return NextResponse.json({ useClientTTS: true, text }, {
      status: 200,
    });
  }
}