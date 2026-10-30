/**
 * Relai vers le backend : seul ce module connaît son adresse et le secret de service.
 * Le navigateur ne parle qu'aux routes Next /api/*.
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { INDISPONIBLE } from '@/lib/messages';
import { JETON_COOKIE, isValidJeton } from '@/lib/redirections';

const SESSION_COOKIE = 'ovrane_session';

// En production, le secret de service et les sessions ne partent qu'en https, sauf vers la machine elle-même ; vide sinon
function backendUrl(): string {
  const url = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
  if (process.env.NODE_ENV !== 'production' || /^https:\/\//i.test(url) || /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(url)) return url;
  console.error('[relai] BACKEND_URL refusé : en production, le backend se joint en https');
  return '';
}

// Une route relaie sa requête, une page serveur ses en-têtes et ses cookies (next/headers) : les deux suffisent
type Source = Pick<NextRequest, 'headers'> & { cookies: { get(nom: string): { value: string } | undefined } };

// Seuls ces en-têtes d'une réponse d'Illusion reviennent au navigateur ; sa CSP isole le HTML d'un mail reçu
const RENDUS_ILLUSION = ['content-type', 'content-disposition', 'content-length', 'content-security-policy'];

/** En-têtes de tout appel au backend ; null en production sans SERVICE_SECRET. */
function enTetes(request: Source): Record<string, string> | null {
  const secret = process.env.SERVICE_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-ovrane-service');
  if (!secret) return null;
  const h = request.headers;
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip');
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  return {
    'Content-Type': 'application/json',
    'User-Agent': h.get('user-agent') ?? '',
    'X-Ovrane-Service': secret,
    ...(ip ? { 'X-Ovrane-Client-Ip': ip } : {}),
    ...(session ? { 'X-Ovrane-Session': session } : {}),
  };
}

/** Jeton Illusion de la session, posé en cookie par le middleware, jamais lu du corps. */
export function sessionJeton(request: NextRequest): string | undefined {
  const jeton = request.cookies.get(JETON_COOKIE)?.value;
  return isValidJeton(jeton) ? jeton : undefined;
}

type ForwardInit = { method?: string; body?: unknown; timeout?: number };

/** Appel brut : null sans secret en production, exception si le backend est injoignable. */
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

/** Relai des pages d'Illusion : méthode, corps brut et son type tels quels, réponse en flux (téléversements et téléchargements compris). */
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
        // Au-delà des 120 s du backend vers Illusion : c'est lui qui répond le premier ; un navigateur parti coupe la chaîne
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(130_000)]),
      } as RequestInit);
      const rendus = new Headers({ 'Cache-Control': 'no-store' });
      for (const nom of RENDUS_ILLUSION) {
        const valeur = response.headers.get(nom);
        if (valeur) rendus.set(nom, valeur);
      }
      return new Response(response.body, { status: response.status, headers: rendus });
    } catch (error) {
      console.error(`[relai] ${path} injoignable :`, error);
    }
  }
  return NextResponse.json({ error: INDISPONIBLE }, { status: 503 });
}

/**
 * Relai JSON : statut et corps du backend, sauf `session`, qui devient le cookie httpOnly
 * de session ; `deconnexion: true` efface ce cookie.
 */
export async function relayerJson(request: NextRequest, path: string, init: ForwardInit = {}): Promise<NextResponse> {
  let response: Response | null = null;
  try {
    response = await forward(request, path, init);
  } catch (error) {
    console.error(`[relai] ${path} injoignable :`, error);
  }
  const data: Record<string, unknown> | null = response ? await response.json().catch(() => null) : null;
  if (!response || !data) return NextResponse.json({ error: INDISPONIBLE }, { status: response ? 502 : 503 });

  const { session, ...corps } = data;
  const relaye = NextResponse.json(corps, { status: response.status });
  const { jeton, expireLe } = (session ?? {}) as { jeton?: string; expireLe?: string };
  if (jeton) {
    relaye.cookies.set(SESSION_COOKIE, jeton, {
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      ...(expireLe ? { expires: new Date(expireLe) } : {}),
    });
  }
  if (corps.deconnexion === true) relaye.cookies.delete(SESSION_COOKIE);
  return relaye;
}
