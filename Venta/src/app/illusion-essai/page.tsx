import { notFound } from 'next/navigation';
import type { Compte } from '@/features/illusion/api';
import type { Matiere } from '@/features/illusion/apparence';
import { RacineIllusion } from '@/features/illusion/ossature/RacineIllusion';
import { estAdmin } from '@/features/illusion/pages/liste';
import { REGISTRE } from '@/features/illusion/pages/registre';
import { Planche, ReglerMatiere } from './Planche';

export const metadata = { title: "Banc d'essai · Illusion" };

type Recherche = { searchParams: Promise<{ page?: string; admin?: string; matiere?: string; palette?: string }> };

// Banc d'essai sans connexion ni relais, jamais en production : ?page=<slug> montre une page du registre, sinon la planche du prototype ; ?admin=0, ?matiere=verre, ?palette=<id>
export default async function BancIllusion({ searchParams }: Recherche) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { page, admin, matiere, palette = 'ecarlate' } = await searchParams;
  const compte: Compte = { email: 'essai@exemple.fr', pseudo: 'Essai', admin: admin !== '0' };
  if (page && (!Object.hasOwn(REGISTRE, page) || (estAdmin(page) && !compte.admin))) notFound();
  const Composant = page ? REGISTRE[page] : null;
  // Les liens des canaux restent dans le banc et gardent ses réglages
  const garde = new URLSearchParams({ ...(admin && { admin }), ...(matiere && { matiere }), palette });
  return (
    <RacineIllusion compte={compte} base={`/illusion-essai?${garde}&page=`} page={page ?? 'candidatures'} palette={palette}>
      <ReglerMatiere matiere={matiere === 'verre' || matiere === 'teinte' ? (matiere as Matiere) : undefined} />
      {Composant ? <Composant compte={compte} /> : <Planche />}
    </RacineIllusion>
  );
}
