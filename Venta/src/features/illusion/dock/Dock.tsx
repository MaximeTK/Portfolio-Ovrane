'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ECART, PRISES, installerDock, type ArbreDepart, type DefFenetre, type Moteur } from './moteur';

export type { Arbre, ArbreDepart, DefFenetre, Taille, Zone } from './moteur';

// Tailles des fenêtres partagées et de la fenêtre principale d'une page : minimum, bande d'un bord de l'écran, premier détachement
export const TAILLES_ACTIVITE: DefFenetre = { mini: [200, 170], pref: [228, 240], flot: [300, 520] };
export const TAILLES_PANNEAU: DefFenetre = { mini: [360, 220], pref: [440, 320], flot: [460, 560] };
export const TAILLES_PRINCIPALE: DefFenetre = { mini: [470, 220], pref: [620, 360], flot: [760, 480] };
const LARGEUR_ACTIVITE = 228;

// Rangée de départ des pages : Activité | fenêtre principale | panneau, ce dernier à la largeur --panneau de la page
export const arbreDePage = (principal: string, miniPrincipal = TAILLES_PRINCIPALE.mini![0]): ArbreDepart => (zone, style) => {
  const lp = parseFloat(style.getPropertyValue('--panneau')) || 440;
  return {
    dir: 'row',
    enfants: [{ id: 'activite' }, { id: principal }, { id: 'panneau' }],
    parts: [LARGEUR_ACTIVITE, Math.max(zone.w - LARGEUR_ACTIVITE - lp - 2 * ECART, miniPrincipal), lp],
  };
};

type ContexteDock = { ranger: (anime?: boolean) => void; onglet: string | null; ouvrir: (cle: string) => void; fermer: () => void };
const Contexte = createContext<ContexteDock | null>(null);

function useContexte() {
  const c = useContext(Contexte);
  if (!c) throw new Error('Fenêtre ou panneau hors d’un <Dock>');
  return c;
}

// Nouveau rangement quand une fenêtre apparaît ou disparaît autrement que par <Fenetre hidden>
export const useDock = () => ({ ranger: useContexte().ranger });

// Onglet ouvert du panneau de la page ; ouvrir depuis n'importe où choisit l'onglet et montre le panneau
export function usePanneau() {
  const { onglet, ouvrir, fermer } = useContexte();
  return { onglet, ouvrir, fermer };
}

type ProprietesDock = {
  // Clé de la disposition gardée pendant la session : le slug de la page
  id: string;
  principal?: string;
  arbre?: ArbreDepart;
  fenetres?: Record<string, DefFenetre>;
  prises?: string;
  // Onglet du panneau ouvert à l'arrivée, null : panneau fermé
  panneau?: string | null;
  children: React.ReactNode;
};

export function Dock({ id, principal = 'principal', arbre, fenetres, prises = PRISES, panneau = null, children }: ProprietesDock) {
  const coquille = useRef<HTMLDivElement>(null);
  const entiere = useRef<HTMLDivElement>(null);
  const fentes = useRef<HTMLDivElement>(null);
  const remise = useRef<HTMLButtonElement>(null);
  const moteur = useRef<Moteur | null>(null);
  const [onglet, setOnglet] = useState(panneau);
  // Le moteur relit toujours les dernières propriétés sans se réinstaller ; les tailles données complètent celles par défaut
  const proprietes = useRef({ principal, arbre, prises, tailles: {} as Record<string, DefFenetre> });
  useLayoutEffect(() => {
    const tailles: Record<string, DefFenetre> = { activite: TAILLES_ACTIVITE, panneau: TAILLES_PANNEAU, [principal]: TAILLES_PRINCIPALE };
    for (const [cle, t] of Object.entries(fenetres ?? {})) tailles[cle] = { ...tailles[cle], ...t };
    proprietes.current = { principal, arbre, prises, tailles };
  });

  useLayoutEffect(() => {
    const p = () => proprietes.current;
    const m = installerDock(coquille.current!, {
      id,
      principal: () => p().principal,
      depart: () => p().arbre ?? arbreDePage(p().principal, p().tailles[p().principal].mini?.[0]),
      tailles: () => p().tailles,
      prises: () => p().prises,
      entiere: entiere.current!,
      fentes: fentes.current!,
      remise: remise.current!,
    });
    moteur.current = m;
    return () => {
      m.detruire();
      moteur.current = null;
    };
  }, [id]);

  const ranger = useCallback((anime = true) => moteur.current?.ranger(anime), []);
  const valeur = useMemo(() => ({ ranger, onglet, ouvrir: setOnglet, fermer: () => setOnglet(null) }), [ranger, onglet]);

  return (
    <Contexte.Provider value={valeur}>
      <div ref={coquille} className="coquille dock">
        {children}
        <div ref={entiere} className="place-entiere" />
        <div ref={fentes} className="fentes" />
      </div>
      <button ref={remise} type="button" className="remise" title="Remettre les fenêtres à leur place" aria-label="Remettre les fenêtres à leur place">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden="true"><path d="M3 4h18v16H3zM9 4v16M15 4v16" /></svg>
      </button>
    </Contexte.Provider>
  );
}

type ProprietesFenetre = Omit<React.HTMLAttributes<HTMLElement>, 'id'> & {
  id: string;
  as?: 'section' | 'div' | 'aside' | 'main';
  // Infobulle de la prise, « Glisser pour détacher … »
  titrePrise?: string;
  hidden?: boolean;
};

// Une fenêtre du dock : verre, prise, poignées de taille ; cachée, elle garde sa place dans l'arbre pour la retrouver
export function Fenetre({ id, as: Balise = 'section', className, titrePrise = 'Glisser pour détacher la fenêtre', hidden, children, ...reste }: ProprietesFenetre) {
  const { ranger } = useContexte();
  // Montrée : rangée avant d'être peinte ; retirée : rangée une fois sortie de la page
  useLayoutEffect(() => {
    ranger();
    return () => {
      requestAnimationFrame(() => ranger());
    };
  }, [hidden, ranger]);
  return (
    <Balise data-fen={id} className={`verre${className ? ' ' + className : ''}`} hidden={hidden} {...reste}>
      <span className="verre-halos" aria-hidden="true" />
      <span className="prise" title={titrePrise} aria-hidden="true" />
      {children}
      <span className="taille d" data-taille="d" aria-hidden="true" />
      <span className="taille b" data-taille="b" aria-hidden="true" />
      <span className="taille c" data-taille="c" aria-hidden="true" />
    </Balise>
  );
}
