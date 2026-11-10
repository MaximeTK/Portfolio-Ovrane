/** Relai vers le backend : seul ce module connaît son adresse et le secret */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { INDISPONIBLE } from '@/lib/messages';
import { JETON_COOKIE, isValidJeton } from '@/lib/redirections';
import { optionsCookie } from './origine';

const SESSION_COOKIE = 'ovrane_session';
// Marque d'appareil déjà connecté : un tiers ne bloque pas le titulaire
const APPAREIL_COOKIE = 'ovrane_appareil';

// En production, secret et sessions ne partent qu'en https, sauf en local
function backendUrl(): string {
  const url = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
  if (process.env.NODE_ENV !== 'production' || /^https:\/\//i.test(url) || /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(url)) return url;
  console.error('[relai] BACKEND_URL refusé : en production, le backend se joint en https');
  return '';
}

// Une route relaie sa requête, une page serveur ses en-têtes et cookies
type Source = Pick<NextRequest, 'headers'> & { cookies: { get(nom: string): { value: string } | undefined } };

// Seuls ces en-têtes d'Illusion reviennent ; sa CSP isole ses documents
const RENDUS_ILLUSION = ['content-type', 'content-disposition', 'content-length', 'content-security-policy'];

/** En-têtes des appels au backend ; null en production sans SERVICE_SECRET */
function enTetes(request: Source): Record<string, string> | null {
  const secret = process.env.SERVICE_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-ovrane-service');
  if (!secret) return null;
  const h = request.headers;
  // Dernière adresse, posée par Traefik : Next ne doit être joint que par lui
  const ip = h.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const appareil = request.cookies.get(APPAREIL_COOKIE)?.value;
  return {
    'Content-Type': 'application/json',
    'User-Agent': h.get('user-agent') ?? '',
    'X-Ovrane-Service': secret,
    ...(ip ? { 'X-Ovrane-Client-Ip': ip } : {}),
    ...(session ? { 'X-Ovrane-Session': session } : {}),
    ...(appareil ? { 'X-Ovrane-Appareil': appareil } : {}),
  };
}

/** Jeton Illusion de la session, cookie posé par le middleware */
export function sessionJeton(request: NextRequest): string | undefined {
  const jeton = request.cookies.get(JETON_COOKIE)?.value;
  return isValidJeton(jeton) ? jeton : undefined;
}

type ForwardInit = { method?: string; body?: unknown; timeout?: number };

/** Appel brut : null sans secret en production, exception si injoignable */
export async function forward(request: Source, path: string, init: ForwardInit = {}): Promise<Response | null> {
  const headers = enTetes(request);
  const base = backendUrl();
  if (!headers || !base) return null;
  return fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    // 30 s couvrent le réveil d'un service Render endormi
    signal: AbortSignal.timeout(init.timeout ?? 30_000),
  });
}

/** Relai des pages d'Illusion : corps et type tels quels, réponse en flux */
export async function relayerIllusion(request: NextRequest, path: string): Promise<Response> {
  const headers = enTetes(request);
  const base = backendUrl();
  if (headers && base) {
    const type = request.headers.get('content-type');
    if (type) headers['Content-Type'] = type;
    else delete headers['Content-Type'];
    try {
      const response = await fetch(`${base}${path}`, {
        method: request.method,
        headers,
        body: request.body,
        // Node exige ce mode pour envoyer un corps en flux sans le lire d'abord
        duplex: 'half',
        // Au-delà des 120 s du backend vers Illusion, qui répond le premier
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(130_000)]),
      } as RequestInit);
      const rendus = new Headers({ 'Cache-Control': 'no-store' });
      for (const nom of RENDUS_ILLUSION) {
        const valeur = response.headers.get(nom);
        if (valeur) rendus.set(nom, valeur);
      }
      // Document actif sans CSP de l'amont : isolé, jamais exécuté chez le site
      if (!rendus.has('content-security-policy') && /html|xml|xsl/i.test(rendus.get('content-type') ?? '')) {
        rendus.set('Content-Security-Policy', "sandbox; default-src 'none'");
      }
      return new Response(response.body, { status: response.status, headers: rendus });
    } catch (error) {
      console.error(`[relai] ${path} injoignable :`, error);
    }
  }
  return NextResponse.json({ error: INDISPONIBLE }, { status: 503 });
}

/** Relai JSON : session et appareil deviennent des cookies httpOnly */
export async function relayerJson(request: NextRequest, path: string, init: ForwardInit = {}): Promise<NextResponse> {
  let response: Response | null = null;
  try {
    response = await forward(request, path, init);
  } catch (error) {
    console.error(`[relai] ${path} injoignable :`, error);
  }
  const data: Record<string, unknown> | null = response ? await response.json().catch(() => null) : null;
  if (!response || !data) return NextResponse.json({ error: INDISPONIBLE }, { status: response ? 502 : 503 });

  const { session, appareil, ...corps } = data;
  const relaye = NextResponse.json(corps, { status: response.status });
  // Compte, historique, préférences : aucun cache ne les garde
  relaye.headers.set('Cache-Control', 'no-store');
  // Cookies httpOnly pour la session et la marque d'appareil, hors de la page
  for (const [nom, cookie] of [[SESSION_COOKIE, session], [APPAREIL_COOKIE, appareil]] as const) {
    const { jeton, expireLe } = (cookie ?? {}) as { jeton?: string; expireLe?: string };
    if (!jeton) continue;
    relaye.cookies.set(nom, jeton, optionsCookie(request.nextUrl, expireLe ? new Date(expireLe) : undefined));
  }
  if (corps.deconnexion === true) relaye.cookies.delete(SESSION_COOKIE);
  return relaye;
}
