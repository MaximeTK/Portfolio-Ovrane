'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DUREES, ecrire, effacer, mouvementReduit, voiler, type Controle } from '../partage/glyphes';
import { DUREE_RANGEMENT, ECART, PRISES, installerDock, type ArbreDepart, type DefFenetre, type Moteur, type OptionsRangement, type Zone } from './moteur';

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

type ContexteDock = {
  ranger: (anime?: boolean, options?: OptionsRangement) => void;
  // Lancé une fois les fenêtres posées : tout de suite, ou juste après la première pose du dock qui arrive
  quandPose: (f: () => void) => void;
  // Fenêtres visibles sur la page quittée ; null à l'arrivée dans Illusion
  avant: Record<string, boolean> | null;
  // Attente avant l'ouverture des fenêtres de la page, le temps que celles de la page quittée se referment
  delaiOuverture: () => number;
  onglet: string | null;
  ouvrir: (cle: string) => void;
  fermer: () => void;
};
const Contexte = createContext<ContexteDock | null>(null);

// Fenêtre de la page quittée : gardée d'une page à l'autre ou propre à sa page, vue ou non, sa place à l'écran
type Sortant = { id: string; garde: boolean; vue: boolean; rect: DOMRect; el: HTMLElement };

// Fenêtres visibles du dock monté : celui de la page suivante les lit au premier rendu, quand l'ancien est encore là ;
// `sortants` : les fenêtres du dock démonté et sa page, lues par le suivant dans le même rendu
const DOCK = { visibles: {} as Record<string, boolean>, sortants: null as { page: string; fenetres: Sortant[] } | null };

// Fenêtres de la page quittée sans place ici : copiées sous la page, leurs éléments s'effacent, puis elles se referment entre
// leurs deux lignes jusqu'au trait du milieu (fermeture holographique)
function fermerHolo(fermees: Sortant[], ov: HTMLElement) {
  const calque = document.createElement('div');
  calque.className = 'dock fantomes';
  calque.dataset.pret = '1';
  calque.setAttribute('aria-hidden', 'true');
  const o = ov.getBoundingClientRect();
  for (const s of fermees) {
    const copie = s.el.cloneNode(true) as HTMLElement;
    copie.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    copie.inert = true;
    Object.assign(copie.style, { left: `${s.rect.left - o.left}px`, top: `${s.rect.top - o.top}px`, width: `${s.rect.width}px`, height: `${s.rect.height}px`, transition: 'none' });
    copie.style.setProperty('--holo-delai', `${DUREES.effacer}ms`);
    calque.append(copie);
  }
  ov.append(calque);
  for (const copie of calque.children) effacer(copie, { duree: DUREES.effacer });
  window.setTimeout(() => calque.remove(), DUREES.effacer + DUREES.fermer + 60);
}

// D'une page à l'autre : les fenêtres gardées et ouvertes ici glissent de leur place d'avant à la leur, les autres de la page quittée
// se referment ; rend l'attente des fenêtres qui s'ouvrent ensuite
function passer(sortants: Sortant[], coq: HTMLElement, m: Moteur): number {
  if (mouvementReduit()) return 0;
  const arrivees = new Map(Array.from(coq.querySelectorAll<HTMLElement>('[data-fen]')).map((el) => [el.dataset.fen!, el]));
  const c = coq.getBoundingClientRect();
  const depuis: Record<string, Zone> = {};
  const fermees: Sortant[] = [];
  for (const s of sortants) {
    if (!s.vue) continue;
    const ici = arrivees.get(s.id);
    if (!s.garde || !ici || ici.dataset.passage === 'fondu') fermees.push(s);
    else if (!ici.hidden) depuis[s.id] = { x: s.rect.left - c.left, y: s.rect.top - c.top, w: s.rect.width, h: s.rect.height };
  }
  if (Object.keys(depuis).length) m.ranger(true, { depuis });
  const ov = coq.closest<HTMLElement>('.ov');
  if (!fermees.length || !ov) return 0;
  fermerHolo(fermees, ov);
  return DUREES.effacer + DUREES.fermer;
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
  const delai = useRef(0);
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
    // Le même dock remonté (mode strict, rechargement à chaud) n'est pas un changement de page : son attente reste
    if (sortants && sortants.page !== id) delai.current = passer(sortants.fenetres, coq, m);
    const enAttente = attente.current;
    attente.current = [];
    enAttente.forEach((f) => f());
    return () => {
      // Avant que la page parte : ses fenêtres et leur place, pour la page qui arrive dans le même rendu ; oubliées ensuite
      const fenetres = Array.from(coq.querySelectorAll<HTMLElement>('[data-fen]')).map((el) => {
        const s = getComputedStyle(el);
        return { id: el.dataset.fen!, garde: el.dataset.passage !== 'fondu', vue: !el.hidden && s.display !== 'none' && s.visibility !== 'hidden', rect: el.getBoundingClientRect(), el };
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

  const delaiOuverture = useCallback(() => delai.current, []);
  const valeur = useMemo(() => ({ ranger, quandPose, avant, delaiOuverture, onglet, ouvrir, fermer }), [ranger, quandPose, avant, delaiOuverture, onglet, ouvrir, fermer]);

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
  // D'une page à l'autre : gardée, elle glisse à sa place, son contenu tel quel (Activité) ou réécrit en glyphes (panneau) ;
  // propre à sa page (par défaut), elle se referme puis celle de la page suivante s'ouvre, en holographique
  passage?: 'fixe' | 'fondu' | 'ecrit';
};

type EnCours = { tour: number; anims: Controle[]; minuteurs: number[]; sortie: 'non' | 'efface' | 'replie' };

// Une fenêtre du dock : verre, prise, poignées de taille ; cachée, elle garde sa place dans l'arbre pour la retrouver.
// Fermée, ses éléments s'effacent puis elle se replie vers son bord pendant que sa voisine la suit ; ouverte, l'inverse, puis son texte s'écrit.
export function Fenetre({ id, as: Balise = 'section', className, titrePrise = 'Glisser pour détacher la fenêtre', hidden = false, passage = 'fondu', children, ...reste }: ProprietesFenetre) {
  const { ranger, quandPose, avant, delaiOuverture } = useContexte();
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

  // Arrivée d'une autre page, la fenêtre gardée et restée ouverte : elle glisse à sa place (le dock s'en charge), le panneau réécrit son contenu
  useLayoutEffect(() => {
    const d = depart.current;
    if (!d.avant?.[id] || d.cachee || d.hidden || passage !== 'ecrit') return;
    const tour = enCours.current.tour;
    quandPose(() => {
      if (enCours.current.tour !== tour || !el.current) return;
      enCours.current.anims.push(ecrire(el.current, { duree: DUREES.contenu }));
    });
  }, [id, passage, quandPose]);

  // Arrivée d'une autre page, la fenêtre propre à celle-ci, ou gardée mais fermée sur la page quittée : elle s'ouvre comme à l'arrivée
  // dans Illusion, une fois refermées celles de la page quittée, puis son texte s'écrit (ouverture holographique)
  useLayoutEffect(() => {
    const d = depart.current;
    if (!d.avant || d.cachee || d.hidden || (d.avant[id] && passage !== 'fondu') || mouvementReduit()) return;
    const e = enCours.current, tour = e.tour;
    quandPose(() => {
      if (e.tour !== tour || !el.current) return;
      const attente = delaiOuverture();
      el.current.style.setProperty('--holo-delai', `${attente}ms`);
      el.current.classList.add('holo-ouvre');
      e.anims.push(ecrire(el.current, { duree: DUREES.ouverture, delai: attente + DUREES.ouvrir }));
      plus(tour, () => el.current?.classList.remove('holo-ouvre'), attente + DUREES.ouvrir + 50);
    });
  }, [id, passage, quandPose, delaiOuverture, plus]);

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
  }, [hidden, id, ranger, quandPose, arreter, plus]);

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
    <Balise ref={poserEl} data-fen={id} data-passage={passage} className={`verre${className ? ' ' + className : ''}`} hidden={cachee} {...reste}>
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
