import { NextRequest, NextResponse } from 'next/server';
import { origineDuSite, requeteDuSite } from '@/lib/origine';
import { relayerIllusion } from '@/lib/proxy';

// Pages d'Illusion : le backend vérifie la session et relaie à Illusion
async function relayer(request: NextRequest, { params }: { params: Promise<{ chemin: string[] }> }) {
  // Hors du middleware, qui tronquerait à 10 Mo : même garde des mutations
  if (!requeteDuSite(request.method, request.headers, origineDuSite(request))) {
    return NextResponse.json({ error: 'Requête refusée' }, { status: 403 });
  }
  const chemin = (await params).chemin.map(encodeURIComponent).join('/');
  return relayerIllusion(request, `/api/illusion/app/${chemin}${request.nextUrl.search}`);
}

export { relayer as GET, relayer as POST, relayer as PUT, relayer as PATCH, relayer as DELETE };
