'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Ce que les pages partagent : erreurs, avis, Échap et menus
export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const duree = (s: number) => (!s ? "à l'instant" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);

// Le trait des icônes, et celles que plusieurs pages montrent
export const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
export const ICONES_COMMUNES = {
  chevron: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>,
  plus: <svg {...TRAIT} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
  fleche: <svg {...TRAIT} strokeWidth={2.6}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  supprimer: <svg {...TRAIT}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  reglages: <svg {...TRAIT}><polygon points="22.3,10.2 22.3,13.8 19.4,13.8 18.5,15.9 20.6,18.0 18.0,20.6 15.9,18.5 13.8,19.4 13.8,22.3 10.2,22.3 10.2,19.4 8.1,18.5 6.0,20.6 3.4,18.0 5.5,15.9 4.6,13.8 1.7,13.8 1.7,10.2 4.6,10.2 5.5,8.1 3.4,6.0 6.0,3.4 8.1,5.5 10.2,4.6 10.2,1.7 13.8,1.7 13.8,4.6 15.9,5.5 18.0,3.4 20.6,6.0 18.5,8.1 19.4,10.2" /><circle cx="12" cy="12" r="3" /></svg>,
  loupe: <svg {...TRAIT}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>,
  vider: <svg {...TRAIT}><path d="M4 6h16M6 6l1 14h10l1-14M9 10l6 6M15 10l-6 6" /></svg>,
  jouer: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>,
};

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
