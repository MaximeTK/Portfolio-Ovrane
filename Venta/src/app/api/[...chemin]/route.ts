import { NextRequest, NextResponse } from 'next/server';
import { relayerJson, sessionJeton } from '@/lib/proxy';

// Liste blanche « méthode chemin » des routes relayées telles quelles au backend
const ROUTES = new Set([
  'POST auth/visitor',
  'POST auth/login',
  'POST auth/register',
  'POST auth/logout',
  'POST chat',
  'GET chat/history',
  'GET preferences',
  'POST preferences',
  'POST tracking/visit',
]);

async function relayer(request: NextRequest, { params }: { params: Promise<{ chemin: string[] }> }) {
  const chemin = (await params).chemin.join('/');
  if (!ROUTES.has(`${request.method} ${chemin}`)) {
    return NextResponse.json({ error: 'Route inconnue' }, { status: 404 });
  }
  let body: Record<string, unknown> | undefined;
  if (request.method === 'POST') {
    body = await request.json().catch(() => ({}));
    // Le jeton du recruteur vient du cookie posé par le middleware, jamais du corps
    if (chemin === 'chat') body = { ...body, jeton: sessionJeton(request) };
  }
  return relayerJson(request, `/api/${chemin}${request.nextUrl.search}`, {
    method: request.method,
    body,
    // L'appel au modèle avec sa boucle d'outils peut être long
    timeout: chemin === 'chat' ? 60_000 : undefined,
  });
}

export { relayer as GET, relayer as POST };
