import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { JETON_COOKIE, REDIRECT_TARGETS, parseRedirectPath } from '@/lib/redirections';

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const url = request.nextUrl;
  const path = url.pathname.toLowerCase();

  // Mots-clés redirectcvdesign, redirectcv, redirectlinkedin, redirectgithub, redirectportfolio, avec jeton éventuel
  const link = parseRedirectPath(path);

  // Autres cas: continuer normalement
  if (!link) return NextResponse.next();

  // PDF de public/assets/, profils externes ou accueil du portfolio ; avec un jeton, le CV envoyé avec la candidature
  const cvEnvoye = (link.cible === 'cv' || link.cible === 'cvdesign') && link.jeton;
  const target = cvEnvoye ? `/api/illusion/cv/${link.jeton}` : REDIRECT_TARGETS[link.cible];
  trackAndRedirect(request, event, path, target, link.cible, link.jeton);
  const response = NextResponse.redirect(new URL(target, request.url));

  // Le jeton suit la session : la route de chat et l'accueil le relisent côté serveur
  if (link.cible === 'portfolio' && link.jeton) {
    response.cookies.set(JETON_COOKIE, link.jeton, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
    });
  }
  return response;
}

/**
 * Helper pour envoyer le tracking au backend sans bloquer la réponse
 */
function trackAndRedirect(
  request: NextRequest,
  event: NextFetchEvent,
  path: string,
  target: string,
  cible: string,
  jeton: string | null,
) {
  // URL du backend pour le logging
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  
  const trackRequest = fetch(`${backendUrl}/api/tracking/redirect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: path,
      target: target,
      cible: cible,
      jeton: jeton,
      userAgent: request.headers.get('user-agent') || 'unknown',
    }),
  }).catch(err => console.error('Tracking error:', err));

  event.waitUntil(trackRequest);
}

// Configuration du matcher pour ne pas exécuter le middleware sur les fichiers statiques, images, etc.
// sauf si le chemin contient notre mot clé.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (nos assets publics)
     * 
     * MAIS on veut quand même matcher nos patterns de redirection.
     * La regex ci-dessous exclut les dossiers techniques mais laisse passer le reste.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets).*)',
  ],
};

