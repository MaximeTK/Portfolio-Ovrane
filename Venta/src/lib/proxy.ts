/**
 * Relai vers le backend : seul ce module connaît son adresse et le secret de service.
 * Le navigateur ne parle qu'aux routes Next /api/*.
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { INDISPONIBLE } from '@/lib/messages';
import { JETON_COOKIE, isValidJeton } from '@/lib/redirections';

const SESSION_COOKIE = 'ovrane_session';

function backendUrl(): string {
  return process.env.BACKEND_URL || 'http://127.0.0.1:3001';
}

/** En-têtes de tout appel au backend ; null en production sans SERVICE_SECRET. */
function enTetes(request: NextRequest): Record<string, string> | null {
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
export async function forward(request: NextRequest, path: string, init: ForwardInit = {}): Promise<Response | null> {
  const headers = enTetes(request);
  if (!headers) return null;
  return fetch(`${backendUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    // 30 s couvrent le réveil d'un service Render endormi
    signal: AbortSignal.timeout(init.timeout ?? 30_000),
  });
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
