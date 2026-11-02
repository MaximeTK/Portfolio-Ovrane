'use client';

import { useEffect, useRef } from 'react';

// Relit à intervalle fixe quand l'onglet est visible, et à chaque changement
export function useSondage(lire: () => unknown, periodeMs: number, actif = true, cle?: unknown) {
  const derniere = useRef(lire);
  useEffect(() => {
    derniere.current = lire;
  });
  useEffect(() => {
    if (!actif) return;
    const tour = () => {
      if (document.visibilityState === 'visible') void derniere.current();
    };
    tour();
    const minuteur = setInterval(tour, periodeMs);
    document.addEventListener('visibilitychange', tour);
    return () => {
      clearInterval(minuteur);
      document.removeEventListener('visibilitychange', tour);
    };
  }, [periodeMs, actif, cle]);
}
