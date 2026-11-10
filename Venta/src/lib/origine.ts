/** Garde des mutations : seul le site lui-même écrit, contre le CSRF */
const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Vrai pour une lecture, ou une mutation que le navigateur dit venir d'ici */
export function requeteDuSite(methode: string, entetes: Pick<Headers, 'get'>, origine: string): boolean {
  if (!MUTATIONS.has(methode.toUpperCase())) return true;
  const site = entetes.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  // Origin exigé : tout navigateur actuel l'envoie avec une mutation
  return entetes.get('origin') === origine;
}

/** Origine vue du navigateur : derrière un proxy, Next se croit local */
export const origineDuSite = ({ nextUrl, headers }: { nextUrl: Pick<URL, 'protocol' | 'host'>; headers: Pick<Headers, 'get'> }) =>
  `${nextUrl.protocol}//${headers.get('host') ?? nextUrl.host}`;

/** Cookie du site : illisible par les scripts, valable partout */
export const optionsCookie = (url: Pick<URL, 'protocol'>, expires?: Date) => ({
  httpOnly: true,
  // En production, même si le proxy tait le protocole : https seul
  secure: process.env.NODE_ENV === 'production' || url.protocol === 'https:',
  sameSite: 'lax' as const,
  path: '/',
  ...(expires ? { expires } : {}),
});

/** Corps JSON annoncé : un formulaire HTML ne sait pas l'envoyer */
export const corpsJson = (entetes: Pick<Headers, 'get'>) => /^application\/json(;|$)/i.test(entetes.get('content-type')?.trim() ?? '');

/** Corps annoncé au-delà de 100 Ko, que le backend refuserait */
export const corpsTropGrand = (entetes: Pick<Headers, 'get'>) => Number(entetes.get('content-length') ?? 0) > 100 * 1024;
