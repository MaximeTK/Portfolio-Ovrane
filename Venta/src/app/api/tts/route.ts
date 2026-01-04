import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // On relaie la requête au backend Node.js
    const response = await fetch(`${BACKEND_URL}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Si le backend échoue, on renvoie une instruction de fallback client
      return NextResponse.json({ useClientTTS: true, text: body.text }, { status: 200 });
    }

    // Si le backend renvoie du JSON (cas d'erreur gérée ou fallback)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // Sinon, on stream l'audio reçu
    const arrayBuffer = await response.arrayBuffer();
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
        'X-TTS-Provider': response.headers.get('X-TTS-Provider') || 'backend-proxy',
      },
    });

  } catch (error) {
    console.error('[TTS Proxy] Erreur:', error);
    return NextResponse.json({ useClientTTS: true, text: '' }, { status: 200 });
  }
}
