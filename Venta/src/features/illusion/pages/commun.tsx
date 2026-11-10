'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appeler } from '../api';
import { repris, useGarder } from '../stockage';
import { message } from '../elements/format';
import { useSondage } from '../activite/sondage';

// Ce que les pages partagent : erreurs, avis, Échap, pagination

export const duree = (s: number) => (!s ? "à l'instant" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);

// Un geste à la fois : son échec part dans `echec`, `apres` suit toujours
export function useGeste(echec: (texte: string) => void) {
  const [occupe, setOccupe] = useState(false);
  const geste = async (faire: () => Promise<unknown>, apres?: () => unknown) => {
    setOccupe(true);
    try {
      await faire();
    } catch (e) {
      echec(message(e));
    } finally {
      setOccupe(false);
      await apres?.();
    }
  };
  return { occupe, geste };
}

// Ce qu'une adresse rend, repris d'une visite à l'autre et relu par `relire`
export function useLecture<T>(section: string, nom: string, adresse: string, apres?: (lu: T) => void) {
  const [lu, setLu] = useState(() => repris<T | null>(`${section}:${nom}`, null));
  const [erreur, setErreur] = useState('');
  useGarder(section, { [nom]: lu });
  const suite = useRef(apres);
  useEffect(() => {
    suite.current = apres;
  });
  // Une réponse dépassée par une lecture plus récente ne compte plus
  const derniere = useRef(0);
  const relire = useCallback(async () => {
    const n = ++derniere.current;
    try {
      const neuf = await appeler<T>(adresse);
      if (n !== derniere.current) return;
      setLu(neuf);
      setErreur('');
      suite.current?.(neuf);
    } catch (e) {
      if (n === derniere.current) setErreur(message(e));
    }
  }, [adresse]);
  return { lu, setLu, erreur, relire };
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

// « auto » : les lignes que le défileur montre ; sans ligne lue, --ligne
export function useLignesAuto(defile: React.RefObject<HTMLElement | null>, setAuto: (n: number) => void, cle?: unknown, min = 1) {
  useLayoutEffect(() => {
    const zone = defile.current;
    if (!zone) return;
    const mesurer = () => {
      const tete = zone.querySelector('thead')?.getBoundingClientRect().height ?? 34;
      const ligne = zone.querySelector('tbody tr:not(.vide-tableau)')?.getBoundingClientRect().height || parseFloat(getComputedStyle(zone).getPropertyValue('--ligne')) || 36;
      setAuto(Math.max(min, Math.floor((zone.clientHeight - tete) / ligne)));
    };
    // Sa première annonce vient après la pose des fenêtres, en une seule mesure
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(zone);
    return () => observateur.disconnect();
  }, [defile, setAuto, cle, min]);
}

// Page, lignes par page et « auto », repris d'une visite à l'autre
export function usePagination(cle: string, autoDepart: number) {
  const [page, setPage] = useState(() => repris(`${cle}:page`, 1));
  const [taille, setTaille] = useState(() => repris<number | 'auto'>(`${cle}:taille`, 'auto'));
  const [auto, setAuto] = useState(() => repris(`${cle}:auto`, autoDepart));
  useGarder(cle, { page, taille, auto });
  return { page, setPage, taille, setTaille, auto, setAuto };
}

// La tranche d'une liste lue en entier : pages, page courante, lignes montrées
export function decouper<T>(liste: T[], page: number, taille: number | 'auto', auto: number) {
  const parPage = taille === 'auto' ? auto : taille;
  const pages = Math.max(1, Math.ceil(liste.length / parPage));
  const courante = Math.min(page, pages);
  return { pages, courante, visibles: liste.slice((courante - 1) * parPage, courante * parPage) };
}

// Taille de page et numéros proches du début, de la page et de la fin
export function PaginationAller({ page, pages, setPage, taille, tailles, setTaille, auto, libelle = 'Lignes par page', children }: {
  page: number; pages: number; setPage: (p: number) => void; taille: number | 'auto'; tailles: number[]; setTaille: (t: number | 'auto') => void; auto: number; libelle?: string; children?: React.ReactNode;
}) {
  const [aller, setAller] = useState('');
  const numeros = [...new Set([1, 2, 3, page - 1, page, page + 1, pages - 2, pages - 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const allerA = () => {
    if (aller) setPage(Math.min(Math.max(1, Number(aller)), pages));
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
      <select aria-label={libelle} value={String(taille)} onChange={(e) => setTaille(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
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

// Une file lue page par page, relue toutes les 5 s, avec filtres et sélection
export function useFileServeur<E extends { page: number; pages: number }, F extends Record<string, string>>({ section, nom, chemin, filtres: depart, autoDepart }: {
  section: string; nom: string; chemin: string; filtres: F; autoDepart: number;
}) {
  const [filtres, poserFiltres] = useState(() => repris<F>(`${section}:filtres`, depart));
  const { page, setPage, taille, setTaille, auto, setAuto } = usePagination(section, autoDepart);
  useGarder(section, { filtres });
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  // L'API lit au moins 10 lignes ; en « auto », le défileur garde le surplus
  const adresse = `${chemin}?${new URLSearchParams({ ...filtres, page: String(page), taille: String(taille === 'auto' ? Math.max(10, auto) : taille) })}`;
  const { lu, erreur, relire } = useLecture<E>(section, nom, adresse, (l) => {
    if (l.page > l.pages) setPage(l.pages);
  });
  useSondage(relire, 5000, true, adresse);
  return {
    lu, erreur, relire, filtres, page, setPage, taille, auto, setAuto, selection, setSelection,
    setFiltres: (f: F) => {
      poserFiltres(f);
      setPage(1);
    },
    setTaille: (t: number | 'auto') => {
      setTaille(t);
      setPage(1);
    },
  };
}
export type FileServeur<E extends { page: number; pages: number }, F extends Record<string, string>> = ReturnType<typeof useFileServeur<E, F>>;
