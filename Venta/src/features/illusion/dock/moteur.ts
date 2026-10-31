// Mécanique organique : fenêtres en arbre de partages, détachées, aimantées à la pause, rangées ou flottantes
export type Taille = [number, number];
export type DefFenetre = { mini?: Taille; pref?: Taille; flot?: Taille; prises?: string };
export type Feuille = { id: string };
export type Partage = { dir: 'row' | 'col'; enfants: Arbre[]; parts: number[] };
export type Arbre = Feuille | Partage;
export type Zone = { x: number; y: number; w: number; h: number };
export type ArbreDepart = Arbre | ((zone: Zone, style: CSSStyleDeclaration) => Arbre);

export const ECART = 16, SEUIL = 6, BORD = 26, MARGE = 0.3, ARMEMENT = 450, IMMOBILE = 10;
// Glissement des fenêtres vers leur place, le même que celui de la feuille de style (0,3 s)
export const DUREE_RANGEMENT = 300;
const TRANSITION = ['left', 'top', 'width', 'height'].map((p) => `${p} ${DUREE_RANGEMENT}ms cubic-bezier(.2,.8,.2,1)`).join(',');
const MINI_DEFAUT: Taille = [200, 160];
const PREF_DEFAUT: Taille = [400, 300];
// Têtes qui servent de prise, en plus de la rangée de points
export const PRISES = '.tete, .echos-tete, .p-tete, .outils';
const INTERACTIF = 'a,button,input,select,textarea,label,summary,[role=button]';

type Cote = 'gauche' | 'droite' | 'haut' | 'bas';
type Cible = { remplir?: boolean; bord?: boolean; id?: string; cote?: Cote };
type Fente = { n: Partage; a: number; b: number; ta: number; tb: number; ma: number; mb: number; somme: number; total: number; ligne: boolean; ajoutA: number; ajoutB: number; libreA: number; libreB: number } & Zone;
type Calcul = { res: Record<string, Zone>; fentes: Fente[] };
type EtatFenetre = { flot: Zone | null; tailleFlot: Taille | null; z: string };
// Disposition d'une page, gardée pendant la session : revenir sur la page la retrouve jusqu'à la remise
type Memoire = { racine: Arbre | null; fen: Record<string, EtatFenetre>; zMax: number; change: boolean };
type Action =
  | { type: 'fente'; f: Fente; x0: number; y0: number; el: HTMLElement }
  | { type: 'taille'; id: string; sens: string; x0: number; y0: number; w0: number; h0: number }
  | {
      type: 'fenetre'; id: string; el: HTMLElement; x0: number; y0: number; dx: number; dy: number; actif: boolean;
      depuis: { x: number; y: number }; cible: Cible | null; cle: string; minuteur: number; bouges: boolean; arme: boolean;
      ax?: number; ay?: number; essai?: Calcul;
    };

const MEMOIRES = new Map<string, Memoire>();

export type OptionsDock = {
  id: string;
  principal: () => string;
  depart: () => ArbreDepart;
  tailles: () => Record<string, DefFenetre>;
  prises: () => string;
  entiere: HTMLElement;
  fentes: HTMLElement;
  remise: HTMLElement;
};
// Fenêtres qui se déplient depuis leur bord, ou celle qui se replie vers le sien, pendant que les autres prennent ou rendent la place
export type OptionsRangement = { entrees?: string[]; sortie?: string };
export type Moteur = { ranger: (anime: boolean, options?: OptionsRangement) => void; detruire: () => void };

const feuille = (n: Arbre): n is Feuille => (n as Feuille).id !== undefined;
const copie = <T,>(n: T): T => JSON.parse(JSON.stringify(n));
const ids = (n: Arbre | null): string[] => (!n ? [] : feuille(n) ? [n.id] : n.enfants.flatMap(ids));

export function installerDock(coq: HTMLElement, o: OptionsDock): Moteur {
  const ov = (coq.closest('.ov') as HTMLElement | null) ?? coq;
  const { entiere, remise } = o;
  const mini = (id: string) => o.tailles()[id]?.mini ?? MINI_DEFAUT;
  const pref = (id: string) => o.tailles()[id]?.pref ?? PREF_DEFAUT;
  const els: Record<string, HTMLElement | null> = {};
  let seps: Fente[] = [], action: Action | null = null;
  const sepEls: HTMLElement[] = [];

  const cadre = () => {
    const r = coq.getBoundingClientRect(), s = getComputedStyle(coq);
    return { r, L: parseFloat(s.paddingLeft), T: parseFloat(s.paddingTop), R: r.width - parseFloat(s.paddingRight), B: r.height - parseFloat(s.paddingBottom) };
  };
  type Cadre = ReturnType<typeof cadre>;
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
  // Fenêtres en train de se replier : encore peintes, déjà hors du partage ; oubliées une fois cachées
  const sorties = new Set<string>();
  const affichee = (id: string) => {
    const el = els[id];
    if (!el || getComputedStyle(el).display === 'none') { sorties.delete(id); return false; }
    return !sorties.has(id) && (id === inclus || etat(id).flot === null);
  };
  const visible = (n: Arbre): boolean => (feuille(n) ? affichee(n.id) : n.enfants.some(visible));
  const miniArbre = (n: Arbre, axe: 'w' | 'h'): number => {
    if (feuille(n)) return mini(n.id)[axe === 'w' ? 0 : 1];
    const vis = n.enfants.filter(visible);
    if ((n.dir === 'row') === (axe === 'w')) return vis.reduce((s, c) => s + miniArbre(c, axe), 0) + ECART * Math.max(vis.length - 1, 0);
    return Math.max(0, ...vis.map((c) => miniArbre(c, axe)));
  };

  // Partage simplifié : plus de case vide, plus de partage à un seul enfant, deux partages de même sens fondus en un
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
  function retirer(n: Arbre | null, id: string): Arbre | null {
    if (!n) return null;
    if (feuille(n)) return n.id === id ? null : n;
    const paires = n.enfants.map((c, i): [Arbre | null, number] => [retirer(c, id), n.parts[i]]).filter((q): q is [Arbre, number] => !!q[0]);
    n.enfants = paires.map((q) => q[0]);
    n.parts = paires.map((q) => q[1]);
    return n;
  }
  // Pose la fenêtre sur un côté d'une autre : elle prend la moitié de sa case ; sur un bord de l'écran, une bande de sa taille préférée
  function inserer(arbre: Arbre | null, cible: Cible, id: string): Arbre | null {
    if (cible.remplir) return arbre || { id };
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

  // Taille de chaque case : chacun sa part, jamais sous son minimum ; les fentes entre cases sont notées pour être tirées
  function calculer(arbre: Arbre | null, avec?: string): Calcul {
    // `avec` : la fenêtre en main, comptée dans le calcul d'essai bien qu'elle flotte
    inclus = avec || null;
    const res: Record<string, Zone> = {}, fentes: Fente[] = [];
    const rec = (n: Arbre, r: Zone) => {
      if (feuille(n)) { res[n.id] = r; return; }
      const idx = n.enfants.map((_, i) => i).filter((i) => visible(n.enfants[i]));
      if (!idx.length) return;
      const ligne = n.dir === 'row';
      // La part d'une fenêtre cachée (panneau fermé) revient à la fenêtre principale du partage, avec l'écart qui la séparait :
      // les autres (l'Activité) gardent leur largeur au pixel près
      const jp = idx.findIndex((i) => ids(n.enfants[i]).includes(o.principal()));
      const cachee = jp < 0 ? 0 : n.parts.reduce((s, p, i) => (idx.includes(i) ? s : s + p), 0);
      const libres = jp < 0 ? 0 : ECART * (n.enfants.length - idx.length);
      const total = (ligne ? r.w : r.h) - ECART * (idx.length - 1) - libres;
      const parts = idx.map((i, j) => n.parts[i] + (j === jp ? cachee : 0));
      const somme = parts.reduce((s, p) => s + p, 0);
      const mins = idx.map((i) => miniArbre(n.enfants[i], ligne ? 'w' : 'h'));
      const minsPart = mins.map((m, j) => (j === jp ? Math.max(0, m - libres) : m));
      let t = parts.map((p) => (total * p) / somme);
      for (let k = 0; k < 4; k++) {
        let manque = 0;
        t = t.map((v, j) => { if (v < minsPart[j]) { manque += minsPart[j] - v; return minsPart[j]; } return v; });
        if (manque < 0.5) break;
        const libre = t.map((v, j) => Math.max(0, v - minsPart[j])), sl = libre.reduce((a, b) => a + b, 0);
        if (!sl) break;
        t = t.map((v, j) => v - (manque * libre[j]) / sl);
      }
      if (jp >= 0) t[jp] += libres;
      let pos = ligne ? r.x : r.y;
      idx.forEach((i, j) => {
        rec(n.enfants[i], ligne ? { x: pos, y: r.y, w: t[j], h: r.h } : { x: r.x, y: pos, w: r.w, h: t[j] });
        pos += t[j];
        if (j < idx.length - 1) {
          fentes.push({ n, a: i, b: idx[j + 1], ta: t[j], tb: t[j + 1], ma: mins[j], mb: mins[j + 1], somme, total, ligne,
            ajoutA: j === jp ? cachee : 0, ajoutB: j + 1 === jp ? cachee : 0, libreA: j === jp ? libres : 0, libreB: j + 1 === jp ? libres : 0,
            x: ligne ? pos : r.x, y: ligne ? r.y : pos, w: ligne ? ECART : r.w, h: ligne ? r.h : ECART });
          pos += ECART;
        }
      });
    };
    if (arbre) rec(arbre, zoneUtile(cadre()));
    inclus = null;
    return { res, fentes };
  }

  const placer = (el: HTMLElement, r: Zone) =>
    Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', right: 'auto', bottom: 'auto' });
  function poser(el: HTMLElement, r: Zone) {
    placer(el, r);
    el.dataset.forme = r.w > 520 && r.h < r.w * 0.6 ? 'large' : 'haute';
    // Paliers de largeur : chacun laisse au moins 8 px entre les colonnes qu'il garde
    el.dataset.l = r.w < 600 ? 'xs' : r.w < 720 ? 's' : r.w < 1000 ? 'm' : 'l';
  }
  // Applique un calcul aux fenêtres rangées (sauf celle en main) et place les fentes tirables
  function appliquer(calc: Calcul, sauf: string | null, avecFentes: boolean) {
    for (const id in calc.res) { const el = els[id]; if (el && id !== sauf && !sorties.has(id) && etat(id).flot === null) poser(el, calc.res[id]); }
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

  // Les fenêtres présentes dans la page ; une fenêtre absente de l'arbre et rangée se pose sur le bord droit
  function scanner() {
    const vus = new Set<string>();
    coq.querySelectorAll<HTMLElement>('[data-fen]').forEach((el) => {
      const id = el.dataset.fen!;
      vus.add(id);
      if (els[id] === el) return;
      els[id] = el;
      // Une fenêtre reprise (retour sur la page, autre disposition) prend l'état gardé, flottante ou rangée
      const f = etat(id);
      el.style.zIndex = f.z;
      if (!f.flot) {
        delete el.dataset.flot;
        return;
      }
      el.dataset.flot = '1';
      poser(el, f.flot);
    });
    for (const id in els) if (!vus.has(id)) { els[id] = null; sorties.delete(id); }
    const places = ids(memoire.racine);
    vus.forEach((id) => { if (!etat(id).flot && !places.includes(id)) memoire.racine = normaliser(inserer(memoire.racine, { bord: true, cote: 'droite' }, id)); });
  }

  // Fenêtre repliée : réduite à un point sur le bord de son partage qu'elle occupe, un écart au-delà, pour que sa voisine la suive
  // en gardant 16 px jusqu'au bout ; au milieu d'un partage ou flottante, vers son centre. En hauteur (ou en largeur), vers son milieu.
  function pli(id: string, r: Zone): Zone {
    const trouve: { dir: 'row' | 'col' | null; place: number } = { dir: null, place: 0 };
    const rec = (n: Arbre): boolean => {
      if (feuille(n)) return false;
      const vis = n.enfants.filter(visible);
      const i = vis.findIndex((c) => feuille(c) && c.id === id);
      if (i < 0) return n.enfants.some(rec);
      trouve.dir = n.dir;
      trouve.place = vis.length < 2 ? 0 : i === 0 ? -1 : i === vis.length - 1 ? 1 : 0;
      return true;
    };
    if (memoire.racine && etat(id).flot === null) rec(memoire.racine);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, bout = (debut: number, long: number, milieu: number) =>
      trouve.place > 0 ? debut + long + ECART : trouve.place < 0 ? debut - ECART : milieu;
    if (trouve.dir === 'row') return { x: bout(r.x, r.w, cx), y: cy, w: 0, h: 0 };
    if (trouve.dir === 'col') return { x: cx, y: bout(r.y, r.h, cy), w: 0, h: 0 };
    return { x: cx, y: cy, w: 0, h: 0 };
  }

  let base: Calcul = { res: {}, fentes: [] };
  // Fin du dernier glissement lancé : un rangement sans animation demandé d'ici là (taille de la page relue) ne le coupe pas
  let finGlisse = 0;
  const glisses = new Map<HTMLElement, number>();
  // Le glissement porté par la fenêtre elle-même : il vaut aussi pour une flottante, qui n'en a pas d'ordinaire
  const glisser = (el: HTMLElement) => {
    el.style.transition = TRANSITION;
    clearTimeout(glisses.get(el));
    glisses.set(el, window.setTimeout(() => { el.style.transition = ''; glisses.delete(el); }, DUREE_RANGEMENT + 60));
  };
  const ranger = (anime: boolean, { entrees = [], sortie }: OptionsRangement = {}) => {
    scanner();
    const sans = !anime && performance.now() > finGlisse;
    if (sans) ov.classList.add('sans-anim');
    else if (!action && ov.classList.contains('sans-anim')) {
      // Juste après une pose sans animation (arrivée sur la page) : la place posée est prise pour départ, puis tout glisse
      void coq.offsetWidth;
      ov.classList.remove('sans-anim');
    }
    if (anime && (entrees.length || sortie)) finGlisse = performance.now() + DUREE_RANGEMENT + 60;
    // Celle qui sort se replie depuis sa place, pendant que les autres la prennent
    const elSortie = sortie ? els[sortie] : null;
    if (sortie && elSortie && !sorties.has(sortie) && getComputedStyle(elSortie).display !== 'none') {
      const r = etat(sortie).flot ?? base.res[sortie];
      if (r) {
        const p = pli(sortie, r);
        glisser(elSortie);
        placer(elSortie, p);
      }
      sorties.add(sortie);
    }
    // Celle qui revient pendant qu'elle se repliait repart de là où elle en est ; une nouvelle part de son point replié
    const revenues = entrees.filter((id) => sorties.delete(id));
    base = calculer(memoire.racine);
    for (const id of entrees) {
      const el = els[id], r = el && (etat(id).flot ?? base.res[id]);
      if (!el || !r || !anime) continue;
      if (!revenues.includes(id)) {
        el.style.transition = 'none';
        placer(el, pli(id, r));
        void el.offsetWidth;
      }
      glisser(el);
      if (etat(id).flot) poser(el, r);
    }
    appliquer(base, null, !action);
    coq.dataset.pret = '1';
    if (sans) requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.remove('sans-anim')));
  };
  // Icône de remise : visible et atteignable au clavier seulement quand la disposition a changé
  const montrerRemise = (vu: boolean) => {
    remise.classList.toggle('vu', vu);
    remise.tabIndex = vu ? 0 : -1;
  };
  const changer = () => { memoire.change = true; montrerRemise(true); };

  // Zone sous la main : un bord de l'écran, sinon le tiers d'un côté de la fenêtre survolée ; page vide : toute la place
  function cibleSous(px: number, py: number, c: Cadre, enMain: string, depuis: { x: number; y: number }): Cible | null {
    // Aucune zone tant que la fenêtre n'a pas été emportée : la saisir puis hésiter ne la range pas
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

  const presser = (e: PointerEvent) => {
    const cible = e.target as HTMLElement;
    // N'importe quel clic sur une fenêtre flottante, bords et commandes compris, la passe au premier plan
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
    const a = action, c = cadre();
    if (a.type === 'fente') {
      // Fente tirée : les deux cases voisines se partagent la place, chacune garde son minimum
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
      // Fenêtre flottante tirée par son bord ou son coin ; elle peut dépasser de la page
      const fl = etat(a.id).flot!, m = mini(a.id);
      if (a.sens !== 'b') fl.w = Math.max(a.w0 + e.clientX - a.x0, m[0]);
      if (a.sens !== 'd') fl.h = Math.max(a.h0 + e.clientY - a.y0, m[1]);
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
        // Détachée : elle reprend sa dernière taille flottante (ou celle d'un premier détachement), jamais celle de sa case ; les autres se rangent une fois sans elle
        const r = a.el.getBoundingClientRect(), m = mini(a.id), t = f.tailleFlot || o.tailles()[a.id]?.flot || [r.width, r.height];
        const w = Math.max(Math.min(t[0], c.r.width - 40), m[0]), h = Math.max(Math.min(t[1], c.r.height - 40), m[1]);
        a.dx = Math.min((a.dx / r.width) * w, w - 24);
        a.dy = Math.min(a.dy, 30);
        f.flot = { x: e.clientX - c.r.left - a.dx, y: r.top - c.r.top, w, h };
        f.tailleFlot = [w, h];
        memoire.racine = normaliser(retirer(memoire.racine, a.id));
        base = calculer(memoire.racine);
        appliquer(base, a.id, false);
      }
    }
    // Flottante, elle peut sortir à gauche, à droite et en bas ; sa tête reste toujours attrapable (80 px de large, 40 px de haut)
    const fl = f.flot!;
    fl.x = Math.min(Math.max(e.clientX - c.r.left - a.dx, 80 - fl.w), c.r.width - 80);
    fl.y = Math.min(Math.max(e.clientY - c.r.top - a.dy, 0), c.r.height - 40);
    poser(a.el, fl);
    const cible = cibleSous(e.clientX - c.r.left, e.clientY - c.r.top, c, a.id, a.depuis), k = cle(cible);
    // Aimant à la pause : main immobile sur une zone, les autres s'écartent et ce vide est la place ; bouger relance, changer de zone annule
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
    a.essai = calculer(normaliser(inserer(copie(memoire.racine), cible, a.id)), a.id);
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
    changer();
    if (a.cible && a.arme) {
      // Posée sur une cible : elle rejoint sa case en glissant, l'arbre garde le nouveau partage
      memoire.racine = normaliser(inserer(memoire.racine, a.cible, a.id));
      const f = etat(a.id);
      f.flot = null;
      f.z = '';
      delete a.el.dataset.flot;
      a.el.style.zIndex = '';
    }
    ranger(true);
  };

  // Remise en place : l'arbre de départ, toutes les fenêtres rangées, leurs tailles flottantes oubliées
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
  window.addEventListener('pointermove', bouger);
  window.addEventListener('pointerup', lacher);
  window.addEventListener('pointercancel', lacher);
  remise.addEventListener('click', remettre);
  // La page qui change de taille : tout se range de nouveau ; la première mesure, celle de la pose, ne change rien
  let mesure = `${coq.clientWidth}x${coq.clientHeight}`;
  const observateur = new ResizeObserver(() => {
    const m = `${coq.clientWidth}x${coq.clientHeight}`;
    if (m === mesure || action) return;
    mesure = m;
    ranger(false);
  });
  observateur.observe(coq);
  montrerRemise(memoire.change);
  ranger(false);
  // Lecture de l'état pour le banc d'essai
  (coq as HTMLElement & { etatDock?: () => unknown }).etatDock = () => ({
    racine: copie(memoire.racine), base: base.res,
    action: action && { type: action.type, ...(action.type === 'fenetre' ? { actif: action.actif, cle: action.cle, bouges: action.bouges, arme: action.arme } : {}) },
  });

  return {
    ranger,
    detruire: () => {
      if (action?.type === 'fenetre') clearTimeout(action.minuteur);
      action = null;
      coq.removeEventListener('pointerdown', presser);
      window.removeEventListener('pointermove', bouger);
      window.removeEventListener('pointerup', lacher);
      window.removeEventListener('pointercancel', lacher);
      remise.removeEventListener('click', remettre);
      observateur.disconnect();
      glisses.forEach((m, el) => { clearTimeout(m); el.style.transition = ''; });
      sepEls.forEach((s) => s.remove());
      ov.classList.remove('glisse-en-cours', 'tire-en-cours', 'sans-anim');
    },
  };
}
