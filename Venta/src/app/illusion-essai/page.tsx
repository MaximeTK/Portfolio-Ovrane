import { notFound } from 'next/navigation';
import type { Compte } from '@/features/illusion/api';
import type { Matiere } from '@/features/illusion/apparence';
import { RacineIllusion } from '@/features/illusion/ossature/RacineIllusion';
import { estAdmin } from '@/features/illusion/pages/liste';
import { REGISTRE } from '@/features/illusion/pages/registre';
import { REGISTRE_ADMIN } from '@/features/illusion/pages/registre-admin';
import { Planche, ReglerMatiere } from './Planche';

export const metadata = { title: "Banc d'essai · Illusion" };

const PAGES = { ...REGISTRE, ...REGISTRE_ADMIN };

type Recherche = { searchParams: Promise<{ page?: string; admin?: string; matiere?: string; palette?: string }> };

// Banc d'essai sans connexion ni relais, jamais en production
export default async function BancIllusion({ searchParams }: Recherche) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { page, admin, matiere, palette = 'ecarlate' } = await searchParams;
  const compte: Compte = { email: 'essai@exemple.fr', pseudo: 'Essai', admin: admin !== '0' };
  if (page && (!Object.hasOwn(PAGES, page) || (estAdmin(page) && !compte.admin))) notFound();
  const Composant = page ? PAGES[page] : null;
  return (
    <RacineIllusion compte={compte} page={page ?? 'candidatures'} palette={palette}>
      <ReglerMatiere matiere={matiere === 'verre' || matiere === 'teinte' ? (matiere as Matiere) : undefined} />
      {Composant ? <Composant compte={compte} /> : <Planche />}
    </RacineIllusion>
  );
}
