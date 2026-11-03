'use client';

import { use } from 'react';
import type { Compte } from '../api';
import { PAGE_DEPART, chargerAdministration } from '../pages/liste';
import { REGISTRE } from '../pages/registre';
import { RacineIllusion } from './RacineIllusion';

// Une page d'Illusion ouverte dans le site, chargée à la première ouverture
export default function VueIllusion({ compte, page, recherche }: { compte: Compte; page: string; recherche: string }) {
  // Attendu avant de monter : l'ouverture trouve les fenêtres de la page
  const admin = compte.admin ? use(chargerAdministration()).REGISTRE_ADMIN : null;
  const Composant = REGISTRE[page] ?? admin?.[page] ?? REGISTRE[PAGE_DEPART];
  return (
    <RacineIllusion compte={compte} page={page}>
      <Composant compte={compte} recherche={recherche} />
    </RacineIllusion>
  );
}
