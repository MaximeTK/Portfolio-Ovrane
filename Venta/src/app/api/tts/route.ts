import { NextRequest, NextResponse } from 'next/server';
import { forward } from '@/lib/api/proxy';

/** Seule route à relayer du binaire. Tout échec bascule sur la voix du navigateur. */
export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const response = await forward('/api/tts', { method: 'POST', body, timeout: 60_000 });
    if (!response.ok) {
      return NextResponse.json({ useClientTTS: true, text: body.text }, { status: 200 });
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return NextResponse.json(await response.json());
    }

    const audio = await response.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        'Cache-Control': 'no-cache',
        'X-TTS-Provider': response.headers.get('X-TTS-Provider') || 'backend-proxy',
      },
    });
  } catch (error) {
    console.error('[proxy] /api/tts:', error);
    return NextResponse.json({ useClientTTS: true, text: body.text ?? '' }, { status: 200 });
  }
}
