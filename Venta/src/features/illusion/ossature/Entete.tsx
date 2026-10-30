'use client';

import '../styles/illusion.css';
import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/lib/uiStore';
import { useApparence } from '../apparence';
import type { Compte } from '../api';
import { LienIllusion } from '../partage/LienIllusion';
import { ADMINISTRATION } from '../pages/liste';

const TRAIT = { className: 'icone', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const REGLAGES = <svg {...TRAIT}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>;
const PERSONNE = <svg {...TRAIT}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>;
// Icônes des pages d'administration, reprises des canaux des planches
const ICONES_ADMIN: Record<string, React.ReactNode> = {
  collecte: <svg {...TRAIT}><path d="M4 5h16l-6 7v6l-4 2v-8z" /></svg>,
  parser: <svg {...TRAIT}><path d="m8 8-4 4 4 4M16 8l4 4-4 4" /></svg>,
  audit: <svg {...TRAIT}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>,
  veille: <svg {...TRAIT}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  workflows: <svg {...TRAIT}><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="8" r="2" /><path d="M6 7v10M18 10c0 4-6 3-10 7" /></svg>,
  constructeur: <svg {...TRAIT}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>,
  lapis: <svg {...TRAIT}><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.5 3-6 7-6" /><circle cx="17" cy="16" r="3" /><path d="m21 20-1.8-1.8" /></svg>,
  metriques: <svg {...TRAIT}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  'parametres-serveur': <svg {...TRAIT}><rect x="3" y="4" width="18" height="7" /><rect x="3" y="13" width="18" height="7" /><path d="M7 7.5h.01M7 16.5h.01" /></svg>,
};

type ProprietesEntete = { compte: Compte; visible: boolean };

// Canaux d'Illusion dans l'en-tête du site, autour de son logo, à la place exacte de ceux d'Ovrane et de l'œil
export function Entete({ compte, visible }: ProprietesEntete) {
  const page = useUIStore((s) => (s.page?.startsWith('illusion/') ? s.page.slice(9).split('?')[0] : null));
  const matiere = useApparence((s) => s.matiere);
  // Clic droit sur le logo : les canaux d'Ovrane reviennent, l'œil au centre
  const versOvrane = (e: React.MouseEvent) => {
    e.preventDefault();
    useUIStore.getState().setCote('ovrane');
  };
  const onglet = (slug: string, titre: string, icone?: React.ReactNode) => (
    <LienIllusion
      vers={slug}
      className={`onglet${page === slug ? ' actif' : ''}`}
      aria-current={page === slug ? 'page' : undefined}
      aria-label={icone ? titre : undefined}
      title={icone ? titre : undefined}
    >
      {icone ?? titre}
    </LienIllusion>
  );

  return (
    <div inert={!visible} className={`ov ov-barre mat-${matiere}${visible ? ' visible' : ''}${page === 'accueil' ? ' sur-accueil' : ''}`}>
      <nav className="barre-canaux" aria-label="Canaux d'Illusion">
        <div className="cote gauche">
          {onglet('reglages', 'Réglages', REGLAGES)}
          {onglet('offres', 'Offres')}
          {onglet('candidatures', 'Candidatures')}
          {onglet('documents', 'Documents')}
        </div>
        <div className="centre">
          <LienIllusion vers="accueil" className="logo" onContextMenu={versOvrane} aria-label="Illusion : accueil" title="Illusion · clic : accueil · clic droit : canaux d'Ovrane">
            <svg viewBox="0 0 325.934 274.525" width="34" height="29" fill="none" stroke="#fff" aria-hidden="true">
              <path d="M9.4632 262.426L112.954 181.479V19.5844" strokeWidth="30.72" />
              <path d="M316.471 262.426L212.98 181.479V19.5844" strokeWidth="30.72" />
              <path d="M163.063 262.272V161.894V0" strokeWidth="30.72" />
            </svg>
          </LienIllusion>
        </div>
        <div className="cote droite">
          {onglet('mails', 'Mails')}
          {onglet('appels', 'Appels')}
          {onglet('relations', 'Relations')}
          {onglet('profil', 'Profil', PERSONNE)}
          {compte.admin && <MenuAdministration page={page} />}
        </div>
      </nav>
    </div>
  );
}

// Menu des pages d'administration, au bout de droite pour un compte admin
function MenuAdministration({ page }: { page: string | null }) {
  const [ouvert, setOuvert] = useState(false);
  const hote = useRef<HTMLDivElement>(null);
  const actif = ADMINISTRATION.some((p) => p.slug === page);

  // Un clic ailleurs ou Échap le referme
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!hote.current?.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      document.removeEventListener('keydown', echap);
    };
  }, [ouvert]);

  return (
    <div ref={hote} className="menu-hote">
      <button type="button" className={`onglet${actif ? ' actif' : ''}`} aria-haspopup="menu" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        Administration
        <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {ouvert && (
        <div className="menu verre" role="menu" aria-label="Administration">
          <span className="verre-halos" aria-hidden="true" />
          {ADMINISTRATION.map((p) => (
            <LienIllusion
              key={p.slug}
              role="menuitem"
              vers={p.slug}
              className={`menu-option${page === p.slug ? ' actif' : ''}`}
              aria-current={page === p.slug ? 'page' : undefined}
              onClick={() => setOuvert(false)}
            >
              {ICONES_ADMIN[p.slug]}
              {p.titre}
            </LienIllusion>
          ))}
        </div>
      )}
    </div>
  );
}
