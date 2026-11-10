import { NextRequest, NextResponse } from 'next/server';
import { relayerJson } from '@/lib/proxy';
import { corpsJson, corpsTropGrand } from '@/lib/origine';

// Liste blanche (méthode, chemin) des routes relayées telles quelles
const ROUTES = new Set([
  'POST auth/visitor',
  'POST auth/login',
  'POST auth/register',
  'POST auth/logout',
  'GET auth/compte',
  'POST auth/oubli',
  'POST auth/reinitialiser',
  'POST auth/verification',
  'POST auth/verifier',
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
    if (!corpsJson(request.headers)) return NextResponse.json({ error: 'Requête invalide' }, { status: 415 });
    if (corpsTropGrand(request.headers)) return NextResponse.json({ error: 'Requête trop grande' }, { status: 413 });
    body = await request.json().catch(() => ({}));
  }
  return relayerJson(request, `/api/${chemin}${request.nextUrl.search}`, {
    method: request.method,
    body,
  });
}

export { relayer as GET, relayer as POST };
