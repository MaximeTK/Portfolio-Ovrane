// Le compte de la session, côté serveur, par la même chaîne que le navigateur ; null sans session
import 'server-only';
import { cookies, headers } from 'next/headers';
import { INDISPONIBLE } from '@/lib/messages';
import { forward } from '@/lib/proxy';
import { ErreurIllusion, lireErreur, type Compte } from './api';

export async function compteDepuisCookies(): Promise<Compte | null> {
  const reponse = await forward({ headers: await headers(), cookies: await cookies() }, '/api/illusion/app/session').catch(() => null);
  if (reponse?.status === 401) return null;
  if (!reponse) throw new ErreurIllusion(INDISPONIBLE, 503);
  if (!reponse.ok) throw await lireErreur(reponse);
  const { email, serveur, pseudo } = await reponse.json();
  return { email, admin: Boolean(serveur), ...(pseudo ? { pseudo } : {}) };
}
