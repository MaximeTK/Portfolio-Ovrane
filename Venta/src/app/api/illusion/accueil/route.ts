import { NextRequest, NextResponse } from 'next/server';
import { proxyJson, sessionJeton } from '@/lib/api/proxy';
import { API_ERRORS } from '@/lib/messages';

// Accueil public de la candidature liée au jeton de session : entreprise, poste, langue.
export async function GET(request: NextRequest) {
  const jeton = sessionJeton(request);
  if (!jeton) {
    return NextResponse.json({ error: API_ERRORS.jetonMissing }, { status: 404 });
  }
  return proxyJson(`/api/illusion/accueil/${jeton}`);
}
