import { NextRequest } from 'next/server';
import { relayerIllusion } from '@/lib/proxy';

// Pages d'Illusion : tout chemin sous /api/illusion/app/ part au backend, qui vérifie la session et relaie à Illusion
async function relayer(request: NextRequest, { params }: { params: Promise<{ chemin: string[] }> }) {
  const chemin = (await params).chemin.map(encodeURIComponent).join('/');
  return relayerIllusion(request, `/api/illusion/app/${chemin}${request.nextUrl.search}`);
}

export { relayer as GET, relayer as POST, relayer as PUT, relayer as PATCH, relayer as DELETE };
