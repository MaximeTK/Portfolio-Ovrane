import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const url = request.nextUrl;
  const path = url.pathname.toLowerCase();

  // Debug (à voir dans les logs serveur Vercel/Local)
  // console.log(`Middleware checking path: ${path}`);

  // 1. Redirection CV (mot clé: redirectcv)
  if (path.includes('redirectcv')) {
    // Redirection vers le fichier PDF (doit être dans public/assets/)
    const target = '/assets/CV_Maxime_Thiong-kay_Imprimable.pdf';
    trackAndRedirect(request, event, path, target);
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (path.includes('redirectcvdesign')) {
    // Redirection vers le fichier PDF (doit être dans public/assets/)
    const target = '/assets/CV_Maxime_Thiong-kay.pdf';
    trackAndRedirect(request, event, path, target);
    return NextResponse.redirect(new URL(target, request.url));
  }

  // 2. Redirection LinkedIn (mot clé: redirectlinkedin)
  if (path.includes('redirectlinkedin')) {
    const target = 'https://www.linkedin.com/in/maxime-thiong-kay/';
    trackAndRedirect(request, event, path, target);
    return NextResponse.redirect(new URL(target, request.url)); // Redirection absolue
  }

  // Autres cas: continuer normalement
  return NextResponse.next();
}

/**
 * Helper pour envoyer le tracking au backend sans bloquer la réponse
 */
function trackAndRedirect(request: NextRequest, event: NextFetchEvent, path: string, target: string) {
  // URL du backend pour le logging
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  
  const trackRequest = fetch(`${backendUrl}/api/tracking/redirect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: path,
      target: target,
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

