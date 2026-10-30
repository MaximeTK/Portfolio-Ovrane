import { NextRequest, NextResponse } from 'next/server';
import { forward, sessionJeton } from '@/lib/proxy';
import { INDISPONIBLE } from '@/lib/messages';
import { corpsJson } from '@/lib/origine';

/** Réponse du chat en flux (texte, voix, réponse complète) ; le jeton du recruteur vient du cookie, jamais du corps. */
export async function POST(request: NextRequest) {
  if (!corpsJson(request.headers)) return NextResponse.json({ error: 'Requête invalide' }, { status: 415 });
  const body = await request.json().catch(() => ({}));
  try {
    // Deux minutes : la voix d'une longue réponse se synthétise encore après le dernier mot
    const response = await forward(request, '/api/chat/flux', { method: 'POST', body: { ...body, jeton: sessionJeton(request) }, timeout: 120_000 });
    if (response?.ok && response.body && response.headers.get('content-type')?.startsWith('text/event-stream')) {
      return new NextResponse(response.body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' } });
    }
    if (response) return NextResponse.json(await response.json().catch(() => ({ error: INDISPONIBLE })), { status: response.status });
  } catch (error) {
    console.error('[relai] /api/chat/flux :', error);
  }
  return NextResponse.json({ error: INDISPONIBLE }, { status: 503 });
}
