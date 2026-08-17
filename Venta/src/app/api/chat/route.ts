import { NextRequest, NextResponse } from 'next/server';
import { proxyJson, clientInfo } from '@/lib/api/proxy';
import { API_ERRORS } from '@/lib/messages';

export async function POST(request: NextRequest) {
  const { prompt, currentUserId, isEphemeral, currentUrl } = await request.json();
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: API_ERRORS.promptRequired }, { status: 400 });
  }
  // 60 s : l'appel modèle avec boucle d'outils peut être long.
  return proxyJson('/api/chat', {
    method: 'POST',
    timeout: 60_000,
    body: { prompt, currentUserId, isEphemeral, currentUrl, ...clientInfo(request) },
  });
}
