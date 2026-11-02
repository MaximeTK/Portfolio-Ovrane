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
    // Une seule lecture en vol : un serveur lent n'en reçoit pas davantage
    let enVol = false;
    const tour = async () => {
      if (enVol || document.visibilityState !== 'visible') return;
      enVol = true;
      try {
        await derniere.current();
      } finally {
        enVol = false;
      }
    };
    void tour();
    const minuteur = setInterval(tour, periodeMs);
    document.addEventListener('visibilitychange', tour);
    return () => {
      clearInterval(minuteur);
      document.removeEventListener('visibilitychange', tour);
    };
  }, [periodeMs, actif, cle]);
}
