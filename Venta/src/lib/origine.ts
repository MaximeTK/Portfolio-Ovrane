/** Garde des mutations : seul le site lui-même écrit, contre le CSRF */
const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Vrai pour une lecture, ou une mutation que le navigateur dit venir d'ici */
export function requeteDuSite(methode: string, entetes: Pick<Headers, 'get'>, origine: string): boolean {
  if (!MUTATIONS.has(methode.toUpperCase())) return true;
  const site = entetes.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const venue = entetes.get('origin');
  return !venue || venue === origine;
}

/** Origine vue du navigateur : derrière un proxy, Next se croit local */
export const origineDuSite = ({ nextUrl, headers }: { nextUrl: Pick<URL, 'protocol' | 'host'>; headers: Pick<Headers, 'get'> }) =>
  `${nextUrl.protocol}//${headers.get('host') ?? nextUrl.host}`;

/** Corps JSON annoncé : un formulaire HTML ne sait pas l'envoyer */
export const corpsJson = (entetes: Pick<Headers, 'get'>) => /^application\/json(;|$)/i.test(entetes.get('content-type')?.trim() ?? '');
