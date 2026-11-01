'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DUREES, ecrire, effacer, mouvementReduit, voiler, type Controle } from '../partage/glyphes';
import { aOublier } from '../stockage';
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

// Passage d'une fenêtre d'une page à l'autre : elle se ferme ou s'ouvre en holographique, se replie ou se déplie (organique), ou garde son verre et seul son contenu change
type Mode = 'holo' | 'organique' | 'ecrit';

// Fenêtre d'éléments (le panneau, puis celles du clic droit) : `objets` garde le dernier objet montré de chaque sorte (« fiche-offre » → clé de l'offre)
export type Vue = { id: string; cle: string | null; objets: Record<string, string>; serie: number; ferme?: boolean };
// Fenêtres en plus ; avec l'Activité, la grande fenêtre et le panneau, 8 fenêtres au plus, chacune à la place logique (moteur)
const EN_PLUS = ['panneau-2', 'panneau-3', 'panneau-4', 'panneau-5', 'panneau-6'];
// Fenêtres d'éléments de chaque page, retrouvées en y revenant
const GARDEES = new Map<string, { vues: Vue[]; focus: string }>();
aOublier(() => GARDEES.clear());

type ContexteDock = {
  ranger: (anime?: boolean, options?: OptionsRangement) => void;
  // Lancé une fois les fenêtres posées : tout de suite, ou juste après la première pose du dock qui arrive
  quandPose: (f: () => void) => void;
  // Fenêtres visibles sur la page quittée ; null à l'arrivée dans Illusion
  avant: Record<string, boolean> | null;
  // Ce que le changement de page prévoit pour une fenêtre (et d'où elle se déplie), et l'attente des ouvertures holographiques ; rien hors d'un changement de page
  prevue: (id: string) => { mode?: Mode; delai: number; depart?: Zone };
  onglet: string | null;
  // L'objet de l'élément montré par le panneau
  objet: string | null;
  // Un élément (sorte et objet) va dans la fenêtre en plus qui a le focus, sinon dans le panneau ; sans objet (réglages, ajout…), dans le panneau
  ouvrir: (cle: string, objet?: string) => void;
  fermer: () => void;
  // Fenêtres d'éléments et celle qui a le focus : elle reçoit le clic gauche ; un clic sur une fenêtre lui donne le focus
  vues: Vue[];
  focus: string;
  focaliser: (id: string) => void;
  fermerVue: (id: string) => void;
  // Clic droit : l'élément dans une nouvelle fenêtre (le panneau s'il est fermé) ; huit fenêtres ouvertes, dans celle qui a le focus
  ailleurs: (cle: string, objet: string) => void;
  // Le dock posé : une fenêtre qui apparaît ensuite se déplie
  posee: () => boolean;
};
const Contexte = createContext<ContexteDock | null>(null);

// Fenêtre de la page quittée : son passage, vue ou non, détachée ou non, sa place à l'écran
type Sortant = { id: string; passage: string; vue: boolean; flot: boolean; rect: DOMRect; el: HTMLElement };
type Sortants = { page: string; principal: string; fenetres: Sortant[] };
// Ce que prévoit le changement de page : l'attente des ouvertures holographiques, le mode de chaque fenêtre, d'où se déplient celles qui manquaient
type Passage = { delai: number; modes: Map<string, Mode>; departs: Map<string, Zone> };

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

// Fenêtres de la page quittée sans place ici, copiées par-dessus la page : les détachées se referment en holographique, les rangées se replient vers leur bord
function sortir(holo: Sortant[], organiques: [Sortant, Zone][], ov: HTMLElement) {
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
  for (const [s, z] of organiques) {
    const copie = copier(s, calque, o, 'replie');
    void copie.offsetWidth;
    copie.style.transition = TRANSITION;
    Object.assign(copie.style, { left: `${z.x - o.left}px`, top: `${z.y - o.top}px`, width: `${z.w}px`, height: `${z.h}px` });
  }
  window.setTimeout(() => calque.remove(), Math.max(holo.length ? DUREES.effacer + DUREES.fermer : 0, DUREE_RANGEMENT) + 60);
}

// D'une page à l'autre : l'Activité glisse à sa place ; les détachées se ferment puis s'ouvrent en holographique ; les rangées se relaient (voir `relais`)
function passer({ fenetres, principal: ancien }: Sortants, coq: HTMLElement, m: Moteur, principal: string): Passage {
  const passage: Passage = { delai: 0, modes: new Map(), departs: new Map() };
  if (mouvementReduit()) return passage;
  // Fenêtre fermée ici (data-fermee), même si elle s'affiche encore le temps de se replier : elle n'est pas de la page
  const vue = (el: HTMLElement) => !el.hidden && el.dataset.fermee === undefined && getComputedStyle(el).visibility !== 'hidden';
  const recouvre = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const aire = (r: DOMRect) => r.width * r.height;
  const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  // Deux places voisines au plus : elles se touchent, à l'écart près
  const proches = (a: DOMRect, b: DOMRect) => a.left <= b.right + ECART + 2 && b.left <= a.right + ECART + 2 && a.top <= b.bottom + ECART + 2 && b.top <= a.bottom + ECART + 2;
  // Le rôle d'une fenêtre d'une page à l'autre : la grande fenêtre, sinon son nom (le panneau, celle posée sous lui…)
  const role = (id: string, p: string) => (id === p ? '@principal' : id);
  const c = coq.getBoundingClientRect();
  const zone = (r: DOMRect): Zone => ({ x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height });
  const ici = Array.from(coq.querySelectorAll<HTMLElement>('[data-fen]')).filter(vue);
  const avant = fenetres.filter((s) => s.vue);
  const depuis: Record<string, Zone> = {};
  const holo: Sortant[] = [], organiques: [Sortant, Zone][] = [];
  for (const s of avant.filter((x) => x.passage === 'fixe')) if (ici.some((el) => el.dataset.fen === s.id)) depuis[s.id] = zone(s.rect);
  for (const s of avant) if (s.passage !== 'fixe' && s.flot) holo.push(s);
  for (const el of ici) if (el.dataset.passage !== 'fixe' && el.dataset.flot) passage.modes.set(el.dataset.fen!, 'holo');
  const rangeesAvant = avant.filter((s) => s.passage !== 'fixe' && !s.flot);
  const posees = ici.filter((el) => !el.dataset.flot).map((el) => ({ el, r: el.getBoundingClientRect() }));
  const rangeesIci = posees.filter(({ el }) => el.dataset.passage !== 'fixe');
  // Une rangée d'ici relaie, dans l'ordre : celle déjà à sa place, celle du même rôle à une place voisine, celle qui couvrait le plus sa place ; jamais à travers l'écran
  const relais = new Map<HTMLElement, Sortant>();
  const lier = (el: HTMLElement, s: Sortant) => { if (!relais.has(el) && ![...relais.values()].includes(s)) relais.set(el, s); };
  const paires = rangeesIci.flatMap(({ el, r }) => rangeesAvant.map((s) => ({ el, r, s, a: recouvre(r, s.rect) })));
  paires.filter((x) => x.a / (aire(x.r) + aire(x.s.rect) - x.a) >= 0.8).forEach(({ el, s }) => lier(el, s));
  paires.filter((x) => role(x.el.dataset.fen!, principal) === role(x.s.id, ancien) && proches(x.r, x.s.rect)).forEach(({ el, s }) => lier(el, s));
  paires.filter((x) => x.a > 0)
    .sort((x, y) => y.a - x.a || Math.hypot(x.r.left - x.s.rect.left, x.r.top - x.s.rect.top) - Math.hypot(y.r.left - y.s.rect.left, y.r.top - y.s.rect.top))
    .forEach(({ el, s }) => lier(el, s));
  for (const { el } of rangeesIci) {
    const s = relais.get(el);
    if (s) depuis[el.dataset.fen!] = zone(s.rect);
    passage.modes.set(el.dataset.fen!, s ? 'ecrit' : 'organique');
  }
  const relayees = [...relais.values()];
  // D'où vient chaque fenêtre d'ici : sa place sur la page quittée, sinon la sienne (elle s'y déplie)
  const origine = (el: HTMLElement, r: DOMRect) => relais.get(el)?.rect ?? avant.find((x) => x.passage === 'fixe' && x.id === el.dataset.fen)?.rect ?? r;
  // Part de [min, max] que balaie un bord allant de `de` à `a`
  const balaye = (de: number, a: number, min: number, max: number) => Math.max(0, Math.min(Math.max(de, a), max) - Math.max(Math.min(de, a), min)) / (max - min || 1);
  // Réduite à zéro sans bouger vers le bord (le coin si les deux poussées se valent) où la poussent vx et vy ; sans poussée, vers le bord de l'écran le plus proche, seule vers son centre
  const replie = (r: DOMRect, vx: number, vy: number, seule: boolean): Zone => {
    const fort = Math.max(Math.abs(vx), Math.abs(vy)) * 0.6, v = fort && Math.abs(vy) >= fort ? Math.sign(vy) : 0;
    let h = fort && Math.abs(vx) >= fort ? Math.sign(vx) : 0;
    if (!h && !v) {
      if (seule) return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: 0, h: 0 };
      h = centre(r).x < c.left + c.width / 2 ? -1 : 1;
    }
    return { x: h > 0 ? r.right : r.left, y: v > 0 ? r.bottom : r.top, w: h ? 0 : r.width, h: v ? 0 : r.height };
  };
  // Une rangée sans relais se replie du côté où la poussent les bords des fenêtres qui balaient sa place
  for (const s of rangeesAvant) {
    if (relayees.includes(s)) continue;
    const r = s.rect;
    let vx = 0, vy = 0;
    for (const { el, r: n } of posees) {
      if (!recouvre(r, n)) continue;
      const d = origine(el, n);
      if (n.right > d.right) vx += balaye(d.right, n.right, r.left, r.right);
      if (n.left < d.left) vx -= balaye(n.left, d.left, r.left, r.right);
      if (n.bottom > d.bottom) vy += balaye(d.bottom, n.bottom, r.top, r.bottom);
      if (n.top < d.top) vy -= balaye(n.top, d.top, r.top, r.bottom);
    }
    organiques.push([s, replie(r, vx, vy, rangeesAvant.length === 1)]);
  }
  // Une rangée qui manquait se déplie depuis le bord d'où reculent les fenêtres qui occupaient sa place ; sans elles, depuis son bord dans l'arbre
  const donneuses = posees.flatMap(({ el, r: n }) => (origine(el, n) === n ? [] : [{ d: origine(el, n), n }]));
  for (const { el, r } of rangeesIci) {
    if (relais.has(el)) continue;
    let vx = 0, vy = 0;
    for (const { d, n } of donneuses) {
      if (!recouvre(r, d)) continue;
      if (n.right < d.right) vx += balaye(n.right, d.right, r.left, r.right);
      if (n.left > d.left) vx -= balaye(d.left, n.left, r.left, r.right);
      if (n.bottom < d.bottom) vy += balaye(n.bottom, d.bottom, r.top, r.bottom);
      if (n.top > d.top) vy -= balaye(d.top, n.top, r.top, r.bottom);
    }
    if (!vx && !vy) continue;
    const z = replie(r, vx, vy, false);
    passage.departs.set(el.dataset.fen!, { x: z.x - c.left, y: z.y - c.top, w: z.w, h: z.h });
  }
  if (Object.keys(depuis).length) m.ranger(true, { depuis });
  const ov = coq.closest<HTMLElement>('.ov');
  if (ov && (holo.length || organiques.length)) sortir(holo, organiques, ov);
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

// Onglet ouvert du panneau de la page et l'objet qu'il montre ; ouvrir depuis n'importe où choisit l'élément et montre sa fenêtre
export function usePanneau() {
  const { onglet, objet, ouvrir, fermer } = useContexte();
  return { onglet, objet, ouvrir, fermer };
}

// Pour le panneau : ses fenêtres d'éléments et leur focus
export function useVues() {
  const { vues, focus, focaliser, fermerVue, ailleurs } = useContexte();
  return { vues, focus, focaliser, fermerVue, ailleurs };
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
  const prevu = useRef<Passage>({ delai: 0, modes: new Map(), departs: new Map() });
  const [avant] = useState(() => (Object.keys(DOCK.visibles).length ? { ...DOCK.visibles } : null));
  const pose = useRef(false);
  // Le panneau, première fenêtre d'éléments, puis celles ouvertes au clic droit ; celle qui a le focus reçoit le clic gauche
  const [gardees] = useState(() => GARDEES.get(id));
  const [vues, setVues] = useState<Vue[]>(() => gardees?.vues.filter((v) => !v.ferme) ?? [{ id: 'panneau', cle: panneau, objets: {}, serie: 0 }]);
  const [focus, setFocus] = useState(() => (gardees && vues.some((v) => v.id === gardees.focus) ? gardees.focus : 'panneau'));
  const onglet = vues[0].cle;
  const objet = (onglet && vues[0].objets[onglet]) ?? null;
  const etat = useRef({ vues, focus });
  useLayoutEffect(() => {
    etat.current = { vues, focus };
    GARDEES.set(id, { vues, focus });
  });
  // Le panneau change d'élément ; sans objet, il reprend le dernier de cette sorte
  const setOnglet = useCallback((cle: string | null, objet?: string) => setVues((v) => [
    { ...v[0], cle, objets: cle && objet !== undefined ? { ...v[0].objets, [cle]: objet } : v[0].objets, serie: v[0].serie + 1 }, ...v.slice(1),
  ]), []);
  // Le moteur relit toujours les dernières propriétés sans se réinstaller ; les tailles données complètent celles par défaut
  const proprietes = useRef({ principal, arbre, prises, tailles: {} as Record<string, DefFenetre> });
  useLayoutEffect(() => {
    const tailles: Record<string, DefFenetre> = { activite: TAILLES_ACTIVITE, panneau: TAILLES_PANNEAU, [principal]: TAILLES_PRINCIPALE };
    for (const f of EN_PLUS) tailles[f] = TAILLES_PANNEAU;
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
      elements: (fen) => EN_PLUS.includes(fen),
    });
    moteur.current = m;
    const sortants = DOCK.sortants;
    DOCK.sortants = null;
    // Le même dock remonté (mode strict, rechargement à chaud) n'est pas un changement de page : ce qu'il a prévu reste
    if (sortants && sortants.page !== id) prevu.current = passer(sortants, coq, m, p().principal);
    const enAttente = attente.current;
    attente.current = [];
    enAttente.forEach((f) => f());
    pose.current = true;
    return () => {
      // Avant que la page parte : ses fenêtres et leur place, pour la page qui arrive dans le même rendu ; oubliées ensuite
      const fenetres = Array.from(coq.querySelectorAll<HTMLElement>('[data-fen]')).map((el) => {
        const s = getComputedStyle(el);
        return { id: el.dataset.fen!, passage: el.dataset.passage ?? 'fondu', vue: !el.hidden && s.display !== 'none' && s.visibility !== 'hidden', flot: el.dataset.flot === '1', rect: el.getBoundingClientRect(), el };
      });
      DOCK.sortants = { page: id, principal: p().principal, fenetres };
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

  // Autre élément du panneau ouvert : la fenêtre reste, sa vue s'efface puis la nouvelle s'écrit ; rien ne change de taille
  const montre = onglet === null ? null : `${onglet} ${objet ?? ''}`;
  const montrePose = useRef(montre);
  const echange = useRef<{ efface: Controle | null; ecrit: Controle | null; minuteur: number; aEcrire: boolean }>({ efface: null, ecrit: null, minuteur: 0, aEcrire: false });
  const arreterEchange = useCallback(() => {
    const e = echange.current;
    clearTimeout(e.minuteur);
    e.efface?.annuler();
    e.ecrit?.annuler();
    Object.assign(e, { efface: null, ecrit: null, aEcrire: false });
  }, []);
  const ouvrirPanneau = useCallback((cle: string, objet?: string) => {
    arreterEchange();
    setFocus('panneau');
    const actuel = montrePose.current;
    const suivant = `${cle} ${objet ?? etat.current.vues[0].objets[cle] ?? ''}`;
    const vue = actuel !== null && actuel !== suivant && !mouvementReduit() ? coquille.current?.querySelector('[data-fen="panneau"]:not([hidden]) .p-vue.ouverte') : null;
    if (!vue) {
      setOnglet(cle, objet);
      return;
    }
    const e = echange.current;
    e.efface = effacer(vue, { duree: DUREES.effacer });
    e.minuteur = window.setTimeout(() => {
      e.aEcrire = true;
      setOnglet(cle, objet);
    }, DUREES.effacer);
  }, [arreterEchange, setOnglet]);

  // Un élément dans une fenêtre en plus, nouvelle ou déjà là : elle prend le focus
  const poserVue = useCallback((cible: string, cle: string, objet: string) => {
    setFocus(cible);
    setVues((v) => {
      const avantCible = v.find((x) => x.id === cible);
      const nouvelle = { id: cible, cle, objets: { ...avantCible?.objets, [cle]: objet }, serie: (avantCible?.serie ?? 0) + 1 };
      return avantCible ? v.map((x) => (x.id === cible ? nouvelle : x)) : [...v, nouvelle];
    });
  }, []);
  // Fenêtre en plus pour un clic droit : une place libre, sinon (8 fenêtres) celle en focus
  const placeLibre = useCallback(() => {
    const { vues: v, focus: f } = etat.current;
    return EN_PLUS.find((x) => !v.some((y) => y.id === x)) ?? v.find((x) => x.id === f && x.id !== 'panneau' && !x.ferme)?.id ?? null;
  }, []);

  const ouvrir = useCallback((cle: string, objet?: string) => {
    const { vues: v, focus: f } = etat.current;
    const enFocus = v.find((x) => x.id === f && x.id !== 'panneau' && !x.ferme)?.id;
    if (objet !== undefined && enFocus) poserVue(enFocus, cle, objet);
    else ouvrirPanneau(cle, objet);
  }, [ouvrirPanneau, poserVue]);

  const ailleurs = useCallback((cle: string, objet: string) => {
    const cible = etat.current.vues[0].cle === null ? null : placeLibre();
    if (cible) poserVue(cible, cle, objet);
    else ouvrirPanneau(cle, objet);
  }, [ouvrirPanneau, placeLibre, poserVue]);

  const fermerVue = useCallback((cible: string) => {
    if (cible === 'panneau') {
      arreterEchange();
      setOnglet(null);
      return;
    }
    setVues((v) => v.map((x) => (x.id === cible ? { ...x, ferme: true } : x)));
    // Le focus revient à la dernière fenêtre en plus encore ouverte, sinon au panneau ; repliée, la fenêtre quitte la page
    const reste = [...etat.current.vues].reverse().find((x) => x.id !== cible && x.id !== 'panneau' && !x.ferme);
    setFocus((f) => (f === cible ? reste?.id ?? 'panneau' : f));
    window.setTimeout(() => setVues((v) => v.filter((x) => x.id !== cible)), DUREES.effacer + DUREE_RANGEMENT + 80);
  }, [arreterEchange, setOnglet]);
  // Fermer depuis un élément : la fenêtre en focus, celle où l'on vient de cliquer
  const fermer = useCallback(() => fermerVue(etat.current.vues.some((x) => x.id === etat.current.focus && !x.ferme) ? etat.current.focus : 'panneau'), [fermerVue]);

  // Clic droit sur un ouvreur (`data-ouvre` : la sorte, `data-objet` : l'objet) : l'élément dans une nouvelle fenêtre ; ailleurs, le menu du navigateur
  const surMenu = useCallback((e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const cible = t.closest<HTMLElement>('[data-ouvre][data-objet]:not([data-objet=""])');
    const commande = t.closest('a[target],button,input,select,textarea,label,summary');
    if (!cible || (commande && commande !== cible && cible.contains(commande))) return;
    e.preventDefault();
    ailleurs(cible.dataset.ouvre!, cible.dataset.objet!);
  }, [ailleurs]);
  useLayoutEffect(() => {
    montrePose.current = montre;
    const e = echange.current;
    if (!e.aEcrire) return;
    e.aEcrire = false;
    // L'ancienne vue, cachée maintenant, retrouve son texte avant d'être peinte
    e.efface?.annuler();
    e.efface = null;
    const vue = coquille.current?.querySelector('[data-fen="panneau"] .p-vue.ouverte');
    if (vue) e.ecrit = ecrire(vue, { duree: DUREES.contenu });
  }, [montre]);
  useLayoutEffect(() => arreterEchange, [arreterEchange]);

  const prevue = useCallback((cle: string) => ({ mode: prevu.current.modes.get(cle), delai: prevu.current.delai, depart: prevu.current.departs.get(cle) }), []);
  const posee = useCallback(() => pose.current, []);
  const valeur = useMemo(
    () => ({ ranger, quandPose, avant, prevue, onglet, objet, ouvrir, fermer, vues, focus, focaliser: setFocus, fermerVue, ailleurs, posee }),
    [ranger, quandPose, avant, prevue, onglet, objet, ouvrir, fermer, vues, focus, fermerVue, ailleurs, posee],
  );

  return (
    <Contexte.Provider value={valeur}>
      <div ref={coquille} className="coquille dock" onContextMenu={surMenu}>
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
  // 'ecrit', gardée (panneau) ; 'fondu', propre à sa page (par défaut)
  passage?: 'fixe' | 'fondu' | 'ecrit';
};

type EnCours = { tour: number; anims: Controle[]; minuteurs: number[]; sortie: 'non' | 'efface' | 'replie' };

// Une fenêtre du dock : verre, prise, poignées de taille ; cachée, elle garde sa place dans l'arbre pour la retrouver.
// Fermée, ses éléments s'effacent puis elle se replie vers son bord pendant que sa voisine la suit ; ouverte, l'inverse, puis son texte s'écrit.
export function Fenetre({ id, as: Balise = 'section', className, titrePrise = 'Glisser pour détacher la fenêtre', hidden = false, passage = 'fondu', children, ...reste }: ProprietesFenetre) {
  const { ranger, quandPose, avant: avantDock, prevue, posee } = useContexte();
  // Apparue une fois le dock posé (une fenêtre en plus), elle n'arrive pas d'une autre page
  const [avant] = useState(() => (posee() ? null : avantDock));
  const el = useRef<HTMLElement | null>(null);
  const poserEl = useCallback((n: HTMLElement | null) => {
    el.current = n;
  }, []);
  // Apparue une fois le dock posé, elle part cachée pour se déplier ; fermée ici, cachée aussi (celle de la page quittée sort par sa copie)
  const [cachee, setCachee] = useState(() => posee() || hidden);
  // État au montage
  const depart = useRef({ avant, cachee, hidden });
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
      const { mode = 'holo', delai, depart } = prevue(id);
      if (mode === 'ecrit') {
        e.anims.push(ecrire(el.current, { duree: DUREES.contenu }));
      } else if (mode === 'organique') {
        ranger(true, depart ? { depuis: { [id]: depart } } : { entrees: [id] });
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
    if (hidden) {
      if (cacheeVue.current || e.sortie !== 'non') return;
      if (mouvementReduit()) {
        setCachee(true);
        return;
      }
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
        e.anims.push(effacer(el.current, { duree: DUREES.effacer }));
        plus(tour, replier, DUREES.effacer);
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
