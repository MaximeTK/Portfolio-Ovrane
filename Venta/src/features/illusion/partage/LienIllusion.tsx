'use client';

import { useUIStore } from '@/lib/uiStore';

// Ouvre une page d'Illusion dans le site (« candidatures?panneau=direct ») ; l'en-tête passe à ses canaux
export const ouvrirIllusion = (vers: string) => useUIStore.getState().setPage(`illusion/${vers}`);

type ProprietesLien = { vers: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

// Lien vers une page d'Illusion : la vue s'ouvre sur place, l'adresse reste ouvrable dans un autre onglet
export function LienIllusion({ vers, onClick, ...lien }: ProprietesLien) {
  return (
    <a
      {...lien}
      href={`/illusion/${vers}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        ouvrirIllusion(vers);
      }}
    />
  );
}
