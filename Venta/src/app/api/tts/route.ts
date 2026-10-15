import { NextRequest, NextResponse } from 'next/server';
import { forward } from '@/lib/proxy';

/** Seule route à relayer de l'audio. Tout échec bascule sur la voix du navigateur. */
export async function POST(request: NextRequest) {
  try {
    const response = await forward(request, '/api/tts', { method: 'POST', body: await request.json() });
    const type = response?.headers.get('content-type') ?? '';
    if (response?.ok && type.startsWith('audio/')) {
      return new NextResponse(response.body, { headers: { 'Content-Type': type, 'Cache-Control': 'no-cache' } });
    }
  } catch (error) {
    console.error('[relai] /api/tts :', error);
  }
  return NextResponse.json({ useClientTTS: true });
}
