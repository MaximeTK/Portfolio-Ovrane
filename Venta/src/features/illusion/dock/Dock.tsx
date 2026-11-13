'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DUREES, ecrire, effacer, mouvementReduit, voiler, type Controle } from '../partage/glyphes';
import { Verre } from '@/features/fenetres/Verre';
import { quitterSection } from '../api';
import { aOublier } from '../stockage';
import { DUREE_FLOTTANTE, DUREE_RANGEMENT, ECART, LENTEUR_FLOTTANTE, MARGE_GLISSE, PRISES, CONTENU, installerDock, poserFige, type ArbreDepart, type DefFenetre, type Moteur, type OptionsRangement, type Repli, type Zone } from './moteur';
export type { ArbreDepart } from './moteur';

// Tailles minimales, bande de bord d'écran et premier détachement des fenêtres
const TAILLES_ACTIVITE: DefFenetre = { mini: [200, 170], pref: [228, 240], flot: [300, 520] };
const TAILLES_PANNEAU: DefFenetre = { mini: [360, 220], pref: [440, 320], flot: [460, 560] };
const TAILLES_PRINCIPALE: DefFenetre = { mini: [470, 220], pref: [620, 360], flot: [760, 480] };
const LARGEUR_ACTIVITE = 228;

// Rangée de départ : Activité | fenêtre principale | panneau (--panneau)
const arbreDePage = (principal: string, miniPrincipal = TAILLES_PRINCIPALE.mini![0]): ArbreDepart => (zone, style) => {
  const lp = parseFloat(style.getPropertyValue('--panneau')) || 440;
  return {
    dir: 'row',
    enfants: [{ id: 'activite' }, { id: principal }, { id: 'panneau' }],
    parts: [LARGEUR_ACTIVITE, Math.max(zone.w - LARGEUR_ACTIVITE - lp - 2 * ECART, miniPrincipal), lp],
  };
};

// Passage de page : la fenêtre se ferme, s'ouvre ou garde son verre
type Mode = 'holo' | 'organique' | 'ecrit';

// Fenêtre d'éléments : `objets` garde le dernier objet montré de chaque sorte
export type Vue = { id: string; cle: string | null; objets: Record<string, string>; serie: number; ferme?: boolean };
// Fenêtres en plus : huit au plus avec l'Activité, la grande et le panneau
const EN_PLUS = ['panneau-2', 'panneau-3', 'panneau-4', 'panneau-5', 'panneau-6'];
// Fenêtres d'éléments de chaque page, retrouvées en y revenant
const GARDEES = new Map<string, { vues: Vue[]; focus: string }>();
aOublier(() => GARDEES.clear());

type ContexteDock = {
  ranger: (anime?: boolean, options?: OptionsRangement) => void;
  // Lancé une fois les fenêtres posées, ou juste après la première pose
  quandPose: (f: () => void) => void;
  // Fenêtres visibles sur la page quittée ; null à l'arrivée dans Illusion
  avant: Record<string, boolean> | null;
  // Ce que le changement de page prévoit pour une fenêtre ; rien sinon
  prevue: (id: string) => { mode?: Mode };
  onglet: string | null;
  // L'objet de l'élément montré par le panneau
  objet: string | null;
  // Un élément va dans la fenêtre en plus qui a le focus, sinon dans le panneau
  ouvrir: (cle: string, objet?: string) => void;
  fermer: () => void;
  // La fenêtre qui a le focus reçoit le clic gauche ; un clic lui donne le focus
  vues: Vue[];
  focus: string;
  focaliser: (id: string) => void;
  fermerVue: (id: string) => void;
  // Clic droit : l'élément dans une nouvelle fenêtre, à huit dans celle en focus
  ailleurs: (cle: string, objet: string) => void;
  // Le dock posé : une fenêtre qui apparaît ensuite se déplie
  posee: () => boolean;
};
const Contexte = createContext<ContexteDock | null>(null);

// Fenêtre de la page quittée : son passage, son état et sa place à l'écran
type Sortant = { id: string; passage: string; vue: boolean; flot: boolean; rect: DOMRect; copie: HTMLElement | null; enfants: DOMRect[]; defiles: number[][] };
type Sortants = { page: string; principal: string; fenetres: Sortant[] };
// Ce que prévoit le changement de page : le mode des fenêtres
type Passage = { modes: Map<string, Mode> };

// Fenêtres visibles du dock monté, lues par le suivant (`sortants` : démonté)
const DOCK = { visibles: {} as Record<string, boolean>, sortants: null as Sortants | null };

// Copie d'une fenêtre de la page quittée, au premier plan, à sa place d'avant
function copier(s: Sortant, calque: HTMLElement, o: DOMRect, classe: string) {
  const copie = s.copie!;
  copie.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  copie.inert = true;
  copie.classList.add(classe);
  copie.style.setProperty('--fw', `${s.rect.width}px`);
  copie.style.setProperty('--fh', `${s.rect.height}px`);
  Object.assign(copie.style, { left: `${s.rect.left - o.left}px`, top: `${s.rect.top - o.top}px`, width: `${s.rect.width}px`, height: `${s.rect.height}px`, transition: 'none' });
  calque.append(copie);
  return copie;
}

// Fenêtres de la page quittée sans place ici, copiées pour se refermer
function sortir(holo: Sortant[], organiques: Sortant[], ov: HTMLElement, coq: DOMRect): Repli[] {
  const calque = document.createElement('div');
  calque.className = 'dock fantomes';
  calque.dataset.pret = '1';
  calque.setAttribute('aria-hidden', 'true');
  ov.append(calque);
  const o = ov.getBoundingClientRect();
  // Une copie neuve revient en haut : chacune reprend là où elle était défilée
  const redefiler = (s: Sortant) => {
    const tous = s.copie!.querySelectorAll('*');
    for (const [i, haut, gauche] of s.defiles) tous[i].scrollTo(gauche, haut);
  };
  for (const s of holo) {
    copier(s, calque, o, 'holo-ferme');
    redefiler(s);
  }
  const replis = organiques.map((s): Repli => {
    const copie = copier(s, calque, o, 'replie'), r = s.rect;
    // Son contenu reste sur place, elle se referme dessus
    poserFige(copie, '', Array.from(copie.querySelectorAll<HTMLElement>(CONTENU), (c, i) => ({ c, b: s.enfants[i] })).filter(({ b }) => b.width && b.height), 0, 0, true);
    redefiler(s);
    return { el: copie, de: { x: r.left - coq.left, y: r.top - coq.top, w: r.width, h: r.height }, dx: coq.left - o.left, dy: coq.top - o.top };
  });
  calque.dataset.duree = String((holo.length ? DUREE_FLOTTANTE : DUREE_RANGEMENT) + 120);
  return replis;
}

// Montage d'une page lourde : le passage reste figé jusqu'à la peinture
function lancerApresPeinture(ov: HTMLElement, fin: () => void) {
  void ov.offsetWidth;
  const anims = ov.getAnimations({ subtree: true }).filter((a) => a.playState === 'running');
  anims.forEach((a) => a.pause());
  requestAnimationFrame(() => requestAnimationFrame(() => {
    anims.forEach((a) => { if (a.playState === 'paused') a.play(); });
    ov.querySelectorAll<HTMLElement>(':scope > .fantomes').forEach((c) => window.setTimeout(() => c.remove(), Number(c.dataset.duree)));
    fin();
  }));
}

// D'une page à l'autre : l'Activité glisse, les détachées se relaient
function passer({ fenetres, principal: ancien }: Sortants, coq: HTMLElement, m: Moteur, principal: string): Passage {
  const passage: Passage = { modes: new Map() };
  if (mouvementReduit()) return passage;
  // Fenêtre fermée ici, même affichée le temps de se replier : pas de la page
  const vue = (el: HTMLElement) => !el.hidden && el.dataset.fermee === undefined && getComputedStyle(el).visibility !== 'hidden';
  const recouvre = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const aire = (r: DOMRect) => r.width * r.height;
  // Deux places voisines au plus : elles se touchent, à l'écart près
  const proches = (a: DOMRect, b: DOMRect) => a.left <= b.right + ECART + 2 && b.left <= a.right + ECART + 2 && a.top <= b.bottom + ECART + 2 && b.top <= a.bottom + ECART + 2;
  // Le rôle d'une fenêtre d'une page à l'autre : la grande, sinon son nom
  const role = (id: string, p: string) => (id === p ? '@principal' : id);
  const c = coq.getBoundingClientRect();
  const zone = (r: DOMRect): Zone => ({ x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height });
  const ici = Array.from(coq.querySelectorAll<HTMLElement>('[data-fen]')).filter(vue);
  const avant = fenetres.filter((s) => s.vue);
  const depuis: Record<string, Zone> = {};
  const holo: Sortant[] = [];
  for (const s of avant.filter((x) => x.passage === 'fixe')) if (ici.some((el) => el.dataset.fen === s.id)) depuis[s.id] = zone(s.rect);
  for (const s of avant) if (s.passage !== 'fixe' && s.flot) holo.push(s);
  for (const el of ici) if (el.dataset.passage !== 'fixe' && el.dataset.flot) passage.modes.set(el.dataset.fen!, 'holo');
  const rangeesAvant = avant.filter((s) => s.passage !== 'fixe' && !s.flot);
  const posees = ici.filter((el) => !el.dataset.flot).map((el) => ({ el, r: el.getBoundingClientRect() }));
  const rangeesIci = posees.filter(({ el }) => el.dataset.passage !== 'fixe');
  // Une rangée relaie la même place, puis le même rôle voisin
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
  const sansRelais = rangeesAvant.filter((x) => !relayees.includes(x));
  // Une rangée absente se déplie quand les autres lui font de la place
  const entrantes = rangeesIci.filter(({ el }) => !relais.has(el)).map(({ el }) => el.dataset.fen!);
  m.figer([...Object.keys(depuis), ...entrantes]);
  const ov = coq.closest<HTMLElement>('.ov');
  const replis = ov && (holo.length || sansRelais.length) ? sortir(holo, sansRelais, ov, c) : [];
  if (Object.keys(depuis).length || replis.length) m.ranger(true, { depuis, replis });
  return passage;
}

function useContexte() {
  const c = useContext(Contexte);
  if (!c) throw new Error('Fenêtre ou panneau hors d’un <Dock>');
  return c;
}

// Onglet ouvert du panneau et son objet ; ouvrir choisit l'élément et le montre
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
  const prevu = useRef<Passage>({ modes: new Map() });
  // Vrai du changement de page au lancement, remontage du mode strict compris
  const enPassage = useRef(false);
  const [avant] = useState(() => (Object.keys(DOCK.visibles).length ? { ...DOCK.visibles } : null));
  const pose = useRef(false);
  // Panneau puis fenêtres du clic droit ; celle en focus prend le clic gauche
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
  // Le panneau change d'élément ; sans objet, il reprend le dernier de la sorte
  const setOnglet = useCallback((cle: string | null, objet?: string) => setVues((v) => [
    { ...v[0], cle, objets: cle && objet !== undefined ? { ...v[0].objets, [cle]: objet } : v[0].objets, serie: v[0].serie + 1 }, ...v.slice(1),
  ]), []);
  // Le moteur relit les dernières propriétés sans se réinstaller
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
    // Un dock remonté (mode strict, rechargement à chaud) garde son prévu
    if (sortants && sortants.page !== id) {
      prevu.current = passer(sortants, coq, m, p().principal);
      enPassage.current = true;
    }
    const enAttente = attente.current;
    attente.current = [];
    enAttente.forEach((f) => f());
    pose.current = true;
    const ov = coq.closest<HTMLElement>('.ov');
    if (ov && enPassage.current && !mouvementReduit()) {
      lancerApresPeinture(ov, () => {
        enPassage.current = false;
        window.setTimeout(m.degeler, DUREE_RANGEMENT + MARGE_GLISSE);
      });
    }
    return () => {
      // Avant le départ de la page : ses fenêtres et leur place, pour la suivante
      const fenetres = Array.from(coq.querySelectorAll<HTMLElement>('[data-fen]')).map((el): Sortant => {
        const s = getComputedStyle(el), passage = el.dataset.passage ?? 'fondu', vue = !el.hidden && s.display !== 'none' && s.visibility !== 'hidden';
        // Copiée ici : plus tard, ses contenus en portail seraient déjà partis
        const copiee = vue && passage !== 'fixe';
        return { id: el.dataset.fen!, passage, vue, flot: el.dataset.flot === '1', rect: el.getBoundingClientRect(),
          copie: copiee ? el.cloneNode(true) as HTMLElement : null,
          enfants: copiee ? Array.from(el.querySelectorAll(CONTENU), (c) => c.getBoundingClientRect()) : [],
          defiles: copiee ? Array.from(el.querySelectorAll('*')).flatMap((n, i) => (n.scrollTop || n.scrollLeft ? [[i, n.scrollTop, n.scrollLeft]] : [])) : [] };
      });
      DOCK.sortants = { page: id, principal: p().principal, fenetres };
      quitterSection();
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

  // Autre élément du panneau : la fenêtre reste, sa vue s'efface puis se réécrit
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

  // Un élément dans une fenêtre en plus, nouvelle ou existante : elle a le focus
  const poserVue = useCallback((cible: string, cle: string, objet: string) => {
    setFocus(cible);
    setVues((v) => {
      const avantCible = v.find((x) => x.id === cible);
      const nouvelle = { id: cible, cle, objets: { ...avantCible?.objets, [cle]: objet }, serie: (avantCible?.serie ?? 0) + 1 };
      return avantCible ? v.map((x) => (x.id === cible ? nouvelle : x)) : [...v, nouvelle];
    });
  }, []);
  // Fenêtre en plus pour un clic droit : une place libre, sinon celle en focus
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
    // Le focus revient à la dernière fenêtre en plus ouverte, sinon au panneau
    const reste = [...etat.current.vues].reverse().find((x) => x.id !== cible && x.id !== 'panneau' && !x.ferme);
    setFocus((f) => (f === cible ? reste?.id ?? 'panneau' : f));
    // Flottante, elle reste le temps de son repli, plus lent
    const flot = coquille.current?.querySelector<HTMLElement>(`[data-fen="${cible}"]`)?.dataset.flot !== undefined;
    window.setTimeout(() => setVues((v) => v.filter((x) => x.id !== cible)), (flot ? DUREE_FLOTTANTE : DUREE_RANGEMENT) + 80);
  }, [arreterEchange, setOnglet]);
  // Fermer depuis un élément : la fenêtre en focus, celle du clic
  const fermer = useCallback(() => fermerVue(etat.current.vues.some((x) => x.id === etat.current.focus && !x.ferme) ? etat.current.focus : 'panneau'), [fermerVue]);

  // Clic droit sur un ouvreur : élément en nouvelle fenêtre, sinon menu normal
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
    if (vue) e.ecrit = ecrire(vue, { duree: DUREES.contenu - DUREES.effacer });
  }, [montre]);
  useLayoutEffect(() => arreterEchange, [arreterEchange]);

  const prevue = useCallback((cle: string) => ({ mode: prevu.current.modes.get(cle) }), []);
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
  // Page à page : 'fixe' glisse, 'ecrit' est gardée, 'fondu' est propre à sa page
  passage?: 'fixe' | 'fondu' | 'ecrit';
};

// Le contenu d'une fenêtre qui se déplie arrive en route et finit avec elle
const CONTENU_APRES = 60;

type EnCours = { tour: number; anims: Controle[]; minuteurs: number[]; sortie: 'non' | 'efface' | 'replie' };

// Fenêtre du dock : verre, prise, poignées ; cachée, elle garde sa place
export function Fenetre({ id, as: Balise = 'section', className, titrePrise = 'Glisser pour détacher la fenêtre', hidden = false, passage = 'fondu', children, ...reste }: ProprietesFenetre) {
  const { ranger, quandPose, avant: avantDock, prevue, posee } = useContexte();
  // Apparue une fois le dock posé, elle n'arrive pas d'une autre page
  const [avant] = useState(() => (posee() ? null : avantDock));
  const el = useRef<HTMLElement | null>(null);
  const poserEl = useCallback((n: HTMLElement | null) => {
    el.current = n;
  }, []);
  // Apparue après la pose, elle part cachée pour se déplier ; fermée ici, cachée
  const [cachee, setCachee] = useState(() => posee() || hidden);
  // État au montage
  const depart = useRef({ avant, cachee, hidden });
  const cacheeVue = useRef(cachee);
  const entrante = useRef(false);
  const enCours = useRef<EnCours>({ tour: 0, anims: [], minuteurs: [], sortie: 'non' });

  // Arrête le passage en cours : textes rendus, minuteurs oubliés
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

  // Fenêtre ouverte ici venue d'une autre page : verre gardé, ou dépli
  useLayoutEffect(() => {
    const d = depart.current;
    if (!d.avant || d.cachee || d.hidden || passage === 'fixe' || mouvementReduit()) return;
    const e = enCours.current, tour = e.tour;
    quandPose(() => {
      if (e.tour !== tour || !el.current) return;
      const { mode = 'holo' } = prevue(id);
      if (mode === 'ecrit') {
        e.anims.push(ecrire(el.current, { duree: DUREES.contenu }));
      } else if (mode === 'organique') {
        ranger(true, { entrees: [id] });
        e.anims.push(voiler(el.current, CONTENU_APRES + 60));
        plus(tour, () => {
          if (!el.current) return;
          e.anims.forEach((c) => c.annuler());
          e.anims = [ecrire(el.current, { duree: DUREES.contenu - CONTENU_APRES })];
        }, CONTENU_APRES);
      } else {
        // Flottante : elle s'ouvre dès le départ, pendant que l'ancienne se ferme
        el.current.classList.add('holo-ouvre');
        e.anims.push(ecrire(el.current, { duree: (DUREES.ouvrir - DUREES.voile) * LENTEUR_FLOTTANTE, delai: DUREES.voile * LENTEUR_FLOTTANTE }));
        plus(tour, () => el.current?.classList.remove('holo-ouvre'), DUREE_FLOTTANTE + 50);
      }
    });
  }, [id, passage, quandPose, prevue, ranger, plus]);

  useLayoutEffect(() => {
    const e = enCours.current;
    // Rouverte dans la mise à jour où elle se cache : l'état lu doit être le bon
    cacheeVue.current = cachee;
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
        const flot = el.current.dataset.flot !== undefined;
        const replier = () => {
          e.sortie = 'replie';
          ranger(true, { sortie: id });
          plus(tour, () => {
            e.sortie = 'non';
            setCachee(true);
          }, (flot ? DUREE_FLOTTANTE : DUREE_RANGEMENT) + MARGE_GLISSE);
        };
        replier();
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
    // Rouverte pendant qu'elle se fermait, elle repart de là où elle en est
    const replie = e.sortie === 'replie';
    arreter();
    if (replie) ranger(true, { entrees: [id] });
  }, [hidden, cachee, id, ranger, quandPose, prevue, arreter, plus]);

  // Montrée : rangée avant d'être peinte ; retirée : rangée une fois sortie
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
        e.anims.push(voiler(el.current, CONTENU_APRES + 60));
        plus(tour, () => {
          if (!el.current) return;
          e.anims.forEach((c) => c.annuler());
          e.anims = [ecrire(el.current, { duree: DUREES.contenu - CONTENU_APRES })];
        }, CONTENU_APRES);
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

  const aidePrise = `${titrePrise ?? 'Glisser pour détacher'} · clic : détacher ou remettre en place`;
  return (
    <Verre as={Balise} ref={poserEl} data-fen={id} data-passage={passage} data-fermee={hidden || undefined} className={className} hidden={cachee} {...reste}>
      <button type="button" className="prise" title={aidePrise} aria-label={aidePrise}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
      </button>
      {children}
      <span className="taille d" data-taille="d" aria-hidden="true" />
      <span className="taille b" data-taille="b" aria-hidden="true" />
      <span className="taille c" data-taille="c" aria-hidden="true" />
      {/* Ouverture : deux lignes nées au milieu, qui s'écartent en haut et en bas */}
      <span className="ouv-ligne" aria-hidden="true" />
      <span className="ouv-ligne" aria-hidden="true" />
    </Verre>
  );
}
