import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { forward } from '@/lib/proxy';
import { JETON_COOKIE, REDIRECT_TARGETS, parseRedirectPath } from '@/lib/redirections';
import { origineDuSite, requeteDuSite, optionsCookie } from '@/lib/origine';

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const url = request.nextUrl;
  const path = url.pathname.toLowerCase();

  // Aucune mutation que du site lui-même, même par un chemin d'API encodé
  if (!requeteDuSite(request.method, request.headers, origineDuSite(request))) {
    return NextResponse.json({ error: 'Requête refusée' }, { status: 403 });
  }
  if (path.startsWith('/api/')) return NextResponse.next();

  // Mots-clés redirect (cv, cvdesign, linkedin, github, portfolio) avec jeton
  const link = parseRedirectPath(path);
  if (!link) return NextResponse.next();

  // PDF, profil externe ou accueil ; avec jeton, le CV de la candidature
  const cvEnvoye = (link.cible === 'cv' || link.cible === 'cvdesign') && link.jeton;
  const target = cvEnvoye ? `/api/illusion/cv/${link.jeton}` : REDIRECT_TARGETS[link.cible];

  // Suivi envoyé au backend sans retarder la redirection
  const suivi = forward(request, '/api/tracking/redirect', {
    method: 'POST',
    body: { path, target, cible: link.cible, jeton: link.jeton, userAgent: request.headers.get('user-agent') || 'unknown' },
  }).catch((err) => console.error('[suivi] redirection :', err));
  event.waitUntil(suivi);

  const response = NextResponse.redirect(new URL(target, request.url));
  // Le jeton suit la session : le chat et l'accueil le relisent côté serveur
  if (link.cible === 'portfolio' && link.jeton) {
    response.cookies.set(JETON_COOKIE, link.jeton, optionsCookie(url));
  }
  return response;
}

// API sauf relais d'Illusion, qui garde seul son corps, et pages hors statiques
export const config = {
  matcher: ['/api/:path((?!illusion/app/).*)', '/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
};
