'use client';

import '../styles/illusion.css';
import { use, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBackgroundStore } from '@/features/fond/backgroundStore';
import { useApparence } from '../apparence';
import type { Compte } from '../api';
import { DUREES, ecrire, mouvementReduit } from '../partage/glyphes';
import { PAGE_DEPART, chargerAdministration } from '../pages/liste';
import { REGISTRE } from '../pages/registre';
import { poserCompte } from '../stockage';

type ProprietesRacine = {
  compte: Compte;
  // Page affichée : l'accueil a son allure
  page: string;
  // Palette imposée (banc d'essai), sinon celle choisie dans Ovrane
  palette?: string;
  children: React.ReactNode;
};

// Racine des écrans d'Illusion sous l'en-tête du site : fond, matière, dock
export function RacineIllusion({ compte, page, palette, children }: ProprietesRacine) {
  const matiere = useApparence((s) => s.matiere);
  // Au rendu, avant les pages : leurs brouillons se lisent sous ce compte
  poserCompte(compte.email);

  useEffect(() => {
    if (palette) useBackgroundStore.getState().setBackground(palette);
    else useBackgroundStore.getState().loadPreference();
  }, [palette]);

  // Arrivée dans Illusion, une seule fois : chaque fenêtre naît d'une ligne
  const racine = useRef<HTMLDivElement>(null);
  const [ouverture, setOuverture] = useState<string | null>(page);
  if (ouverture !== null && ouverture !== page) setOuverture(null);
  const ouvre = ouverture === page;
  useLayoutEffect(() => {
    if (!ouvre) return;
    if (mouvementReduit()) {
      setOuverture(null);
      return;
    }
    const fenetres = Array.from(racine.current?.querySelectorAll('.dock [data-fen]:not([hidden])') ?? []);
    const ecrits = fenetres.map((f) => ecrire(f, { duree: DUREES.ouverture, delai: DUREES.ouvrir }));
    const fin = window.setTimeout(() => setOuverture(null), DUREES.ouvrir + DUREES.ouverture + 100);
    return () => {
      clearTimeout(fin);
      ecrits.forEach((c) => c.annuler());
    };
  }, [ouvre]);

  return (
    <div ref={racine} className={`ov mat-${matiere}${compte.admin ? ' admin' : ''}${page === 'accueil' ? ' vue-accueil' : ''}${ouvre ? ' ouverture' : ''}`}>
      <div className="fond" />
      <div className="place-entete" aria-hidden="true" />
      <div key={page} className="scene">
        {children}
      </div>
    </div>
  );
}

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
