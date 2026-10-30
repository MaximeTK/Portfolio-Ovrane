/**
 * Garde des mutations de l'API : seul le site lui-même écrit. Un formulaire posté depuis un autre site ne connecte pas
 * le navigateur à un autre compte (CSRF de connexion), et n'agit sur aucune page d'Illusion.
 */
const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Vrai pour une lecture, ou une mutation que le navigateur dit venir de ce site (sans ces en-têtes : un client hors navigateur). */
export function requeteDuSite(methode: string, entetes: Pick<Headers, 'get'>, origine: string): boolean {
  if (!MUTATIONS.has(methode.toUpperCase())) return true;
  const site = entetes.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const venue = entetes.get('origin');
  return !venue || venue === origine;
}

/** Corps JSON annoncé : un formulaire HTML ne sait envoyer ni ce type, ni le corps qu'un relais JSON lit. */
export const corpsJson = (entetes: Pick<Headers, 'get'>) => /^application\/json(;|$)/i.test(entetes.get('content-type')?.trim() ?? '');
