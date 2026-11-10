// Appels JSON du navigateur vers le relais ; chacun garde sa gestion d'erreur
export const posterJson = (chemin: string, corps: unknown = {}, init?: Pick<RequestInit, 'signal'>) =>
  fetch(chemin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps), ...init });

export const lireJson = <T,>(chemin: string, init?: Pick<RequestInit, 'signal'>): Promise<T | null> =>
  fetch(chemin, init).then((res) => (res.ok ? (res.json() as Promise<T>) : null));
