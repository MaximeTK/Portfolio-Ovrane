import { NextRequest } from 'next/server';
import { proxyJson } from '@/lib/api/proxy';

// Profil visiteur créé, ou repris, sans saisie à l'arrivée.
export async function POST(request: NextRequest) {
  return proxyJson('/api/auth/visitor', { method: 'POST', body: await request.json() });
}
