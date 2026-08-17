/**
 * Relai unique vers le backend Express.
 *
 * Les huit routes de app/api/ faisaient toutes le même geste avec des valeurs
 * différentes : deux replis d'URL (127.0.0.1 et localhost), quatre timeouts
 * (15 s, 10 s, 60 s, aucun) et trois formes d'erreur. Tout est défini ici.
 */
import { NextRequest, NextResponse } from 'next/server';
import { API_ERRORS } from '@/lib/messages';

/** 30 s couvre le réveil d'un service Render endormi (~30 s à froid). */
const DEFAULT_TIMEOUT = 30_000;

export function backendUrl(): string {
  return process.env.BACKEND_URL || 'http://127.0.0.1:3001';
}

/** IP et user-agent réels du visiteur, jamais ceux du corps de requête. */
export function clientInfo(request: NextRequest) {
  const h = request.headers;
  const userIp = h.get('x-forwarded-for')?.split(',')[0].trim() ?? h.get('x-real-ip') ?? 'unknown';
  return { userIp, userAgent: h.get('user-agent') ?? '' };
}

type ForwardInit = { method?: string; body?: unknown; timeout?: number };

/** Appel brut. Lève si le backend est injoignable. */
export async function forward(path: string, init: ForwardInit = {}): Promise<Response> {
  return fetch(`${backendUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    signal: AbortSignal.timeout(init.timeout ?? DEFAULT_TIMEOUT),
  });
}

/** Détail d'erreur masqué en production. */
function withDetails(error: unknown) {
  if (process.env.NODE_ENV === 'production') return {};
  return { details: error instanceof Error ? error.message : String(error) };
}

/**
 * Relai JSON : transmet le statut et le corps du backend tels quels,
 * bascule sur le texte brut si la réponse n'est pas du JSON.
 */
export async function proxyJson(path: string, init: ForwardInit = {}): Promise<NextResponse> {
  let response: Response;
  try {
    response = await forward(path, init);
  } catch (error) {
    console.error(`[proxy] ${path} injoignable:`, error);
    return NextResponse.json(
      { error: API_ERRORS.backendUnreachable, ...withDetails(error) },
      { status: 503 },
    );
  }

  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  if (!isJson) {
    const text = await response.text();
    return NextResponse.json({ error: text }, { status: response.status });
  }
  return NextResponse.json(await response.json(), { status: response.status });
}
