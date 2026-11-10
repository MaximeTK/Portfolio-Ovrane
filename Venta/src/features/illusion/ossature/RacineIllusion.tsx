'use client';

import '../styles/illusion.css';
import '../styles/themes.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBackgroundStore } from '@/features/fond/backgroundStore';
import { useUIStore } from '@/lib/uiStore';
import { classesTheme, useApparence } from '../apparence';
import { DUREE_FLOTTANTE, LENTEUR_FLOTTANTE } from '../dock/moteur';
import type { Compte } from '../api';
import { DemandeCode } from '../partage/DemandeCode';
import { DUREES, ecrire, mouvementReduit } from '../partage/glyphes';
import { poserCompte } from '../stockage';

type ProprietesRacine = {
  // Absent pour un visiteur d'Ovrane
  compte?: Compte;
  // Page affichée : l'accueil a son allure
  page: string;
  // Palette imposée (banc d'essai), sinon celle choisie dans Ovrane
  palette?: string;
  children: React.ReactNode;
};

// Racine des écrans d'Illusion sous l'en-tête du site : fond, matière, dock
export function RacineIllusion({ compte, page, palette, children }: ProprietesRacine) {
  const matiere = useApparence((s) => s.matiere);
  const theme = useApparence((s) => s.theme);
  const flou = useUIStore((s) => s.verreFlou);
  // Au rendu, avant les pages : leurs brouillons se lisent sous ce compte
  if (compte) poserCompte(compte.email);

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
    const fenetres = Array.from(racine.current?.querySelectorAll<HTMLElement>('.dock [data-fen]:not([hidden])') ?? []);
    const lenteur = (f: HTMLElement) => (f.dataset.flot === undefined ? 1 : LENTEUR_FLOTTANTE);
    const ecrits = fenetres.map((f) => ecrire(f, { duree: (DUREES.ouvrir - DUREES.voile) * lenteur(f), delai: DUREES.voile * lenteur(f) }));
    const fin = window.setTimeout(() => setOuverture(null), (fenetres.some((f) => f.dataset.flot !== undefined) ? DUREE_FLOTTANTE : DUREES.ouvrir) + 100);
    return () => {
      clearTimeout(fin);
      ecrits.forEach((c) => c.annuler());
    };
  }, [ouvre]);

  return (
    <div ref={racine} className={`ov mat-${matiere} ${classesTheme(theme)}${compte?.admin ? ' admin' : ''}${flou > 0 ? ' a-flou' : ''}${page === 'accueil' ? ' vue-accueil' : ''}${ouvre ? ' ouverture' : ''}`}>
      <div className="fond" />
      <div className="place-entete" aria-hidden="true" />
      <div key={page} className="scene">
        {children}
      </div>
      {compte && <DemandeCode />}
    </div>
  );
}
