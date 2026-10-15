import { NextRequest, NextResponse } from 'next/server';
import { relayerJson, sessionJeton } from '@/lib/proxy';

// Accueil public de la candidature liée au jeton de session : entreprise, poste, langue.
export async function GET(request: NextRequest) {
  const jeton = sessionJeton(request);
  if (!jeton) {
    return NextResponse.json({ error: 'Aucun jeton de candidature' }, { status: 404 });
  }
  return relayerJson(request, `/api/illusion/accueil?jeton=${jeton}`);
}
