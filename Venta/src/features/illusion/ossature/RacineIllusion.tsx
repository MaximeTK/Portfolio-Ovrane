'use client';

import '../styles/illusion.css';
import { useEffect } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useBackgroundStore } from '@/features/fond/backgroundStore';
import { useApparence } from '../apparence';
import type { Compte } from '../api';
import { Entete } from './Entete';

type ProprietesRacine = {
  compte: Compte;
  // Début des liens des canaux : « /illusion/ », ou celui du banc d'essai
  base?: string;
  // Page courante quand l'adresse ne la porte pas (banc d'essai)
  page?: string;
  // Palette imposée (banc d'essai), sinon celle choisie par l'utilisateur dans Ovrane
  palette?: string;
  children: React.ReactNode;
};

// Racine des écrans d'Illusion : fond, matière, en-tête, puis le dock de la page
export function RacineIllusion({ compte, base = '/illusion/', page, palette, children }: ProprietesRacine) {
  const segment = useSelectedLayoutSegment();
  const courante = page ?? segment;
  const matiere = useApparence((s) => s.matiere);

  useEffect(() => {
    if (palette) useBackgroundStore.getState().setBackground(palette);
    else useBackgroundStore.getState().loadPreference();
  }, [palette]);

  return (
    <div className={`ov mat-${matiere}${compte.admin ? ' admin' : ''}${courante === 'accueil' ? ' vue-accueil' : ''}`}>
      <div className="fond" />
      <Entete compte={compte} page={courante} base={base} />
      {children}
    </div>
  );
}
