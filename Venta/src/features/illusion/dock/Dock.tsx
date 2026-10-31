'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DUREES, ecrire, effacer, mouvementReduit, voiler, type Controle } from '../partage/glyphes';
import { DUREE_RANGEMENT, ECART, PRISES, TRANSITION, installerDock, type ArbreDepart, type DefFenetre, type Moteur, type OptionsRangement, type Zone } from './moteur';

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

// Passage d'une fenêtre d'une page à l'autre : elle se ferme ou s'ouvre en holographique, se replie ou se déplie (organique),
// garde son verre et seul son contenu change, ou se cache aussitôt (une autre a pris sa place)
type Mode = 'holo' | 'organique' | 'ecrit' | 'cache';

type ContexteDock = {
  ranger: (anime?: boolean, options?: OptionsRangement) => void;
  // Lancé une fois les fenêtres posées : tout de suite, ou juste après la première pose du dock qui arrive
  quandPose: (f: () => void) => void;
  // Fenêtres visibles sur la page quittée ; null à l'arrivée dans Illusion
  avant: Record<string, boolean> | null;
  // Ce que le changement de page prévoit pour une fenêtre, et l'attente des ouvertures holographiques ; rien hors d'un changement de page
  prevue: (id: string) => { mode?: Mode; delai: number };
  onglet: string | null;
  ouvrir: (cle: string) => void;
  fermer: () => void;
};
const Contexte = createContext<ContexteDock | null>(null);

// Fenêtre de la page quittée : son passage, vue ou non, détachée ou non, sa place à l'écran
type Sortant = { id: string; passage: string; vue: boolean; flot: boolean; rect: DOMRect; el: HTMLElement };
type Sortants = { page: string; fenetres: Sortant[] };
// Ce que prévoit le changement de page : l'attente des ouvertures holographiques, et le mode de chaque fenêtre
type Passage = { delai: number; modes: Map<string, Mode> };

// Fenêtres visibles du dock monté : celui de la page suivante les lit au premier rendu, quand l'ancien est encore là ;
// `sortants` : les fenêtres du dock démonté et sa page, lues par le suivant dans le même rendu
const DOCK = { visibles: {} as Record<string, boolean>, sortants: null as Sortants | null };

// Copie d'une fenêtre de la page quittée, au premier plan, à sa place d'avant
function copier(s: Sortant, calque: HTMLElement, o: DOMRect, classe: string) {
  const copie = s.el.cloneNode(true) as HTMLElement;
  copie.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  copie.inert = true;
  copie.classList.add(classe);
  Object.assign(copie.style, { left: `${s.rect.left - o.left}px`, top: `${s.rect.top - o.top}px`, width: `${s.rect.width}px`, height: `${s.rect.height}px`, transition: 'none' });
  calque.append(copie);
  return copie;
}

// Fenêtres de la page quittée sans place ici, copiées par-dessus la page : les détachées s'effacent puis se referment entre leurs deux
// lignes jusqu'au trait du milieu ; les rangées, vidées, se replient vers leur bord extérieur pendant que la grande les suit
function sortir(holo: Sortant[], organiques: Sortant[], grande: DOMRect | null, ov: HTMLElement) {
  const calque = document.createElement('div');
  calque.className = 'dock fantomes';
  calque.dataset.pret = '1';
  calque.setAttribute('aria-hidden', 'true');
  ov.append(calque);
  const o = ov.getBoundingClientRect();
  for (const s of holo) {
    const copie = copier(s, calque, o, 'holo-ferme');
    copie.style.setProperty('--holo-delai', `${DUREES.effacer}ms`);
    effacer(copie, { duree: DUREES.effacer });
  }
  for (const s of organiques) {
    const copie = copier(s, calque, o, 'replie');
    const r = s.rect;
    const x = grande && r.left >= grande.right - 1 ? r.right + ECART : grande && r.right <= grande.left + 1 ? r.left - ECART : r.left + r.width / 2;
    void copie.offsetWidth;
    copie.style.transition = TRANSITION;
    Object.assign(copie.style, { left: `${x - o.left}px`, top: `${r.top + r.height / 2 - o.top}px`, width: '0px', height: '0px' });
  }
  window.setTimeout(() => calque.remove(), Math.max(holo.length ? DUREES.effacer + DUREES.fermer : 0, DUREE_RANGEMENT) + 60);
}

// D'une page à l'autre, l'Activité, commune à toutes, glisse de sa place d'avant à la sienne. Les autres fenêtres, selon ce qu'elles sont :
// - détachées : celles de la page quittée se referment, puis celles d'ici s'ouvrent, en holographique ;
// - rangées : la plus grande de la page quittée devient la plus grande d'ici, et ainsi de suite ; chacune glisse et seul son contenu change ;
//   une rangée en trop se replie, une qui manque se déplie, pendant que les autres prennent ou rendent la place (organique)
function passer({ fenetres }: Sortants, coq: HTMLElement, m: Moteur): Passage {
  const passage: Passage = { delai: 0, modes: new Map() };
  if (mouvementReduit()) return passage;
  // Fenêtre fermée ici (data-fermee), même si elle s'affiche encore le temps de se replier : elle n'est pas de la page
  const vue = (el: HTMLElement) => !el.hidden && el.dataset.fermee === undefined && getComputedStyle(el).visibility !== 'hidden';
  const aire = (r: DOMRect) => r.width * r.height;
  const c = coq.getBoundingClientRect();
  const zone = (r: DOMRect): Zone => ({ x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height });
  const ici = Array.from(coq.querySelectorAll<HTMLElement>('[data-fen]')).filter(vue);
  const avant = fenetres.filter((s) => s.vue);
  const depuis: Record<string, Zone> = {};
  const holo: Sortant[] = [], organiques: Sortant[] = [];
  for (const s of avant.filter((x) => x.passage === 'fixe')) if (ici.some((el) => el.dataset.fen === s.id)) depuis[s.id] = zone(s.rect);
  for (const s of avant) if (s.passage !== 'fixe' && s.flot) holo.push(s);
  for (const el of ici) if (el.dataset.passage !== 'fixe' && el.dataset.flot) passage.modes.set(el.dataset.fen!, 'holo');
  const rangeesAvant = avant.filter((s) => s.passage !== 'fixe' && !s.flot).sort((a, b) => aire(b.rect) - aire(a.rect));
  const rangeesIci = ici.filter((el) => el.dataset.passage !== 'fixe' && !el.dataset.flot).sort((a, b) => aire(b.getBoundingClientRect()) - aire(a.getBoundingClientRect()));
  rangeesIci.forEach((el, i) => {
    const s = rangeesAvant[i];
    if (s) depuis[el.dataset.fen!] = zone(s.rect);
    passage.modes.set(el.dataset.fen!, s ? 'ecrit' : 'organique');
  });
  // Rangées en trop : le panneau, fermé ici, se replie de lui-même ; une autre, sa copie
  for (const s of rangeesAvant.slice(rangeesIci.length)) if (!coq.querySelector(`[data-fen="${s.id}"][data-fermee][data-passage="ecrit"]`)) organiques.push(s);
  // Fermée ici mais vue sur la page quittée, détachée ou relayée par une autre : elle se cache aussitôt, sans se replier
  for (const s of [...holo, ...rangeesAvant.slice(0, rangeesIci.length)]) {
    if (coq.querySelector(`[data-fen="${s.id}"][data-fermee]`) && !passage.modes.has(s.id)) passage.modes.set(s.id, 'cache');
  }
  if (Object.keys(depuis).length) m.ranger(true, { depuis });
  const ov = coq.closest<HTMLElement>('.ov');
  if (ov && (holo.length || organiques.length)) sortir(holo, organiques, rangeesAvant[0]?.rect ?? null, ov);
  if (holo.length) passage.delai = DUREES.effacer + DUREES.fermer;
  return passage;
}

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
  const attente = useRef<(() => void)[]>([]);
  const prevu = useRef<Passage>({ delai: 0, modes: new Map() });
  const [avant] = useState(() => (Object.keys(DOCK.visibles).length ? { ...DOCK.visibles } : null));
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
    const coq = coquille.current!;
    const m = installerDock(coq, {
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
    const sortants = DOCK.sortants;
    DOCK.sortants = null;
    // Le même dock remonté (mode strict, rechargement à chaud) n'est pas un changement de page : ce qu'il a prévu reste
    if (sortants && sortants.page !== id) prevu.current = passer(sortants, coq, m);
    const enAttente = attente.current;
    attente.current = [];
    enAttente.forEach((f) => f());
    return () => {
      // Avant que la page parte : ses fenêtres et leur place, pour la page qui arrive dans le même rendu ; oubliées ensuite
      const fenetres = Array.from(coq.querySelectorAll<HTMLElement>('[data-fen]')).map((el) => {
        const s = getComputedStyle(el);
        return { id: el.dataset.fen!, passage: el.dataset.passage ?? 'fondu', vue: !el.hidden && s.display !== 'none' && s.visibility !== 'hidden', flot: el.dataset.flot === '1', rect: el.getBoundingClientRect(), el };
      });
      DOCK.sortants = { page: id, fenetres };
      queueMicrotask(() => { DOCK.sortants = null; });
      m.detruire();
      moteur.current = null;
      DOCK.visibles = {};
    };
  }, [id]);

  const ranger = useCallback((anime = true, options?: OptionsRangement) => moteur.current?.ranger(anime, options), []);
  const quandPose = useCallback((f: () => void) => {
    if (moteur.current) f();
    else attente.current.push(f);
  }, []);

  // Autre onglet du panneau ouvert : la fenêtre reste, sa vue s'efface puis la nouvelle s'écrit ; rien ne change de taille
  const ongletPose = useRef(onglet);
  const echange = useRef<{ efface: Controle | null; ecrit: Controle | null; minuteur: number; aEcrire: boolean }>({ efface: null, ecrit: null, minuteur: 0, aEcrire: false });
  const arreterEchange = useCallback(() => {
    const e = echange.current;
    clearTimeout(e.minuteur);
    e.efface?.annuler();
    e.ecrit?.annuler();
    Object.assign(e, { efface: null, ecrit: null, aEcrire: false });
  }, []);
  const ouvrir = useCallback((cle: string) => {
    arreterEchange();
    const actuel = ongletPose.current;
    const vue = actuel !== null && actuel !== cle && !mouvementReduit() ? coquille.current?.querySelector('.panneau:not([hidden]) .p-vue.ouverte') : null;
    if (!vue) {
      setOnglet(cle);
      return;
    }
    const e = echange.current;
    e.efface = effacer(vue, { duree: DUREES.effacer });
    e.minuteur = window.setTimeout(() => {
      e.aEcrire = true;
      setOnglet(cle);
    }, DUREES.effacer);
  }, [arreterEchange]);
  const fermer = useCallback(() => {
    arreterEchange();
    setOnglet(null);
  }, [arreterEchange]);
  useLayoutEffect(() => {
    ongletPose.current = onglet;
    const e = echange.current;
    if (!e.aEcrire) return;
    e.aEcrire = false;
    // L'ancienne vue, cachée maintenant, retrouve son texte avant d'être peinte
    e.efface?.annuler();
    e.efface = null;
    const vue = coquille.current?.querySelector('.panneau .p-vue.ouverte');
    if (vue) e.ecrit = ecrire(vue, { duree: DUREES.contenu });
  }, [onglet]);
  useLayoutEffect(() => arreterEchange, [arreterEchange]);

  const prevue = useCallback((cle: string) => ({ mode: prevu.current.modes.get(cle), delai: prevu.current.delai }), []);
  const valeur = useMemo(() => ({ ranger, quandPose, avant, prevue, onglet, ouvrir, fermer }), [ranger, quandPose, avant, prevue, onglet, ouvrir, fermer]);

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
  // D'une page à l'autre (le dock choisit, voir `passer`) : 'fixe', commune à toutes les pages (Activité), elle glisse toujours à sa place ;
  // 'ecrit', gardée (panneau), fermée ici elle se replie d'elle-même ; 'fondu', propre à sa page (par défaut)
  passage?: 'fixe' | 'fondu' | 'ecrit';
};

type EnCours = { tour: number; anims: Controle[]; minuteurs: number[]; sortie: 'non' | 'efface' | 'replie' };

// Une fenêtre du dock : verre, prise, poignées de taille ; cachée, elle garde sa place dans l'arbre pour la retrouver.
// Fermée, ses éléments s'effacent puis elle se replie vers son bord pendant que sa voisine la suit ; ouverte, l'inverse, puis son texte s'écrit.
export function Fenetre({ id, as: Balise = 'section', className, titrePrise = 'Glisser pour détacher la fenêtre', hidden = false, passage = 'fondu', children, ...reste }: ProprietesFenetre) {
  const { ranger, quandPose, avant, prevue } = useContexte();
  const el = useRef<HTMLElement | null>(null);
  const poserEl = useCallback((n: HTMLElement | null) => {
    el.current = n;
  }, []);
  // D'une page à l'autre, une fenêtre gardée part de ce qu'on voyait : ouverte avant et fermée ici, elle se replie
  const [cachee, setCachee] = useState(() => (avant?.[id] && passage !== 'fondu' ? false : hidden));
  // État au montage ; `change` : `hidden` a bougé depuis, ce n'est plus l'arrivée sur la page
  const depart = useRef({ avant, cachee, hidden, change: false });
  const cacheeVue = useRef(cachee);
  const entrante = useRef(false);
  const enCours = useRef<EnCours>({ tour: 0, anims: [], minuteurs: [], sortie: 'non' });

  // Arrête le passage en cours : textes rendus, minuteurs oubliés ; le tour suivant ne laisse finir que les siens
  const arreter = useCallback(() => {
    const e = enCours.current;
    e.anims.forEach((c) => c.annuler());
    e.minuteurs.forEach((m) => clearTimeout(m));
    Object.assign(e, { tour: e.tour + 1, anims: [], minuteurs: [], sortie: 'non' });
    if (el.current) {
      el.current.inert = false;
      el.current.classList.remove('holo-ouvre');
    }
    return e.tour;
  }, []);
  const plus = useCallback((tour: number, f: () => void, apres: number) => {
    const e = enCours.current;
    e.minuteurs.push(window.setTimeout(() => { if (e.tour === tour) f(); }, apres));
  }, []);

  // Arrivée d'une autre page, la fenêtre ouverte ici (l'Activité, le dock la fait glisser) : ce que le dock a prévu selon les deux pages.
  // Son verre gardé, seul son contenu s'écrit ; organique, elle se déplie pendant que la grande rend la place, puis son texte s'écrit ;
  // holographique, elle s'ouvre comme à l'arrivée dans Illusion une fois refermées celles de la page quittée, puis son texte s'écrit
  useLayoutEffect(() => {
    const d = depart.current;
    if (!d.avant || d.cachee || d.hidden || passage === 'fixe' || mouvementReduit()) return;
    const e = enCours.current, tour = e.tour;
    quandPose(() => {
      if (e.tour !== tour || !el.current) return;
      const { mode = 'holo', delai } = prevue(id);
      if (mode === 'ecrit') {
        e.anims.push(ecrire(el.current, { duree: DUREES.contenu }));
      } else if (mode === 'organique') {
        ranger(true, { entrees: [id] });
        e.anims.push(voiler(el.current, DUREE_RANGEMENT + 60));
        plus(tour, () => {
          if (!el.current) return;
          e.anims.forEach((c) => c.annuler());
          e.anims = [ecrire(el.current, { duree: DUREES.contenu })];
        }, DUREE_RANGEMENT);
      } else {
        el.current.style.setProperty('--holo-delai', `${delai}ms`);
        el.current.classList.add('holo-ouvre');
        e.anims.push(ecrire(el.current, { duree: DUREES.ouverture, delai: delai + DUREES.ouvrir }));
        plus(tour, () => el.current?.classList.remove('holo-ouvre'), delai + DUREES.ouvrir + 50);
      }
    });
  }, [id, passage, quandPose, prevue, ranger, plus]);

  useLayoutEffect(() => {
    const e = enCours.current;
    if (hidden !== depart.current.hidden) depart.current.change = true;
    if (hidden) {
      if (cacheeVue.current || e.sortie !== 'non') return;
      if (mouvementReduit()) {
        setCachee(true);
        return;
      }
      // Arrivée sur une page où elle est fermée : rien à effacer, ce contenu-là n'a pas été vu
      const arrivee = !depart.current.change;
      const tour = arreter();
      e.sortie = 'efface';
      quandPose(() => {
        if (e.tour !== tour || !el.current) return;
        // Changement de page où sa place d'avant est reprise par une autre, ou détachée (sa copie se referme) : elle se cache aussitôt
        if (arrivee && prevue(id).mode === 'cache') {
          e.sortie = 'non';
          setCachee(true);
          return;
        }
        el.current.inert = true;
        const replier = () => {
          e.sortie = 'replie';
          ranger(true, { sortie: id });
          plus(tour, () => {
            e.sortie = 'non';
            setCachee(true);
          }, DUREE_RANGEMENT + 20);
        };
        if (arrivee) {
          e.anims.push(voiler(el.current, DUREE_RANGEMENT + 60));
          replier();
        } else {
          e.anims.push(effacer(el.current, { duree: DUREES.effacer }));
          plus(tour, replier, DUREES.effacer);
        }
      });
      return;
    }
    if (cacheeVue.current) {
      arreter();
      entrante.current = !mouvementReduit();
      setCachee(false);
      return;
    }
    if (e.sortie === 'non') return;
    // Rouverte pendant qu'elle se fermait : elle revient de là où elle en est, son contenu se réécrit
    const replie = e.sortie === 'replie';
    arreter();
    if (replie) ranger(true, { entrees: [id] });
    if (el.current) e.anims.push(ecrire(el.current, { duree: DUREES.contenu, delai: replie ? DUREE_RANGEMENT : 0 }));
  }, [hidden, id, ranger, quandPose, prevue, arreter, plus]);

  // Montrée : rangée avant d'être peinte, en se dépliant si elle vient de s'ouvrir ; retirée : rangée une fois sortie de la page
  useLayoutEffect(() => {
    cacheeVue.current = cachee;
    DOCK.visibles[id] = !cachee;
    if (cachee || !entrante.current) ranger();
    else {
      entrante.current = false;
      const e = enCours.current, tour = arreter();
      quandPose(() => {
        if (e.tour !== tour || !el.current) return;
        ranger(true, { entrees: [id] });
        e.anims.push(voiler(el.current, DUREE_RANGEMENT + 60));
        plus(tour, () => {
          if (!el.current) return;
          e.anims.forEach((c) => c.annuler());
          e.anims = [ecrire(el.current, { duree: DUREES.contenu })];
        }, DUREE_RANGEMENT);
      });
    }
    return () => {
      requestAnimationFrame(() => ranger());
    };
  }, [cachee, id, ranger, quandPose, arreter, plus]);

  useLayoutEffect(() => () => {
    arreter();
    delete DOCK.visibles[id];
  }, [arreter, id]);

  return (
    <Balise ref={poserEl} data-fen={id} data-passage={passage} data-fermee={hidden || undefined} className={`verre${className ? ' ' + className : ''}`} hidden={cachee} {...reste}>
      <span className="verre-halos" aria-hidden="true" />
      <span className="prise" title={titrePrise} aria-hidden="true" />
      {children}
      <span className="taille d" data-taille="d" aria-hidden="true" />
      <span className="taille b" data-taille="b" aria-hidden="true" />
      <span className="taille c" data-taille="c" aria-hidden="true" />
      {/* Ouverture : deux lignes nées au milieu, qui s'étirent puis s'écartent vers le haut et le bas */}
      <span className="ouv-ligne" aria-hidden="true" />
      <span className="ouv-ligne" aria-hidden="true" />
    </Balise>
  );
}
