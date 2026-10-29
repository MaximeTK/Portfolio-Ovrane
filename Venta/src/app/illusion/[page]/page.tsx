import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { Compte } from '@/features/illusion/api';
import { REGISTRE } from '@/features/illusion/pages/registre';
import { estAdmin, titreDe } from '@/features/illusion/pages/liste';
import { compteDeLaSession } from '../compte';

type Parametres = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Parametres): Promise<Metadata> {
  const { page } = await params;
  return { title: `${titreDe(page)} · Illusion` };
}

export default async function PageIllusion({ params }: Parametres) {
  const { page } = await params;
  let compte: Compte | null;
  try {
    compte = await compteDeLaSession();
  } catch {
    // La mise en page dit déjà qu'Ovrane ne répond pas
    return null;
  }
  if (!compte) redirect('/connexion');
  // Slug inconnu, ou page d'administration pour un compte qui ne l'est pas : la page n'existe pas
  if (!Object.hasOwn(REGISTRE, page) || (estAdmin(page) && !compte.admin)) notFound();
  const Composant = REGISTRE[page];
  return <Composant compte={compte} />;
}
