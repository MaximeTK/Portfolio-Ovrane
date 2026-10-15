'use client';

import { useUIStore } from '@/lib/state/uiStore';

// Hauteur et marge haute du header : l'œil d'Ovrane vise son centre quand il monte (HexagonalAnimation)
export const CENTRE_HEADER_PX = 16 + 44 / 2;

function Onglet({ page, label }: { page: string; label: string }) {
  const actif = useUIStore((s) => s.page === page);
  const setPage = useUIStore((s) => s.setPage);
  // Onglet actif : même lueur que l'œil, une copie blanche floutée sous le texte
  return (
    <button
      type="button"
      onClick={() => setPage(page)}
      aria-current={actif ? 'page' : undefined}
      className={`py-1 text-[9px] font-bold uppercase tracking-[0.12em] transition-[color,filter] duration-500 sm:text-[10px] sm:tracking-[0.25em] ${
        actif ? 'text-white drop-shadow-[0_0_3px_#fff]' : 'text-white/60 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

export function SiteHeader() {
  const awake = useUIStore((s) => s.appState === 'awake');
  // L'emplacement central s'ouvre dès que l'œil quitte le centre de l'écran : page ou messagerie
  const ouvert = useUIStore((s) => s.page !== null || s.viewMode === 'messaging');

  return (
    <header
      className={`pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4 font-sans transition-all duration-1000 ${
        awake ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}
    >
      {/* Colonnes latérales de même largeur : l'emplacement de l'œil reste au centre exact de l'écran */}
      <nav
        aria-label="Navigation principale"
        className={`inline-grid h-11 grid-cols-[1fr_auto_1fr] items-center ${awake ? 'pointer-events-auto' : ''}`}
      >
        <div className="flex items-center justify-end gap-4 sm:gap-7">
          <Onglet page="pico" label="Pico" />
          <Onglet page="ovrane" label="Ovrane" />
        </div>
        <span aria-hidden="true" className={`block transition-[width] duration-500 ease-out ${ouvert ? 'w-12 sm:w-16' : 'w-2.5 sm:w-7'}`} />
        <div className="flex items-center gap-4 sm:gap-7">
          <Onglet page="illusion" label="Illusion" />
          <Onglet page="hikup" label="Hikup" />
        </div>
      </nav>
    </header>
  );
}
