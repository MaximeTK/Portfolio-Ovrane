'use client';

import dynamic from 'next/dynamic';
import { horsAccueil, useUIStore } from '@/lib/uiStore';
import { TRAIT_ROND, etatLueur } from './elements';

// Canaux d'Illusion, chargés pour un compte qui y a accès
const EnteteIllusion = dynamic(() => import('@/features/illusion/ossature/Entete').then((m) => m.Entete));

// Hauteur et marge haute du header : l'œil vise son centre en montant
export const CENTRE_HEADER_PX = 16 + 44 / 2;
const BOUTON_ENTETE = 'pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center';

function Onglet({ page, label }: { page: string; label: string }) {
  const actif = useUIStore((s) => s.page === page);
  const setPage = useUIStore((s) => s.setPage);
  // Onglet actif : lueur de l'œil, copie blanche floutée sous le texte
  return (
    <button
      type="button"
      onClick={() => setPage(page)}
      aria-current={actif ? 'page' : undefined}
      className={`${BOUTON_ENTETE} px-1 font-[family-name:var(--font-roboto)] text-xs font-medium sm:px-3.5 sm:text-sm ${etatLueur(actif)}`}
    >
      {label}
    </button>
  );
}

const ICONE_REGLAGES = (
  <svg {...TRAIT_ROND} className="h-5 w-5" strokeWidth={1.8}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </svg>
);

const ICONE_COMPTE = (
  <svg {...TRAIT_ROND} className="h-5 w-5" strokeWidth={1.8}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </svg>
);

// Une icône du coin : la page change, les canaux affichés ne bougent pas
function IconeCoin({ page, label, icone }: { page: string; label: string; icone: React.ReactNode }) {
  const actif = useUIStore((s) => s.page?.split('?')[0] === page);
  return (
    <button
      type="button"
      onClick={() => {
        const { cote, setPage } = useUIStore.getState();
        setPage(page);
        useUIStore.setState({ cote });
      }}
      aria-current={actif ? 'page' : undefined}
      aria-label={label}
      title={label}
      className={`${BOUTON_ENTETE} ${etatLueur(actif)}`}
    >
      {icone}
    </button>
  );
}

export function SiteHeader() {
  const awake = useUIStore((s) => s.appState === 'awake');
  // L'emplacement central s'ouvre dès que l'œil quitte le centre de l'écran
  const ouvert = useUIStore(horsAccueil);
  const compteIllusion = useUIStore((s) => s.compteIllusion);
  const illusion = useUIStore((s) => s.cote === 'illusion');

  return (
    <header
      inert={!awake}
      className={`pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4 font-sans transition-all duration-1000 ${
        awake ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}
    >
      {/* Canaux d'Ovrane et d'Illusion à la même place, l'un effaçant l'autre */}
      <div className="grid">
        {/* Colonnes latérales égales : l'œil reste au centre exact de l'écran */}
        <nav
          aria-label="Navigation principale"
          inert={illusion}
          className={`col-start-1 row-start-1 inline-grid h-11 grid-cols-[1fr_auto_1fr] items-center justify-self-center transition-opacity duration-200 ${
            illusion ? 'opacity-0' : awake ? 'pointer-events-auto' : ''
          }`}
        >
          <div className="flex items-center justify-end gap-1">
            <Onglet page="pico" label="Pico" />
            <Onglet page="ovrane" label="Ovrane" />
          </div>
          <span aria-hidden="true" className={`block transition-[width] duration-500 ease-out ${ouvert ? 'w-12 sm:w-16' : 'w-2.5 sm:w-7'}`} />
          <div className="flex items-center gap-1">
            <Onglet page="illusion" label="Illusion" />
            <Onglet page="hikup" label="Hikup" />
          </div>
        </nav>
        {compteIllusion && <EnteteIllusion compte={compteIllusion} visible={illusion} />}
      </div>
      {/* Hors de la bascule des canaux ; sur mobile, une icône à chaque bout */}
      <div className="coin-site pointer-events-none absolute inset-x-2 top-4 flex justify-between gap-1 sm:left-auto sm:right-[9.4px] sm:justify-end">
        <IconeCoin page={compteIllusion ? 'illusion/reglages' : 'reglages'} label="Réglages" icone={ICONE_REGLAGES} />
        <IconeCoin page={compteIllusion ? 'illusion/profil' : 'connexion'} label={compteIllusion ? 'Profil' : 'Compte'} icone={ICONE_COMPTE} />
      </div>
    </header>
  );
}
