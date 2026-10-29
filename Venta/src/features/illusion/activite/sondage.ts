'use client';

import { useEffect, useRef } from 'react';

// Relit à intervalle fixe, comme l'ancien dashboard, seulement quand l'onglet du navigateur est visible ; tout de suite à l'activation, au changement de `cle` et au retour sur l'onglet
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
