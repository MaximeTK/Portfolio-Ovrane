'use client';

import { useUIStore, vueIllusion } from '@/lib/uiStore';

// Ouvre une page d'Illusion dans le site ; l'en-tête passe à ses canaux
export const ouvrirIllusion = (vers: string) => useUIStore.getState().setPage(vueIllusion(vers));

type ProprietesLien = { vers: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

// Lien vers une page d'Illusion, ouvrable aussi dans un autre onglet
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
