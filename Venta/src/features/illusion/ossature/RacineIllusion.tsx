'use client';

import '../styles/illusion.css';
import { useEffect } from 'react';
import { useBackgroundStore } from '@/features/fond/backgroundStore';
import { useApparence } from '../apparence';
import type { Compte } from '../api';
import { REGISTRE } from '../pages/registre';
import { poserCompte } from '../stockage';

type ProprietesRacine = {
  compte: Compte;
  // Page affichée : l'accueil a son allure, et chaque page entre comme une vue d'Ovrane
  page: string;
  // Palette imposée (banc d'essai), sinon celle choisie par l'utilisateur dans Ovrane
  palette?: string;
  children: React.ReactNode;
};

// Racine des écrans d'Illusion, sous l'en-tête du site : fond, matière, puis le dock de la page
export function RacineIllusion({ compte, page, palette, children }: ProprietesRacine) {
  const matiere = useApparence((s) => s.matiere);
  // Au rendu, avant les pages : leurs brouillons se lisent sous ce compte dès leur premier effet
  poserCompte(compte.email);

  useEffect(() => {
    if (palette) useBackgroundStore.getState().setBackground(palette);
    else useBackgroundStore.getState().loadPreference();
  }, [palette]);

  return (
    <div className={`ov mat-${matiere}${compte.admin ? ' admin' : ''}${page === 'accueil' ? ' vue-accueil' : ''}`}>
      <div className="fond" />
      <div className="place-entete" aria-hidden="true" />
      {/* Même entrée qu'une page d'Ovrane : fondu et montée de 12 px en 0,5 s */}
      <div key={page} className="scene apparition">
        {children}
      </div>
    </div>
  );
}

// Une page d'Illusion ouverte dans le site ; ce module ne se charge qu'à la première ouverture
export default function VueIllusion({ compte, page, recherche }: { compte: Compte; page: string; recherche: string }) {
  const Composant = REGISTRE[page];
  return (
    <RacineIllusion compte={compte} page={page}>
      <Composant compte={compte} recherche={recherche} />
    </RacineIllusion>
  );
}
