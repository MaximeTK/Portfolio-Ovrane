// Mécanique organique : arbre de partages, fenêtres détachées ou rangées
import { aOublier } from '../stockage';

export type Taille = [number, number];
export type DefFenetre = { mini?: Taille; pref?: Taille; flot?: Taille; prises?: string };
type Feuille = { id: string };
type Partage = { dir: 'row' | 'col'; enfants: Arbre[]; parts: number[] };
export type Arbre = Feuille | Partage;
export type Zone = { x: number; y: number; w: number; h: number };
export type ArbreDepart = Arbre | ((zone: Zone, style: CSSStyleDeclaration) => Arbre);

export const ECART = 16, DECROCHE = 16, SEUIL = 6, BORD = 26, MARGE = 0.3, ARMEMENT = 450, IMMOBILE = 10;
// Glissement des fenêtres vers leur place, comme la feuille de style (0,3 s)
export const DUREE_RANGEMENT = 300;
// Marge d'un glissement : la fin voulue est passée quand elle sert
export const MARGE_GLISSE = 60;
// Une flottante s'ouvre et se ferme plus lentement, tout à la même échelle
export const DUREE_FLOTTANTE = 500;
export const LENTEUR_FLOTTANTE = DUREE_FLOTTANTE / DUREE_RANGEMENT;
type Courbe = [number, number, number, number];
const VIVE: Courbe = [0.2, 0.8, 0.2, 1];
// Fermeture : départ souple et fin qui ralentit, sans accélérer à l'arrivée
export const DOUCE: Courbe = [0.7, 0, 0.25, 1];
export const TRANSITION_DE = (duree: number, delai = 0, c = VIVE) => ['left', 'top', 'width', 'height', '--fw', '--fh'].map((p) => `${p} ${Math.round(duree)}ms cubic-bezier(${c.join(',')}) ${Math.round(delai)}ms`).join(',');

// Avancée du glissement (0 à 1) à la fraction u, sur la courbe donnée
function courbe(u: number, [x1, y1, x2, y2]: Courbe) {
  const b = (t: number, p1: number, p2: number) => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  let bas = 0, haut = 1;
  for (let k = 0; k < 20; k++) {
    const m = (bas + haut) / 2;
    if (b(m, x1, x2) < u) bas = m;
    else haut = m;
  }
  return b((bas + haut) / 2, y1, y2);
}
const entre = (de: Zone, a: Zone, p: number): Zone => ({ x: de.x + (a.x - de.x) * p, y: de.y + (a.y - de.y) * p, w: de.w + (a.w - de.w) * p, h: de.h + (a.h - de.h) * p });
const touche = (a: Zone, b: Zone) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
const meme = (a: Zone, b: Zone) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.w - b.w) + Math.abs(a.h - b.h) < 0.5;
const centre = (r: Zone): Zone => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, w: 0, h: 0 });
// Avancée où les voisines ont dégagé le centre de la mini fenêtre
function seuilMini(m: Zone, voisines: { sans: Zone; avec: Zone }[]) {
  const c = centre(m);
  let s = 0;
  // Le bord passe par le centre, puis garde son écart avec la face de la mini
  const bord = (sans: number, avec: number, face: number, mil: number) => {
    if ((sans - mil) * (avec - mil) < 0) s = Math.max(s, (sans - mil + face - avec) / (sans - avec));
  };
  for (const { sans, avec } of voisines) {
    if (!touche(sans, m)) continue;
    bord(sans.x, avec.x, m.x + m.w, c.x);
    bord(sans.x + sans.w, avec.x + avec.w, m.x, c.x);
    bord(sans.y, avec.y, m.y + m.h, c.y);
    bord(sans.y + sans.h, avec.y + avec.h, m.y, c.y);
  }
  return Math.min(s, 0.95);
}
// L'écran se partage en quatre colonnes et deux lignes, jamais plus
const MAX_COLONNES = 4, MAX_LIGNES = 2;
// Part d'une flottante qui reste à l'écran quand elle dépasse un bord
const RESTE = 56;
const MINI_DEFAUT: Taille = [200, 160];
const PREF_DEFAUT: Taille = [400, 300];
// Têtes qui servent de prise, en plus de la rangée de points
export const PRISES = '.tete, .echos-tete, .p-tete, .outils';
const INTERACTIF = 'a,button,input,select,textarea,label,summary,[role=button]';
// Ce qui n'est pas le décor d'une fenêtre : son contenu
export const CONTENU = ':scope>:not(.verre-halos,.prise,.taille,.ouv-ligne)';
// La fin d'un glissement qui commence
const finDeGlissement = () => performance.now() + DUREE_RANGEMENT + MARGE_GLISSE;
// L'étendue d'un groupe de fenêtres sur un axe ; rien pour un groupe vide
const etendue = (rs: Zone[], ligne: boolean) => (!rs.length ? 0
  : ligne ? Math.max(...rs.map((r) => r.x + r.w)) - Math.min(...rs.map((r) => r.x)) : Math.max(...rs.map((r) => r.y + r.h)) - Math.min(...rs.map((r) => r.y)));
// Taille d'arrivée d'une fenêtre figée, à quelques fractions de pixel près
const cleFige = (r: { w: number; h: number }) => `${Math.round(r.w)} ${Math.round(r.h)}`;
// Chaque enfant posé à sa mesure ; sur place, il ne suit plus la fenêtre
export function poserFige(el: HTMLElement, cle: string, enfants: { c: HTMLElement; b: DOMRect }[], x: number, y: number, surPlace: boolean) {
  el.dataset.fige = cle;
  if (surPlace) el.dataset.repli = '';
  for (const { c, b } of enfants) {
    c.dataset.figee = '';
    c.style.setProperty('--f-x', `${b.left - x}px`);
    c.style.setProperty('--f-y', `${b.top - y}px`);
    c.style.setProperty('--f-l', `${b.width}px`);
    c.style.setProperty('--f-h', `${b.height}px`);
  }
}

type Cote = 'gauche' | 'droite' | 'haut' | 'bas';
type Cible = { remplir?: boolean; bord?: boolean; id?: string; cote?: Cote };
type Fente = { n: Partage; a: number; b: number; ta: number; tb: number; ma: number; mb: number; somme: number; total: number; ligne: boolean; ajoutA: number; ajoutB: number; libreA: number; libreB: number } & Zone;
type Calcul = { res: Record<string, Zone>; fentes: Fente[] };
type EtatFenetre = { flot: Zone | null; tailleFlot: Taille | null; z: string };
// Disposition d'une page gardée pendant la session, jusqu'à la remise
// Une flottante reprend sa place dans le rangement
const rentrer = (f: EtatFenetre, el: HTMLElement) => {
  f.flot = null;
  f.z = '';
  delete el.dataset.flot;
  el.style.zIndex = '';
};
type Memoire = { racine: Arbre | null; fen: Record<string, EtatFenetre>; zMax: number; change: boolean; lien?: Lien | null };
type Action =
  | { type: 'fente'; f: Fente; x0: number; y0: number; el: HTMLElement }
  | { type: 'taille'; id: string; sens: string; x0: number; y0: number; w0: number; h0: number }
  | {
      type: 'fenetre'; id: string; el: HTMLElement; x0: number; y0: number; dx: number; dy: number; actif: boolean;
      depuis: { x: number; y: number }; cible: Cible | null; cle: string; minuteur: number; bouges: boolean; arme: boolean;
      ax?: number; ay?: number; essai?: Calcul;
    };

const MEMOIRES = new Map<string, Memoire>();
aOublier(() => MEMOIRES.clear());

type OptionsDock = {
  id: string;
  principal: () => string;
  depart: () => ArbreDepart;
  tailles: () => Record<string, DefFenetre>;
  prises: () => string;
  entiere: HTMLElement;
  fentes: HTMLElement;
  remise: HTMLElement;
  // Fenêtres d'éléments : hors de l'arbre, à la place logique (`placerElement`)
  elements?: (id: string) => boolean;
};
// Copie de la page quittée qui se replie : sa place et son décalage de calque
export type Repli = { el: HTMLElement; de: Zone; dx: number; dy: number };
// Fenêtres qui se déplient ou se replient depuis leur centre (`depuis`)
export type OptionsRangement = { entrees?: string[]; sortie?: string; depuis?: Record<string, Zone>; replis?: Repli[] };
export type Moteur = { ranger: (anime: boolean, options?: OptionsRangement) => void; figer: (ids: string[]) => void; degeler: () => void; detruire: () => void };
// Une place pendant le rangement ; la mini n'occupe qu'une part du chemin
type Trajet = { el: HTMLElement; de: Zone; a: Zone; z: Zone; mini?: 'sort' | 'entre'; debut: number; fin: number; dx: number; dy: number };
type Lien = { trajets: Trajet[]; courbe: Courbe; depart: number | null; images: number };

const feuille = (n: Arbre): n is Feuille => (n as Feuille).id !== undefined;
const copie = <T,>(n: T): T => JSON.parse(JSON.stringify(n));
const ids = (n: Arbre | null): string[] => (!n ? [] : feuille(n) ? [n.id] : n.enfants.flatMap(ids));
// Colonnes et lignes d'un arbre : flottante ou fermée, chaque feuille reviendra
const dimensions = (n: Arbre): [number, number] => {
  if (feuille(n)) return [1, 1];
  const d = n.enfants.map(dimensions), c = d.map((x) => x[0]), l = d.map((x) => x[1]);
  return n.dir === 'row' ? [c.reduce((a, b) => a + b, 0), Math.max(...l)] : [Math.max(...c), l.reduce((a, b) => a + b, 0)];
};
const tient = (n: Arbre) => {
  const [c, l] = dimensions(n);
  return c <= MAX_COLONNES && l <= MAX_LIGNES;
};

export function installerDock(coq: HTMLElement, o: OptionsDock): Moteur {
  const ov = (coq.closest('.ov') as HTMLElement | null) ?? coq;
  const { entiere, remise } = o;
  const mini = (id: string) => o.tailles()[id]?.mini ?? MINI_DEFAUT;
  const pref = (id: string) => o.tailles()[id]?.pref ?? PREF_DEFAUT;
  const els: Record<string, HTMLElement | null> = {};
  let seps: Fente[] = [], action: Action | null = null;
  const sepEls: HTMLElement[] = [];

  let origine = { x: 0, y: 0 };
  const cadre = () => {
    const r = coq.getBoundingClientRect(), s = getComputedStyle(coq);
    origine = { x: r.left, y: r.top };
    return { r, L: parseFloat(s.paddingLeft), T: parseFloat(s.paddingTop), R: r.width - parseFloat(s.paddingRight), B: r.height - parseFloat(s.paddingBottom) };
  };
  type Cadre = ReturnType<typeof cadre>;
  // Détachée, une fenêtre reprend sa dernière taille flottante, jamais sa case
  const tailleDetachee = (id: string, r: DOMRect, c: Cadre): Taille => {
    const m = mini(id), t = etat(id).tailleFlot || o.tailles()[id]?.flot || [r.width, r.height];
    return [Math.max(Math.min(t[0], c.r.width - 40), m[0]), Math.max(Math.min(t[1], c.r.height - 40), m[1])];
  };
  const zoneUtile = (c: Cadre): Zone => ({ x: c.L, y: c.T, w: c.R - c.L, h: c.B - c.T });

  const depart = () => {
    const d = o.depart();
    return copie(typeof d === 'function' ? d(zoneUtile(cadre()), getComputedStyle(coq)) : d);
  };
  const racineDepart = depart();
  const memoire = MEMOIRES.get(o.id) ?? { racine: null, fen: {}, zMax: 20, change: false };
  MEMOIRES.set(o.id, memoire);
  if (!memoire.change) memoire.racine = copie(racineDepart);
  const fen = memoire.fen;
  const etat = (id: string) => (fen[id] ??= { flot: null, tailleFlot: null, z: '' });

  let inclus: string | null = null;
  // Pour placer une fenêtre : un élément flottant compte, sa place l'attend
  let flottantesComptees = false;
  // Fenêtres en train de se replier : encore peintes, hors du partage
  const sorties = new Set<string>();
  const affichee = (id: string) => {
    const el = els[id];
    if (!el || getComputedStyle(el).display === 'none') { sorties.delete(id); return false; }
    return !sorties.has(id) && (id === inclus || (flottantesComptees && (id === 'panneau' || !!o.elements?.(id))) || etat(id).flot === null);
  };
  const visible = (n: Arbre): boolean => (feuille(n) ? affichee(n.id) : n.enfants.some(visible));
  const miniArbre = (n: Arbre, axe: 'w' | 'h', vu = visible): number => {
    if (feuille(n)) return mini(n.id)[axe === 'w' ? 0 : 1];
    const vis = n.enfants.filter(vu);
    if ((n.dir === 'row') === (axe === 'w')) return vis.reduce((s, c) => s + miniArbre(c, axe, vu), 0) + ECART * Math.max(vis.length - 1, 0);
    return Math.max(0, ...vis.map((c) => miniArbre(c, axe, vu)));
  };

  // Partage simplifié : sans case vide ni enfant unique, mêmes sens fondus
  function normaliser(n: Arbre | null): Arbre | null {
    if (!n || feuille(n)) return n;
    const paires: [Arbre, number][] = [];
    n.enfants.forEach((c, i) => {
      const nc = normaliser(c), p = n.parts[i];
      if (!nc) return;
      if (!feuille(nc) && nc.dir === n.dir) {
        const s = nc.parts.reduce((a, b) => a + b, 0);
        nc.enfants.forEach((cc, j) => paires.push([cc, (p * nc.parts[j]) / s]));
      } else paires.push([nc, p]);
    });
    if (!paires.length) return null;
    if (paires.length === 1) return paires[0][0];
    n.enfants = paires.map((q) => q[0]);
    n.parts = paires.map((q) => q[1]);
    return n;
  }
  // La part d'une fenêtre retirée va à sa voisine, les autres ne bougent pas
  function retirer(n: Arbre | null, id: string): Arbre | null {
    if (!n) return null;
    if (feuille(n)) return n.id === id ? null : n;
    const restes = n.enfants.map((c) => retirer(c, id));
    restes.forEach((c, i) => {
      if (c) return;
      const v = restes.findIndex((x, j) => x && j > i), j = v >= 0 ? v : restes.findLastIndex((x) => x);
      if (j < 0) return;
      // L'écart rendu compte aussi, à l'échelle des parts de ce partage
      const s = n.parts.reduce((a, b) => a + b, 0);
      const long = etendue(ids(n).map((x) => base.res[x]).filter(Boolean), n.dir === 'row');
      const total = long - ECART * (n.enfants.length - 1);
      n.parts[j] += n.parts[i] + (total > 0 ? (s * ECART) / total : 0);
    });
    n.parts = n.parts.filter((_, i) => restes[i]);
    n.enfants = restes.filter((c): c is Arbre => !!c);
    return n;
  }
  // Pose sur un côté d'une autre fenêtre (moitié) ou sur un bord d'écran (bande)
  function inserer(arbre: Arbre | null, cible: Cible, id: string): Arbre | null {
    // Rien de rangé en vue : elle prend la place, les cases cachées gardent la leur
    if (cible.remplir) return arbre ? { dir: 'row', enfants: [arbre, { id }], parts: [1, 1] } : { id };
    const dir = cible.cote === 'gauche' || cible.cote === 'droite' ? 'row' : 'col';
    const avant = cible.cote === 'gauche' || cible.cote === 'haut', neuf = { id };
    if (cible.bord) {
      const z = zoneUtile(cadre()), total = dir === 'row' ? z.w : z.h, p0 = Math.min(pref(id)[dir === 'row' ? 0 : 1], total * 0.5);
      if (!arbre) return neuf;
      if (!feuille(arbre) && arbre.dir === dir) {
        const s = arbre.parts.reduce((a, b) => a + b, 0), p = (s * p0) / Math.max(total - p0, 1);
        arbre.enfants.splice(avant ? 0 : arbre.enfants.length, 0, neuf);
        arbre.parts.splice(avant ? 0 : arbre.parts.length, 0, p);
        return arbre;
      }
      return { dir, enfants: avant ? [neuf, arbre] : [arbre, neuf], parts: avant ? [p0, total - p0] : [total - p0, p0] };
    }
    let fait = false;
    const rec = (n: Arbre, parent: Partage | null, i: number) => {
      if (fait) return;
      if (feuille(n)) {
        if (n.id !== cible.id) return;
        fait = true;
        if (parent && parent.dir === dir) {
          const p = parent.parts[i] / 2;
          parent.parts[i] = p;
          parent.enfants.splice(avant ? i : i + 1, 0, neuf);
          parent.parts.splice(avant ? i : i + 1, 0, p);
        } else {
          const sous: Partage = { dir, enfants: avant ? [neuf, n] : [n, neuf], parts: [1, 1] };
          if (parent) parent.enfants[i] = sous;
          else arbre = sous;
        }
        return;
      }
      n.enfants.forEach((c, j) => rec(c, n, j));
    };
    if (arbre) rec(arbre, null, 0);
    return arbre;
  }

  // Taille de chaque case, au minimum si la place le permet ; fentes notées
  function calculer(arbre: Arbre | null, avec?: string): Calcul {
    // `avec` : la fenêtre en main, comptée dans l'essai bien qu'elle flotte
    inclus = avec || null;
    const res: Record<string, Zone> = {}, fentes: Fente[] = [];
    const rec = (n: Arbre, r: Zone) => {
      if (feuille(n)) { res[n.id] = r; return; }
      const idx = n.enfants.map((_, i) => i).filter((i) => visible(n.enfants[i]));
      if (!idx.length) return;
      const ligne = n.dir === 'row';
      // Une fenêtre absente laisse sa place à sa voisine de droite, sinon de gauche
      const ajouts = idx.map(() => 0), libres = idx.map(() => 0);
      n.enfants.forEach((_, i) => {
        if (idx.includes(i)) return;
        const v = idx.findIndex((x) => x > i), j = v < 0 ? idx.length - 1 : v;
        ajouts[j] += n.parts[i];
        libres[j] += ECART;
      });
      const total = (ligne ? r.w : r.h) - ECART * (n.enfants.length - 1);
      const parts = idx.map((i, j) => n.parts[i] + ajouts[j]);
      const somme = parts.reduce((s, p) => s + p, 0);
      const mins = idx.map((i) => miniArbre(n.enfants[i], ligne ? 'w' : 'h'));
      const minsPart = mins.map((m, j) => Math.max(0, m - libres[j]));
      let t = parts.map((p) => (total * p) / somme);
      for (let k = 0; k < 4; k++) {
        let manque = 0;
        t = t.map((v, j) => { if (v < minsPart[j]) { manque += minsPart[j] - v; return minsPart[j]; } return v; });
        if (manque < 0.5) break;
        const libre = t.map((v, j) => Math.max(0, v - minsPart[j])), sl = libre.reduce((a, b) => a + b, 0);
        if (!sl) break;
        t = t.map((v, j) => v - (manque * libre[j]) / sl);
      }
      // Jamais hors de l'écran : trop à l'étroit, chacune cède sous son minimum
      const tout = t.reduce((a, b) => a + b, 0);
      if (tout > total) t = t.map((v) => (v * total) / tout);
      t = t.map((v, j) => v + libres[j]);
      let pos = ligne ? r.x : r.y;
      idx.forEach((i, j) => {
        rec(n.enfants[i], ligne ? { x: pos, y: r.y, w: t[j], h: r.h } : { x: r.x, y: pos, w: r.w, h: t[j] });
        pos += t[j];
        if (j < idx.length - 1) {
          fentes.push({ n, a: i, b: idx[j + 1], ta: t[j], tb: t[j + 1], ma: mins[j], mb: mins[j + 1], somme, total, ligne,
            ajoutA: ajouts[j], ajoutB: ajouts[j + 1], libreA: libres[j], libreB: libres[j + 1],
            x: ligne ? pos : r.x, y: ligne ? r.y : pos, w: ligne ? ECART : r.w, h: ligne ? r.h : ECART });
          pos += ECART;
        }
      });
    };
    if (arbre) rec(arbre, zoneUtile(cadre()));
    inclus = null;
    return { res, fentes };
  }

  // Place et taille ; --fw et --fh donnent sa mesure à la coupe d'ouverture
  const placer = (el: HTMLElement, r: Zone) => {
    Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', right: 'auto', bottom: 'auto' });
    el.style.setProperty('--fw', r.w + 'px');
    el.style.setProperty('--fh', r.h + 'px');
  };
  // Bords sur des pixels entiers de l'écran : bordure égale sur les quatre côtés
  const surPixels = (r: Zone): Zone => {
    const k = window.devicePixelRatio, px = (v: number) => Math.round(v * k) / k;
    const x = px(origine.x + r.x) - origine.x, y = px(origine.y + r.y) - origine.y;
    return { x, y, w: px(origine.x + r.x + r.w) - origine.x - x, h: px(origine.y + r.y + r.h) - origine.y - y };
  };
  // Contenu lâché : il reprend sa place dans la fenêtre
  const degelerEl = (el: HTMLElement) => {
    if (el.dataset.fige === undefined) return;
    delete el.dataset.fige;
    delete el.dataset.repli;
    el.querySelectorAll<HTMLElement>(':scope>[data-figee]').forEach((c) => delete c.dataset.figee);
  };
  const degeler = () => coq.querySelectorAll<HTMLElement>('[data-fige]').forEach(degelerEl);
  // Contenu d'une fenêtre qui glisse : posé à sa taille finale, sans recalcul
  const minuteursFige = new Map<HTMLElement, number>();
  const figer = (liste: string[], apres = 0, surPlace = false) => {
    const mesures = liste.flatMap((id) => {
      const el = els[id];
      if (!el || el.dataset.fige !== undefined) return [];
      const r = el.getBoundingClientRect(), z = etat(id).flot ?? base.res[id] ?? { w: r.width, h: r.height };
      const enfants = Array.from(el.querySelectorAll<HTMLElement>(CONTENU), (c) => ({ c, b: c.getBoundingClientRect() })).filter(({ b }) => b.width && b.height);
      // Sous un flou, position fixe impossible : le contenu suit alors la fenêtre
      const fixe = surPlace && getComputedStyle(el).backdropFilter === 'none';
      return [{ el, z, enfants, fixe, x: fixe ? 0 : r.left + el.clientLeft, y: fixe ? 0 : r.top + el.clientTop }];
    });
    for (const { el, z, enfants, fixe, x, y } of mesures) poserFige(el, cleFige(z), enfants, x, y, fixe);
    if (!apres) return;
    // Le dernier délai remplace le précédent : rouverte, elle reste figée
    for (const id of liste) {
      const el = els[id];
      if (!el) continue;
      clearTimeout(minuteursFige.get(el));
      minuteursFige.set(el, window.setTimeout(() => degelerEl(el), apres));
    }
  };
  function poser(el: HTMLElement, r: Zone) {
    // Sa place d'arrivée change en route : le contenu suit de nouveau la fenêtre
    if (el.dataset.fige && el.dataset.fige !== cleFige(r)) degelerEl(el);
    placer(el, surPixels(r));
    el.dataset.forme = r.w > 520 && r.h < r.w * 0.6 ? 'large' : 'haute';
    // Paliers de largeur : chacun laisse au moins 8 px entre les colonnes gardées
    el.dataset.l = r.w < 600 ? 'xs' : r.w < 720 ? 's' : r.w < 1000 ? 'm' : 'l';
  }
  // Applique un calcul aux fenêtres rangées (sauf en main) et place les fentes
  function appliquer(calc: Calcul, sauf: string | null, avecFentes: boolean) {
    for (const id in calc.res) { const el = els[id]; if (el && id !== sauf && !sorties.has(id) && etat(id).flot === null && !lien?.trajets.some((t) => t.el === el)) poser(el, calc.res[id]); }
    seps = avecFentes ? calc.fentes : [];
    while (sepEls.length < seps.length) {
      const s = document.createElement('div');
      s.className = 'separateur';
      o.fentes.appendChild(s);
      sepEls.push(s);
    }
    sepEls.forEach((s, i) => {
      const f = seps[i];
      s.hidden = !f;
      if (!f) return;
      s.dataset.i = String(i);
      s.className = 'separateur ' + (f.ligne ? 'ligne' : 'colonne');
      Object.assign(s.style, { left: f.x + 'px', top: f.y + 'px', width: f.w + 'px', height: f.h + 'px' });
    });
  }

  // Place logique d'un élément : réduit la fenêtre couvrant plusieurs des 8 zones
  function chercherPlace(id: string): Arbre | null {
    const racine = memoire.racine;
    if (!racine || !visible(racine)) return null;
    const z = zoneUtile(cadre()), res = calculer(racine).res, unite = z.w / 4;
    const etendueDe = (n: Arbre, ligne: boolean) => etendue(ids(n).map((i) => res[i]).filter(Boolean), ligne);
    const repartir = (u: number, t: number[]) => {
      if (t.length >= u) return t.map(() => u / t.length);
      const s = t.reduce((a, b) => a + b, 0) || 1, q = t.map((v) => (v * u) / s), p = q.map((v) => Math.max(1, Math.floor(v)));
      const ecart = (j: number) => q[j] - p[j];
      for (let n = p.reduce((a, b) => a + b, 0); n !== u; n += n < u ? 1 : -1) {
        const js = p.map((_, j) => j).filter((j) => n < u || p[j] > 1);
        const j = js.reduce((m, k) => ((n < u ? ecart(k) > ecart(m) : ecart(k) < ecart(m)) ? k : m));
        p[j] += n < u ? 1 : -1;
      }
      return p;
    };
    // Zones de chaque fenêtre : chaque enfant en couvre une au moins
    const couvre: Record<string, { c: number; r: number }> = {};
    const zones =(n: Arbre, c: number, r: number) => {
      if (feuille(n)) { if (res[n.id]) couvre[n.id] = { c, r }; return; }
      const vis = n.enfants.filter((e) => ids(e).some((i) => res[i])), ligne = n.dir === 'row';
      const parts = repartir(ligne ? c : r, vis.map((e) => etendueDe(e, ligne)));
      vis.forEach((e, i) => zones(e, ligne ? parts[i] : c, ligne ? r : parts[i]));
    };
    zones(racine, 4, 2);
    const nombre = (i: string) => Math.round(couvre[i].c * couvre[i].r * 100);
    const ordre = Object.keys(couvre).sort((a, b) => nombre(b) - nombre(a) || res[b].w * res[b].h - res[a].w * res[a].h);
    // La nouvelle, encore cachée, compte déjà
    const vu = (n: Arbre): boolean => (feuille(n) ? n.id === id || affichee(n.id) : n.enfants.some(vu));
    const etroite = (n: Arbre) => feuille(n) && !!res[n.id] && res[n.id].w < unite * 0.75;
    const colonnes = (n: Arbre): number => {
      if (feuille(n)) return 1;
      const c = n.enfants.filter(vu).map(colonnes);
      return n.dir === 'row' ? c.reduce((a, b) => a + b, 0) : Math.max(1, ...c);
    };
    // Après une colonne de plus, chaque enfant a sa part selon ses colonnes
    const egaliser = (n: Arbre) => {
      if (feuille(n)) return;
      n.enfants.forEach(egaliser);
      if (n.dir !== 'row') return;
      const vis = n.enfants.map((_, i) => i).filter((i) => vu(n.enfants[i])), larges = vis.filter((i) => !etroite(n.enfants[i]));
      const reste = larges.reduce((s, i) => s + n.parts[i], 0), total = larges.reduce((s, i) => s + colonnes(n.enfants[i]), 0);
      larges.forEach((i) => { n.parts[i] = (reste * colonnes(n.enfants[i])) / total; });
    };
    // Colonne de plus au bout de la rangée de la fenêtre, sinon au bord droit
    const colonne = (arbre: Arbre, cible: string | null): Arbre | null => {
      if (!cible) return inserer(arbre, { bord: true, cote: 'droite' }, id);
      const trouve: { rangee: Partage | null } = { rangee: null };
      const rec = (n: Arbre): boolean => {
        if (feuille(n)) return n.id === cible;
        if (!n.enfants.some(rec)) return false;
        if (n.dir === 'row' && !trouve.rangee) trouve.rangee = n;
        return true;
      };
      rec(arbre);
      const r = trouve.rangee;
      if (!r) return inserer(arbre, { id: cible, cote: 'droite' }, id);
      r.enfants.push({ id });
      r.parts.push(r.parts.reduce((a, b) => a + b, 0) / r.parts.length);
      return arbre;
    };
    const feuilles = Object.keys(couvre), larg = (i: string) => couvre[i].c, haut = (i: string) => couvre[i].r;
    // Ordre : colonne à droite si large, dessous si pleine hauteur, puis tout côté
    const essais: [string | null, boolean][] = [
      ...feuilles.filter((i) => larg(i) > 2).sort((a, b) => nombre(b) - nombre(a)).map((i): [string, boolean] => [i, false]),
      ...feuilles.filter((i) => haut(i) >= 2 && larg(i) <= 2).sort((a, b) => res[b].x - res[a].x).map((i): [string, boolean] => [i, true]),
      ...feuilles.filter((i) => larg(i) >= 2).sort((a, b) => nombre(b) - nombre(a)).map((i): [string, boolean] => [i, false]),
      [null, false],
    ];
    for (const n of new Set(ordre.map(nombre))) for (const sien of [true, false]) for (const i of ordre.filter((x) => nombre(x) === n)) essais.push([i, (haut(i) >= larg(i)) === sien]);
    // Trop à l'étroit pour les minimums : la grille passe avant eux
    for (const minimums of [true, false]) for (const [cible, dessous] of essais) {
      const arbre = normaliser(dessous ? inserer(copie(racine), { id: cible!, cote: 'bas' }, id) : colonne(copie(racine), cible));
      if (!arbre || !tient(arbre) || (minimums && (miniArbre(arbre, 'w', vu) > z.w + 0.5 || miniArbre(arbre, 'h', vu) > z.h + 0.5))) continue;
      if (!dessous || res[cible!].w < unite * 0.75) egaliser(arbre);
      return arbre;
    }
    return null;
  }
  const placerElement = (id: string) => {
    flottantesComptees = true;
    const arbre = chercherPlace(id);
    flottantesComptees = false;
    return arbre;
  };

  // Fenêtres présentes dans la page ; une absente de l'arbre va au bord droit
  function scanner() {
    const vus = new Set<string>();
    coq.querySelectorAll<HTMLElement>('[data-fen]').forEach((el) => {
      const id = el.dataset.fen!;
      vus.add(id);
      if (els[id] === el) return;
      els[id] = el;
      // Une fenêtre reprise prend l'état gardé, flottante ou rangée
      const f = etat(id);
      el.style.zIndex = f.z;
      if (!f.flot) {
        delete el.dataset.flot;
        return;
      }
      el.dataset.flot = '1';
      poser(el, f.flot);
    });
    for (const id in els) if (!vus.has(id)) {
      els[id] = null;
      sorties.delete(id);
      // Fenêtre d'élément fermée : sa place revient aux autres et son état est oublié
      if (!o.elements?.(id)) continue;
      memoire.racine = normaliser(retirer(memoire.racine, id));
      delete fen[id];
    }
    vus.forEach((id) => {
      const el = els[id], f = etat(id);
      if (f.flot && el?.hidden && !sorties.has(id)) {
        rentrer(f, el);
      }
      if (f.flot || ids(memoire.racine).includes(id)) return;
      memoire.racine = normaliser((o.elements?.(id) && placerElement(id)) || inserer(memoire.racine, { bord: true, cote: 'droite' }, id));
    });
  }

  let base: Calcul = { res: {}, fentes: [] };
  // Fin du dernier glissement : un rangement sans animation ne le coupe pas
  let finGlisse = 0;
  const glisses = new Map<HTMLElement, number>();
  // Rangement en cours : une seule avancée, chaque place en est déduite
  let lien: Lien | null = null, imageLien = 0;
  const dansLEcran = (fl: Zone, c: Cadre) => {
    fl.w = Math.min(fl.w, c.r.width);
    fl.h = Math.min(fl.h, c.r.height);
    fl.x = Math.min(Math.max(fl.x, 0), c.r.width - fl.w);
    fl.y = Math.min(Math.max(fl.y, 0), c.r.height - fl.h);
  };
  // Tenue à la main, une flottante peut dépasser un bord, sa tête reste à portée
  const aPortee = (fl: Zone, c: Cadre) => {
    fl.w = Math.min(fl.w, c.r.width);
    fl.h = Math.min(fl.h, c.r.height);
    fl.x = Math.min(Math.max(fl.x, RESTE * 2 - fl.w), c.r.width - RESTE);
    fl.y = Math.min(Math.max(fl.y, 0), c.r.height - RESTE);
  };
  // Le glissement porté par la fenêtre elle-même vaut aussi pour une flottante
  const glisser = (el: HTMLElement, duree = DUREE_RANGEMENT, delai = 0, c = VIVE) => {
    el.style.transition = TRANSITION_DE(duree, delai, c);
    clearTimeout(glisses.get(el));
    glisses.set(el, window.setTimeout(() => { el.style.transition = ''; glisses.delete(el); }, delai + duree + MARGE_GLISSE));
  };
  const dureeDe = (id: string) => (etat(id).flot ? DUREE_FLOTTANTE : DUREE_RANGEMENT);
  const poserLien = (q: number) => {
    for (const t of lien!.trajets) {
      t.z = entre(t.de, t.a, Math.min(1, Math.max(0, (q - t.debut) / (t.fin - t.debut))));
      const r = surPixels(t.z);
      placer(t.el, { ...r, x: r.x + t.dx, y: r.y + t.dy });
    }
  };
  const tourner = (temps: number) => {
    const l = lien!;
    // Le temps part à la deuxième image : la page est peinte
    if (l.depart === null) {
      if (l.images++) l.depart = temps;
      imageLien = requestAnimationFrame(tourner);
      return;
    }
    const u = (temps - l.depart) / DUREE_RANGEMENT;
    poserLien(u < 1 ? courbe(u, l.courbe) : 1);
    if (u < 1) {
      imageLien = requestAnimationFrame(tourner);
      return;
    }
    lien = null;
    // Transition rendue après la peinture de la dernière place
    requestAnimationFrame(() => l.trajets.forEach((t) => {
      if (!lien?.trajets.some((x) => x.el === t.el)) t.el.style.transition = '';
    }));
  };
  // Le rangement cède : les fenêtres repartent de là où elles en sont
  const ceder = () => {
    if (!lien) return;
    cancelAnimationFrame(imageLien);
    const { trajets } = lien;
    lien = null;
    for (const t of trajets) {
      t.el.style.transition = '';
      if (t.mini === 'sort') placer(t.el, { ...t.a, x: t.a.x + t.dx, y: t.a.y + t.dy });
    }
  };
  const ranger = (anime: boolean, { entrees = [], sortie, depuis = {}, replis = [] }: OptionsRangement = {}) => {
    scanner();
    // Une flottante reste à portée de main, même après un changement de taille
    const c0 = cadre();
    for (const id in fen) if (fen[id].flot && els[id]) { aPortee(fen[id].flot, c0); poser(els[id], fen[id].flot); }
    const sans = !anime && performance.now() > finGlisse;
    if (sans) ov.classList.add('sans-anim');
    else if (!action && ov.classList.contains('sans-anim')) {
      // Après une pose sans animation, la place posée sert de départ puis tout glisse
      void coq.offsetWidth;
      ov.classList.remove('sans-anim');
    }
    if (anime && (entrees.length || sortie || Object.keys(depuis).length)) finGlisse = finDeGlissement();
    // Celle qui sort se replie vers son centre, les autres remplissent
    const elSortie = sortie ? els[sortie] : null;
    let repli: Zone | null = null;
    if (sortie && elSortie && !sorties.has(sortie) && getComputedStyle(elSortie).display !== 'none') {
      repli = etat(sortie).flot ?? base.res[sortie] ?? null;
      sorties.add(sortie);
    }
    // Celle qui revient en se repliant repart de là où elle en est
    const revenues = entrees.filter((id) => sorties.delete(id));
    const avant = base;
    base = calculer(memoire.racine);
    if (sortie && elSortie && repli) {
      // Figée par un autre glissement : elle repart sur place
      degelerEl(elSortie);
      // Dégel après qu'elle est cachée (+ 60) : son contenu ne saute jamais
      figer([sortie], dureeDe(sortie) + 100, true);
      if (etat(sortie).flot) {
        glisser(elSortie, DUREE_FLOTTANTE, 0, DOUCE);
        placer(elSortie, centre(repli));
        repli = null;
      }
    }
    const entrantes: [string, HTMLElement, Zone][] = [];
    for (const id of entrees) {
      const el = els[id], r = el && (etat(id).flot ?? base.res[id]);
      if (!el || !r || !anime) continue;
      const revient = revenues.includes(id);
      if (!revient) {
        el.style.transition = 'none';
        poser(el, r);
      }
      figer([id], dureeDe(id) + MARGE_GLISSE);
      if (etat(id).flot === null) {
        entrantes.push([id, el, r]);
        continue;
      }
      if (!revient) {
        placer(el, centre(r));
        void el.offsetWidth;
      }
      glisser(el, DUREE_FLOTTANTE);
      poser(el, r);
    }
    // Gardée d'une page à l'autre : une flottante repart de sa place d'avant
    for (const id in depuis) {
      const el = els[id], r = el && etat(id).flot;
      if (!el || !r || !anime) continue;
      el.style.transition = 'none';
      placer(el, depuis[id]);
      void el.offsetWidth;
      glisser(el, DUREE_RANGEMENT, 0, replis.length ? DOUCE : VIVE);
      poser(el, r);
    }
    if (anime && (repli || entrantes.length || replis.length || Object.keys(depuis).some((id) => els[id] && base.res[id] && etat(id).flot === null))) {
      const prec = lien, ici = new Map(prec?.trajets.map((t) => [t.el, t]));
      const trajets: Trajet[] = [];
      const ajouter = (el: HTMLElement, de: Zone, a: Zone, mini?: Trajet['mini'], dx = 0, dy = 0) => trajets.push({ el, de, a, z: de, mini, debut: 0, fin: 1, dx, dy });
      for (const id in base.res) {
        const el = els[id], vu = el && ici.get(el), de = el && (vu?.z ?? depuis[id] ?? avant.res[id]);
        if (el && de && etat(id).flot === null && !entrees.includes(id) && !meme(de, base.res[id])) ajouter(el, de, base.res[id], vu?.mini);
      }
      // Celles qui se repliaient déjà continuent, liées aux nouvelles places
      for (const t of prec?.trajets ?? []) if (t.mini === 'sort' && !entrantes.some((x) => x[1] === t.el)) ajouter(t.el, t.z, t.a, 'sort', t.dx, t.dy);
      if (repli && elSortie) ajouter(elSortie, ici.get(elSortie)?.z ?? repli, centre(repli), 'sort');
      for (const r of replis) ajouter(r.el, r.de, centre(r.de), 'sort', r.dx, r.dy);
      for (const [, el, r] of entrantes) ajouter(el, ici.get(el)?.z ?? centre(r), r, 'entre');
      const voisines = trajets.filter((t) => !t.mini);
      for (const t of trajets) {
        if (t.mini === 'sort') t.fin = 1 - seuilMini(t.de, voisines.map((v) => ({ sans: v.a, avec: v.de })));
        if (t.mini === 'entre') t.debut = seuilMini(t.a, voisines.map((v) => ({ sans: v.de, avec: v.a })));
      }
      // Passage pas encore parti : ses fenêtres s'ajoutent, à la même courbe
      const c = repli || replis.length ? DOUCE : prec?.depart === null ? prec.courbe : VIVE;
      cancelAnimationFrame(imageLien);
      for (const t of prec?.trajets ?? []) t.el.style.transition = '';
      for (const t of trajets) {
        t.el.style.transition = 'none';
        clearTimeout(glisses.get(t.el));
        glisses.delete(t.el);
      }
      lien = null;
      appliquer(base, null, !action);
      lien = { trajets, courbe: c, depart: null, images: 0 };
      poserLien(0);
      imageLien = requestAnimationFrame(tourner);
      finGlisse = finDeGlissement();
    } else {
      if (lien?.trajets.some((t) => t.mini !== 'sort' && !(base.res[t.el.dataset.fen!] && meme(base.res[t.el.dataset.fen!], t.a)))) ceder();
      appliquer(base, null, !action);
    }
    coq.dataset.pret = '1';
    if (sans) requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.remove('sans-anim')));
  };
  // Icône de remise : visible et au clavier si la disposition a changé
  const montrerRemise = (vu: boolean) => {
    remise.classList.toggle('vu', vu);
    remise.tabIndex = vu ? 0 : -1;
  };
  const changer = () => { memoire.change = true; montrerRemise(true); };

  // Zone sous la main : bord d'écran, sinon tiers du côté de la fenêtre survolée
  function cibleSous(px: number, py: number, c: Cadre, enMain: string, depuis: { x: number; y: number }): Cible | null {
    // Aucune zone avant que la fenêtre soit emportée : la saisir ne range pas
    if (Math.hypot(px - depuis.x, py - depuis.y) < 60) return null;
    const dedans = px >= c.L && px <= c.R && py >= c.T && py <= c.B;
    if (!Object.keys(base.res).length) return dedans ? { remplir: true } : null;
    if (px < c.L + BORD) return { bord: true, cote: 'gauche' };
    if (px > c.R - BORD) return { bord: true, cote: 'droite' };
    if (py > c.B - BORD) return { bord: true, cote: 'bas' };
    for (const id in base.res) {
      if (id === enMain) continue;
      const r = base.res[id];
      if (px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h) continue;
      const d: Record<Cote, number> = { gauche: (px - r.x) / r.w, droite: (r.x + r.w - px) / r.w, haut: (py - r.y) / r.h, bas: (r.y + r.h - py) / r.h };
      const cote = (Object.keys(d) as Cote[]).reduce((u, v) => (d[u] <= d[v] ? u : v));
      return d[cote] > MARGE ? null : { id, cote };
    }
    return null;
  }
  const cle = (c: Cible | null) => (!c ? '' : c.remplir ? 'remplir' : (c.bord ? 'bord-' : c.id + '-') + c.cote);

  // Clic sur la prise : détachée tout de suite, ou remise en place
  const basculer = (id: string) => {
    const f = etat(id), el = els[id];
    if (!el) return;
    if (!f.flot) {
      const c = cadre(), r = el.getBoundingClientRect(), [w, h] = tailleDetachee(id, r, c);
      f.flot = { x: r.left - c.r.left + DECROCHE, y: r.top - c.r.top + DECROCHE, w, h };
      dansLEcran(f.flot, c);
      f.tailleFlot = [f.flot.w, f.flot.h];
      el.dataset.flot = '1';
      el.style.zIndex = f.z = String(++memoire.zMax);
      poser(el, f.flot);
    } else {
      rentrer(f, el);
    }
    changer();
    ranger(true);
  };
  // Le clic qui finit un glissement de la prise ne bascule pas
  let glisse = false;
  const cliquer = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest('.prise')?.closest<HTMLElement>('[data-fen]');
    if (el && !glisse) basculer(el.dataset.fen!);
    glisse = false;
  };

  const presser = (e: PointerEvent) => {
    const cible = e.target as HTMLElement;
    glisse = false;
    // Tout clic sur une fenêtre flottante la passe au premier plan
    const dessus = cible.closest<HTMLElement>('[data-fen]');
    if (dessus && etat(dessus.dataset.fen!).flot) dessus.style.zIndex = etat(dessus.dataset.fen!).z = String(++memoire.zMax);
    if (e.button !== 0) return;
    const c = cadre();
    const sep = cible.closest<HTMLElement>('.separateur');
    if (sep) {
      action = { type: 'fente', f: seps[+sep.dataset.i!], x0: e.clientX, y0: e.clientY, el: sep };
      sep.classList.add('actif');
      ov.classList.add('sans-anim', 'tire-en-cours');
      e.preventDefault();
      return;
    }
    const el = dessus;
    if (!el) return;
    const id = el.dataset.fen!, r = el.getBoundingClientRect();
    const taille = cible.closest<HTMLElement>('.taille');
    if (taille && etat(id).flot) {
      action = { type: 'taille', id, sens: taille.dataset.taille!, x0: e.clientX, y0: e.clientY, w0: r.width, h0: r.height };
      ov.classList.add('tire-en-cours');
      e.preventDefault();
      return;
    }
    const prise = cible.closest('.prise, ' + (o.tailles()[id]?.prises ?? o.prises()));
    if (!prise || !el.contains(prise)) return;
    if (!cible.closest('.prise') && cible.closest(INTERACTIF)) return;
    action = { type: 'fenetre', id, el, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, actif: false,
      depuis: { x: e.clientX - c.r.left, y: e.clientY - c.r.top }, cible: null, cle: '', minuteur: 0, bouges: false, arme: false };
    e.preventDefault();
  };

  const bouger = (e: PointerEvent) => {
    if (!action) return;
    ceder();
    const a = action, c = cadre();
    if (a.type === 'fente') {
      // Fente tirée : les deux cases voisines se partagent la place, minimum gardé
      const f = a.f, d = f.ligne ? e.clientX - a.x0 : e.clientY - a.y0;
      const ta = Math.min(Math.max(f.ta + d, f.ma), f.ta + f.tb - f.mb);
      f.n.parts[f.a] = ((ta - f.libreA) * f.somme) / f.total - f.ajoutA;
      f.n.parts[f.b] = ((f.ta + f.tb - ta - f.libreB) * f.somme) / f.total - f.ajoutB;
      base = calculer(memoire.racine);
      appliquer(base, null, true);
      const nf = base.fentes.find((x) => x.n === f.n && x.a === f.a);
      if (nf) Object.assign(a.el.style, { left: nf.x + 'px', top: nf.y + 'px' });
      return;
    }
    if (a.type === 'taille') {
      // Fenêtre flottante tirée par son bord ou son coin, sans sortir de l'écran
      const fl = etat(a.id).flot!, m = mini(a.id);
      if (a.sens !== 'b') fl.w = Math.min(Math.max(a.w0 + e.clientX - a.x0, m[0]), c.r.width - fl.x);
      if (a.sens !== 'd') fl.h = Math.min(Math.max(a.h0 + e.clientY - a.y0, m[1]), c.r.height - fl.y);
      etat(a.id).tailleFlot = [fl.w, fl.h];
      poser(els[a.id]!, fl);
      return;
    }
    const f = etat(a.id);
    if (!a.actif) {
      if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < SEUIL) return;
      a.actif = true;
      a.el.dataset.flot = '1';
      a.el.style.zIndex = f.z = String(++memoire.zMax);
      ov.classList.add('glisse-en-cours');
      if (!f.flot) {
        // Détachée : elle reprend sa dernière taille flottante, jamais celle de sa case
        const r = a.el.getBoundingClientRect(), [w, h] = tailleDetachee(a.id, r, c);
        a.dx = Math.min((a.dx / r.width) * w, w - 24);
        a.dy = Math.min(a.dy, 30);
        f.flot = { x: e.clientX - c.r.left - a.dx, y: r.top - c.r.top, w, h };
        f.tailleFlot = [w, h];
        base = calculer(memoire.racine);
        appliquer(base, a.id, false);
      }
    }
    // Flottante, elle suit la main ; sa tête ne quitte jamais l'écran
    const fl = f.flot!;
    fl.x = e.clientX - c.r.left - a.dx;
    fl.y = e.clientY - c.r.top - a.dy;
    aPortee(fl, c);
    poser(a.el, fl);
    const cible = cibleSous(e.clientX - c.r.left, e.clientY - c.r.top, c, a.id, a.depuis), k = cle(cible);
    // Aimant à la pause : main immobile sur une zone, les autres s'écartent
    const armer = () => {
      a.ax = e.clientX;
      a.ay = e.clientY;
      clearTimeout(a.minuteur);
      a.minuteur = window.setTimeout(() => {
        if (action !== a || a.cle !== k || !a.essai) return;
        a.arme = true;
        const r = a.essai.res[a.id];
        Object.assign(entiere.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
        entiere.classList.add('vu');
        appliquer(a.essai, a.id, false);
        a.bouges = true;
      }, ARMEMENT);
    };
    if (k === a.cle) {
      if (cible && !a.arme && Math.hypot(e.clientX - a.ax!, e.clientY - a.ay!) > IMMOBILE) armer();
      return;
    }
    a.cle = k;
    a.cible = cible;
    a.arme = false;
    entiere.classList.remove('vu');
    clearTimeout(a.minuteur);
    if (a.bouges) { appliquer(base, a.id, false); a.bouges = false; }
    if (!cible) return;
    const arbre = normaliser(inserer(normaliser(retirer(copie(memoire.racine), a.id)), cible, a.id));
    // Une place qui dépasserait la grille n'en est pas une
    if (arbre && !tient(arbre)) {
      a.cible = null;
      a.essai = undefined;
      return;
    }
    const essai = calculer(arbre, a.id);
    // Un essai sans case pour elle ne vaut rien
    if (!essai.res[a.id]) {
      a.cible = null;
      a.essai = undefined;
      return;
    }
    a.essai = essai;
    armer();
  };

  const lacher = () => {
    if (!action) return;
    const a = action;
    action = null;
    ov.classList.remove('glisse-en-cours', 'tire-en-cours', 'sans-anim');
    if (a.type === 'fente') { a.el.classList.remove('actif'); ranger(false); changer(); return; }
    if (a.type === 'taille') { changer(); return; }
    clearTimeout(a.minuteur);
    entiere.classList.remove('vu');
    if (!a.actif) return;
    glisse = true;
    changer();
    if (a.cible && a.arme) {
      // Posée sur une cible : elle glisse vers sa case, l'arbre garde le partage
      memoire.racine = normaliser(inserer(normaliser(retirer(memoire.racine, a.id)), a.cible, a.id));
      rentrer(etat(a.id), a.el);
    }
    ranger(true);
  };

  // Remise en place : arbre de départ, fenêtres rangées, tailles oubliées
  const remettre = () => {
    memoire.racine = copie(racineDepart);
    memoire.change = false;
    for (const id in fen) {
      fen[id] = { flot: null, tailleFlot: null, z: '' };
      const el = els[id];
      if (!el) continue;
      delete el.dataset.flot;
      el.style.zIndex = '';
    }
    montrerRemise(false);
    ranger(true);
  };

  coq.addEventListener('pointerdown', presser);
  coq.addEventListener('click', cliquer);
  window.addEventListener('pointermove', bouger);
  window.addEventListener('pointerup', lacher);
  window.addEventListener('pointercancel', lacher);
  remise.addEventListener('click', remettre);
  // Page redimensionnée : tout se range de nouveau, sauf à la première mesure
  let mesure = `${coq.clientWidth}x${coq.clientHeight}`;
  const observateur = new ResizeObserver(() => {
    const m = `${coq.clientWidth}x${coq.clientHeight}`;
    if (m === mesure || action) return;
    mesure = m;
    ranger(false);
  });
  observateur.observe(coq);
  montrerRemise(memoire.change);
  // Dock remonté (mode strict) : le rangement qui n'était pas parti continue
  if (memoire.lien) {
    lien = memoire.lien;
    memoire.lien = null;
    finGlisse = finDeGlissement();
    imageLien = requestAnimationFrame(tourner);
  }
  ranger(false);
  // Lecture de l'état pour le banc d'essai
  (coq as HTMLElement & { etatDock?: () => unknown }).etatDock = () => ({
    racine: copie(memoire.racine), base: base.res,
    action: action && { type: action.type, ...(action.type === 'fenetre' ? { actif: action.actif, cle: action.cle, bouges: action.bouges, arme: action.arme } : {}) },
  });

  return {
    ranger,
    figer,
    degeler,
    detruire: () => {
      if (lien?.depart === null) {
        cancelAnimationFrame(imageLien);
        memoire.lien = lien;
        queueMicrotask(() => { memoire.lien = null; });
      } else ceder();
      if (action?.type === 'fenetre') clearTimeout(action.minuteur);
      action = null;
      coq.removeEventListener('pointerdown', presser);
      coq.removeEventListener('click', cliquer);
      window.removeEventListener('pointermove', bouger);
      window.removeEventListener('pointerup', lacher);
      window.removeEventListener('pointercancel', lacher);
      remise.removeEventListener('click', remettre);
      observateur.disconnect();
      // Glissements en cours finis : leur minuteur rend la transition au dock remonté
      sepEls.forEach((s) => s.remove());
      ov.classList.remove('glisse-en-cours', 'tire-en-cours', 'sans-anim');
    },
  };
}
