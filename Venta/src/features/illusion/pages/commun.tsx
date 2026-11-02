'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Ce que les pages partagent : erreurs, avis, Échap et menus
export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const duree = (s: number) => (!s ? "à l'instant" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);

export type Avis = { texte: string; erreur?: boolean } | null;
// Un avis se lit 3,5 s, une erreur 8 s
export function useAvisBref(avis: Avis, setAvis: (a: null) => void) {
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis, setAvis]);
}

// Échap à la page, sauf si déjà pris ; `toujours` l'écoute quand même
export function useEchap(agir: (e: KeyboardEvent) => void, toujours = false) {
  const courant = useRef(agir);
  useEffect(() => {
    courant.current = agir;
  });
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (toujours || !e.defaultPrevented)) courant.current(e);
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [toujours]);
}

// Tant que le menu est ouvert, un clic hors de son hôte le ferme
export function useClicDehors(ouvert: boolean, fermer: () => void) {
  const hote = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!hote.current?.contains(e.target as Node)) fermer();
    };
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [ouvert, fermer]);
  return hote;
}

// Menu autonome : Échap le ferme avant la page ; `arreter` la laisse sourde
export function useMenu(arreter = false) {
  const [ouvert, setOuvert] = useState(false);
  const fermer = useCallback(() => setOuvert(false), []);
  const hote = useClicDehors(ouvert, fermer);
  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (arreter) e.stopPropagation();
      fermer();
    };
    document.addEventListener('keydown', echap, true);
    return () => document.removeEventListener('keydown', echap, true);
  }, [ouvert, arreter, fermer]);
  return { ouvert, setOuvert, hote };
}
