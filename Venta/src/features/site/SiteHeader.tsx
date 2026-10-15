'use client';

import { useUIStore } from '@/lib/uiStore';

// Hauteur et marge haute du header : l'œil d'Ovrane vise son centre quand il monte (HexagonalAnimation)
export const CENTRE_HEADER_PX = 16 + 44 / 2;

function Onglet({ page, label, icone }: { page: string; label: string; icone?: React.ReactNode }) {
  const actif = useUIStore((s) => s.page === page);
  const setPage = useUIStore((s) => s.setPage);
  // Onglet actif : même lueur que l'œil, une copie blanche floutée sous le texte ; une icône garde son libellé pour les lecteurs d'écran
  return (
    <button
      type="button"
      onClick={() => setPage(page)}
      aria-current={actif ? 'page' : undefined}
      aria-label={icone ? label : undefined}
      title={icone ? label : undefined}
      className={`inline-flex min-h-11 min-w-6 items-center justify-center text-[9px] font-bold uppercase tracking-[0.12em] transition-[color,filter] duration-500 sm:text-[10px] sm:tracking-[0.25em] ${
        actif ? 'text-white drop-shadow-[0_0_3px_#fff]' : 'text-white/60 hover:text-white'
      }`}
    >
      {icone ?? label}
    </button>
  );
}

const ICONE_REGLAGES = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </svg>
);

export function SiteHeader() {
  const awake = useUIStore((s) => s.appState === 'awake');
  // L'emplacement central s'ouvre dès que l'œil quitte le centre de l'écran : page ou messagerie
  const ouvert = useUIStore((s) => s.page !== null || s.viewMode === 'messaging');

  return (
    <header
      inert={!awake}
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
          <Onglet page="reglages" label="Réglages" icone={ICONE_REGLAGES} />
        </div>
      </nav>
    </header>
  );
}
