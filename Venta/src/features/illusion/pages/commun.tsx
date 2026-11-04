'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appeler } from '../api';

// Ce que les pages partagent : erreurs, avis, Échap, menus, pagination
export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const duree = (s: number) => (!s ? "à l'instant" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);

// Le trait des icônes, et celles que plusieurs pages montrent
export const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
export const ICONES_COMMUNES = {
  chevron: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>,
  plus: <svg {...TRAIT} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
  fleche: <svg {...TRAIT} strokeWidth={2.6}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  supprimer: <svg {...TRAIT}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  reglages: <svg {...TRAIT}><polygon points="22.3,10.2 22.3,13.8 19.4,13.8 18.5,15.9 20.6,18.0 18.0,20.6 15.9,18.5 13.8,19.4 13.8,22.3 10.2,22.3 10.2,19.4 8.1,18.5 6.0,20.6 3.4,18.0 5.5,15.9 4.6,13.8 1.7,13.8 1.7,10.2 4.6,10.2 5.5,8.1 3.4,6.0 6.0,3.4 8.1,5.5 10.2,4.6 10.2,1.7 13.8,1.7 13.8,4.6 15.9,5.5 18.0,3.4 20.6,6.0 18.5,8.1 19.4,10.2" /><circle cx="12" cy="12" r="3" /></svg>,
  loupe: <svg {...TRAIT}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>,
  vider: <svg {...TRAIT}><path d="M4 6h16M6 6l1 14h10l1-14M9 10l6 6M15 10l-6 6" /></svg>,
  jouer: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>,
};

export type Avis = { texte: string; erreur?: boolean } | null;
// Un avis se lit 3,5 s, une erreur 8 s
export function useAvisBref(avis: Avis, setAvis: (a: null) => void) {
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis, setAvis]);
}

// Échap à la page, sauf si déjà pris ; `toujours` l'écoute quand même
export function useEchap(agir: (e: KeyboardEvent) => void, toujours = false) {
  const courant = useRef(agir);
  useEffect(() => {
    courant.current = agir;
  });
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (toujours || !e.defaultPrevented)) courant.current(e);
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [toujours]);
}

// Réglages relus à chaque ouverture : un autre onglet a pu les changer
export function useParametresOuverts<P>(actif: boolean, prendre: (p: P) => void, setErreur: (e: string) => void) {
  const courant = useRef(prendre);
  useEffect(() => {
    courant.current = prendre;
  });
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    appeler<P>('/parametres').then((p) => {
      if (!vivant) return;
      courant.current(p);
      setErreur('');
    }).catch((e) => vivant && setErreur(message(e)));
    return () => {
      vivant = false;
    };
  }, [actif, setErreur]);
}

// Tant que le menu est ouvert, un clic hors de son hôte le ferme
export function useClicDehors(ouvert: boolean, fermer: () => void) {
  const hote = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!hote.current?.contains(e.target as Node)) fermer();
    };
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [ouvert, fermer]);
  return hote;
}

// Menu autonome : Échap le ferme avant la page ; `arreter` la laisse sourde
export function useMenu(arreter = false) {
  const [ouvert, setOuvert] = useState(false);
  const fermer = useCallback(() => setOuvert(false), []);
  const hote = useClicDehors(ouvert, fermer);
  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (arreter) e.stopPropagation();
      fermer();
    };
    document.addEventListener('keydown', echap, true);
    return () => document.removeEventListener('keydown', echap, true);
  }, [ouvert, arreter, fermer]);
  return { ouvert, setOuvert, hote };
}

// Un filtre et son menu en colonne : clic ailleurs ou Échap le referme
export function MenuColonne({ lib, titre = lib, valeur, actif, choix, courant, choisir, classeHote = '', classeMenu = '', icone = ICONES_COMMUNES.chevron }: {
  lib: string; titre?: string; valeur: string; actif: boolean; choix: { cle: string; libelle: string; n?: number }[]; courant: string; choisir: (cle: string) => void;
  classeHote?: string; classeMenu?: string; icone?: React.ReactNode;
}) {
  const { ouvert, setOuvert, hote } = useMenu();
  return (
    <div ref={hote} className={`menu-hote${classeHote}`}>
      <button type="button" className={`filtre${actif ? ' actif' : ''}`} aria-haspopup="listbox" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        <span><span className="lib">{lib}</span>{valeur}</span>{icone}
      </button>
      {ouvert && (
        <div className={`menu verre${classeMenu}`} role="listbox" aria-label={titre}>
          <span className="verre-halos" aria-hidden="true" />
          {choix.map((c) => (
            <button key={c.cle} type="button" role="option" aria-selected={c.cle === courant} className={`menu-option${c.cle === courant ? ' actif' : ''}`}
              onClick={() => {
                choisir(c.cle);
                setOuvert(false);
              }}>
              {c.libelle}{c.n !== undefined && <span className="compteur">{c.n}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Un filtre en texte seul et son menu, tenus par la page
export function MenuChoix({ ouvert, basculer, fermer, actif, label, titre = label, valeur, options, courant, choisir }: {
  ouvert: boolean; basculer: () => void; fermer: () => void; actif: boolean; label: string; titre?: string; valeur: React.ReactNode;
  options: { valeur: string; nom: string; compte: number }[]; courant: string; choisir: (v: string) => void;
}) {
  const hote = useClicDehors(ouvert, fermer);
  return (
    <div ref={hote} className="menu-hote filtre-hote">
      <button type="button" className={`filtre${actif ? ' actif' : ''}`} aria-haspopup="listbox" aria-expanded={ouvert} aria-label={label} onClick={basculer}>
        {valeur}{ICONES_COMMUNES.chevron}
      </button>
      {ouvert && (
        <div className="menu verre" role="listbox" aria-label={titre}>
          <span className="verre-halos" aria-hidden="true" />
          {options.map((o) => (
            <button key={o.valeur || 'tous'} type="button" role="option" aria-selected={o.valeur === courant} className={`menu-option${o.valeur === courant ? ' actif' : ''}`} onClick={() => choisir(o.valeur)}>
              {o.nom}{o.compte >= 0 && <span className="compteur">{o.compte}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// « auto » : autant de lignes que le défileur en montre entières
export function useLignesAuto(defile: React.RefObject<HTMLElement | null>, setAuto: (n: number) => void, ligneDefaut: number, cle?: unknown) {
  useLayoutEffect(() => {
    const zone = defile.current;
    if (!zone) return;
    const mesurer = () => {
      const tete = zone.querySelector('thead')?.getBoundingClientRect().height ?? 34;
      const ligne = zone.querySelector('tbody tr')?.getBoundingClientRect().height || ligneDefaut;
      setAuto(Math.max(1, Math.floor((zone.clientHeight - tete) / ligne)));
    };
    // Sa première annonce vient après la pose des fenêtres, en une seule mesure
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(zone);
    return () => observateur.disconnect();
  }, [defile, setAuto, ligneDefaut, cle]);
}

// Taille de page et numéros proches du début, de la page et de la fin
export function PaginationAller({ page, pages, setPage, taille, tailles, setTaille, auto, children }: {
  page: number; pages: number; setPage: (p: number) => void; taille: number | 'auto'; tailles: number[]; setTaille: (t: number | 'auto') => void; auto: number; children?: React.ReactNode;
}) {
  const [aller, setAller] = useState('');
  const numeros = [...new Set([1, 2, 3, page - 1, page, page + 1, pages - 2, pages - 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const allerA = () => {
    const n = Number(aller);
    if (Number.isInteger(n) && n >= 1 && n <= pages) setPage(n);
    setAller('');
  };
  // Le premier trou devient le champ « … », les suivants un simple « … »
  const boutons: React.ReactNode[] = [];
  let trou = false;
  numeros.forEach((n, i) => {
    if (i > 0 && n - numeros[i - 1] > 1) {
      boutons.push(trou
        ? <span key={`trou-${n}`} className="pl trou" aria-hidden="true">…</span>
        : <input key="aller" type="text" className="aller" inputMode="numeric" placeholder="…" size={3} aria-label="Aller à la page" value={aller}
            onChange={(e) => setAller(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && allerA()} onBlur={() => aller && allerA()} />);
      trou = true;
    }
    boutons.push(<button key={n} type="button" className={`pl${n === page ? ' actif' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>);
  });
  return (
    <div className="pagination">
      <select aria-label="Lignes par page" value={String(taille)} onChange={(e) => setTaille(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
        <option value="auto">auto ({auto})</option>
        {tailles.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <nav className="pages" aria-label="Pages">
        <button type="button" className="pl" disabled={page <= 1} aria-label="Page précédente" onClick={() => setPage(page - 1)}>‹</button>
        {boutons}
        <button type="button" className="pl" disabled={page >= pages} aria-label="Page suivante" onClick={() => setPage(page + 1)}>›</button>
      </nav>
      {children}
    </div>
  );
}
