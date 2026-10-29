// Client des pages d'Illusion : tout passe par le site (/api/illusion/app), qui vérifie la session et relaie à Illusion
import { INDISPONIBLE } from '@/lib/messages';

export type Compte = { email: string; admin: boolean; pseudo?: string };

export class ErreurIllusion extends Error {
  statut: number;
  // Le détail d'un refus qui en dit plus que son message (les champs d'un profil incomplet)
  donnees?: unknown;
  constructor(message: string, statut: number, donnees?: unknown) {
    super(message);
    this.name = 'ErreurIllusion';
    this.statut = statut;
    this.donnees = donnees;
  }
}

export type Methode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const RACINE = '/api/illusion/app';

/** L'erreur lisible d'une réponse refusée : `detail` d'Illusion (texte, liste de Pydantic ou objet), sinon `error` du site. */
export async function lireErreur(reponse: Response): Promise<ErreurIllusion> {
  const corps = await reponse.json().catch(() => null);
  const detail = corps?.detail ?? corps?.error;
  const message = typeof detail === 'string' && detail ? detail
    : Array.isArray(detail) ? detail.map((e) => [(e?.loc ?? []).filter((l: unknown) => l !== 'body').join('.'), e?.msg].filter(Boolean).join(' : ')).join(' ; ')
    : detail?.message || `Erreur ${reponse.status}`;
  return new ErreurIllusion(message, reponse.status, detail && typeof detail === 'object' ? detail : undefined);
}

async function demander(chemin: string, init: RequestInit): Promise<Response> {
  let reponse: Response;
  try {
    reponse = await fetch(`${RACINE}${chemin.startsWith('/') ? '' : '/'}${chemin}`, { credentials: 'same-origin', cache: 'no-store', ...init });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ErreurIllusion(INDISPONIBLE, 0);
  }
  if (!reponse.ok) throw await lireErreur(reponse);
  return reponse;
}

export async function appeler<T = unknown>(chemin: string, init: { methode?: Methode; corps?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const reponse = await demander(chemin, {
    method: init.methode ?? 'GET',
    signal: init.signal,
    ...(init.corps === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.corps) }),
  });
  return (reponse.headers.get('content-type')?.includes('json') ? reponse.json() : reponse.text()) as Promise<T>;
}

/** Le fichier lu en base64, comme l'ancien dashboard : Illusion en vérifie le nom, l'encodage et le poids. */
export function televerser(fichier: File): Promise<{ nom: string; contenu: string }> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre({ nom: fichier.name, contenu: String(lecteur.result).split(',')[1] ?? '' });
    lecteur.onerror = () => rejeter(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}

/** Télécharge ce que sert le chemin, sous le nom que donne Illusion ; un refus devient une ErreurIllusion, jamais un fichier. */
export async function telecharger(chemin: string): Promise<void> {
  const reponse = await demander(chemin, { method: 'GET' });
  const disposition = reponse.headers.get('content-disposition') ?? '';
  const encode = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(disposition)?.[1];
  const nom = encode ? decodeURIComponent(encode.trim())
    : /filename\s*=\s*"?([^";]+)"?/i.exec(disposition)?.[1] ?? chemin.split('?')[0].split('/').pop() ?? 'fichier';
  const adresse = URL.createObjectURL(await reponse.blob());
  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  // Le navigateur a pris le fichier au clic : l'adresse provisoire se libère ensuite
  setTimeout(() => URL.revokeObjectURL(adresse), 10_000);
}

export async function lireCompte(): Promise<Compte | null> {
  try {
    const { email, serveur, pseudo } = await appeler<{ email: string; serveur: boolean; pseudo: string }>('/session');
    return { email, admin: serveur, ...(pseudo ? { pseudo } : {}) };
  } catch (error) {
    if (error instanceof ErreurIllusion && error.statut === 401) return null;
    throw error;
  }
}
