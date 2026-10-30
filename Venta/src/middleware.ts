import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { forward } from '@/lib/proxy';
import { JETON_COOKIE, REDIRECT_TARGETS, parseRedirectPath } from '@/lib/redirections';
import { requeteDuSite } from '@/lib/origine';

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const url = request.nextUrl;
  const path = url.pathname.toLowerCase();

  // L'API n'accepte de mutation que du site lui-même
  if (path.startsWith('/api/')) {
    return requeteDuSite(request.method, request.headers, url.origin)
      ? NextResponse.next()
      : NextResponse.json({ error: 'Requête refusée' }, { status: 403 });
  }

  // Mots-clés redirectcvdesign, redirectcv, redirectlinkedin, redirectgithub, redirectportfolio, avec jeton éventuel
  const link = parseRedirectPath(path);
  if (!link) return NextResponse.next();

  // PDF de public/assets/, profils externes ou accueil du portfolio ; avec un jeton, le CV envoyé avec la candidature
  const cvEnvoye = (link.cible === 'cv' || link.cible === 'cvdesign') && link.jeton;
  const target = cvEnvoye ? `/api/illusion/cv/${link.jeton}` : REDIRECT_TARGETS[link.cible];

  // Suivi envoyé au backend sans retarder la redirection
  const suivi = forward(request, '/api/tracking/redirect', {
    method: 'POST',
    body: { path, target, cible: link.cible, jeton: link.jeton, userAgent: request.headers.get('user-agent') || 'unknown' },
  }).catch((err) => console.error('[suivi] redirection :', err));
  event.waitUntil(suivi);

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

// Les routes d'API pour leur garde, et les pages, où vivent les liens suivis ; ni les fichiers statiques, ni les images
export const config = {
  matcher: ['/api/:path*', '/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
};
