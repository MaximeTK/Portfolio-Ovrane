/** Fond vivant de la Bande 16 : nappes, détails en flaques, ondes de l'œil */
import type { ColorPalette } from './colorPalettes';

type Rgb = [number, number, number];
interface Teinte {
  arc: boolean;
  base: Rgb;
  stops: Rgb[];
}
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const NOIR: Rgb = [5, 5, 6];
const hexa = (h: string): Rgb => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)) as Rgb;
const melange = (a: Rgb, b: Rgb, f: number): Rgb => a.map((v, k) => v + (b[k] - v) * f) as Rgb;
const css = (c: Rgb, a = 1) => `rgb(${c.map(Math.round).join(' ')} / ${a})`;

/** Teinte d'une palette : fond assombri, nappes du bas vers la lumière */
export function teinteDe(p: ColorPalette): Teinte {
  if (p.arc) return { arc: true, base: NOIR, stops: [] };
  const lumiere = hexa(p.lumiere);
  return { arc: false, base: melange(NOIR, hexa(p.topColor), 0.55), stops: [hexa(p.bottomColor), lumiere, melange(lumiere, [255, 255, 255], 0.5)] };
}

/** Couleur de base d'une palette, pour le fond avant le premier dessin */
export const baseDe = (p: ColorPalette) => css(teinteDe(p).base);

// Couleur du dégradé : arc-en-ciel qui tourne, ou teinte en aller-retour
function couleur(c: Teinte, u: number, t: number): Rgb {
  if (c.arc) {
    const h = (((u * 300 + t * 24) % 360) + 360) % 360, l = 0.62, q = 0.95 * Math.min(l, 1 - l);
    const k = (n: number) => (n + h / 30) % 12;
    return [0, 8, 4].map((n) => 255 * (l - q * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))) as Rgb;
  }
  let x = (((u + t * 0.05) % 1) + 1) % 1;
  x = x < 0.5 ? x * 2 : 2 - x * 2;
  const n = c.stops.length - 1, i = Math.min(n - 1, Math.floor(x * n));
  return melange(c.stops[i], c.stops[i + 1], x * n - i);
}

// Réglages retenus sur la Bande 16
const G = 10, IPS = 60, ALPHA = 0.8, FS = 10, CW = 6.5, CH = 13;
const T_ONDE = 3, S0 = 1.14, NB_ONDES = 4, EXTINCTION = 0.55, LARGEUR = 1.05, FONDU = 2.5;
// Pointes de la protection de l'œil un peu rentrées ; bokeh qui naissent en 2,4 s
const POINTE = 1.1, ARRIVEE = 2.4;
// Silhouette du logo d'Illusion : demi-colonne, pente et départ des pieds
const COLONNE = 0.401, PENTE = 0.9286, PIED = 0.1049;
const V6 = [[0, -0.5], [0.5, -0.262], [0.5, 0.262], [0, 0.5], [-0.5, 0.262], [-0.5, -0.262]];
const ENCRE = 'rgb(204 204 204)';
const MOTS = ['const', 'let', '=>', 'onde', 'œil', 'teinte(u)', 'S.bruit(x,', 'y)', 'hex(o,', '3.37)', 'return', '{', '}', 'for', '(i=0;',
  'i<n;', 'i++)', 'if', '(d<3.5)', 'ctx.fill()', '0.476', 'nappes(t)', 'masque', 'alpha', '0x3F', 'await', 'appel()', 'jade', 'rejeu',
  'arbre', '+=', '*', '//', 'ok'];

const lis = (a: number, b: number, x: number) => {
  const v = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return v * v * (3 - 2 * v);
};
const hache = (a: number, b: number, c = 0) => {
  let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

/** Fond lancé : `lent`, une image sur deux ; `eveil`, bokeh nés ; `details`, coulisses */
export function lancerFond(toile: HTMLCanvasElement, lirePalette: () => ColorPalette, actif: () => boolean, lent: () => boolean, eveil: () => boolean,
  details: () => boolean): () => void {
  const ctx = toile.getContext('2d')!;
  // Bruit de valeur en 3D, lissé, entre -1 et 1, tiré d'une graine fixe
  let graine = 1234567;
  const alea = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;
  const P = Array.from({ length: 512 }, () => Math.floor(alea() * 256));
  const h3 = (x: number, y: number, z: number) => P[(P[(P[x & 255] + y) & 255] + z) & 255] / 127.5 - 1;
  const doux = (u: number) => u * u * (3 - 2 * u);
  const bruit = (x: number, y: number, z = 0) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = doux(x - X), v = doux(y - Y), w = doux(z - Z);
    const m = (a: number, b: number, f: number) => a + (b - a) * f;
    return m(m(m(h3(X, Y, Z), h3(X + 1, Y, Z), u), m(h3(X, Y + 1, Z), h3(X + 1, Y + 1, Z), u), v),
      m(m(h3(X, Y, Z + 1), h3(X + 1, Y, Z + 1), u), m(h3(X, Y + 1, Z + 1), h3(X + 1, Y + 1, Z + 1), u), v), w);
  };

  let W = 1, H = 1, k = 1, t = 0, t0 = -1, croit = 1;
  // L'œil et sa présence : effacé, sa protection s'estompe en 0,8 s
  let oeil: Rect = { x: 0, y: 0, w: 0, h: 0 }, present = false, vu = 0;
  // Palette en cours et fondu depuis la précédente
  let palette = lirePalette(), cible = teinteDe(palette), depuis = cible, fondu = 1, debutFondu = 0;
  const teinte = (u: number, a: number) => {
    const A = couleur(cible, u, t);
    return css(fondu < 1 ? melange(couleur(depuis, u, t), A, fondu) : A, a);
  };
  const base = () => css(fondu < 1 ? melange(depuis.base, cible.base, fondu) : cible.base);

  // Nappes de dégradé floues qui se déforment et se fondent
  const nappes = () => {
    const M = Math.min(W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 8; i++) {
      const u = i / 8, s = i * 4.7;
      const x = W * (0.5 + 0.75 * bruit(s, t * 0.05)), y = H * (0.5 + 0.75 * bruit(s + 20, t * 0.05));
      const rx = M * 0.46 * croit * (1 + 0.3 * bruit(s + 3, t * 0.09)), ry = M * 0.3 * croit * (1 + 0.3 * bruit(s + 6, t * 0.09));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, teinte(u, 0.65));
      g.addColorStop(0.45, teinte(u + 0.05, 0.325));
      g.addColorStop(1, teinte(u + 0.1, 0));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s + t * 0.07);
      ctx.scale(rx, ry);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  // Lumières des nappes, placées comme les nappes elles-mêmes
  const NP: number[][] = [];
  const lumieres = (M: number) => {
    NP.length = 0;
    for (let i = 0; i < 8; i++) {
      const s = i * 4.7, a = s + t * 0.07;
      NP.push([W * (0.5 + 0.75 * bruit(s, t * 0.05)), H * (0.5 + 0.75 * bruit(s + 20, t * 0.05)), Math.cos(a), Math.sin(a),
        1 / (M * 0.46 * croit * (1 + 0.3 * bruit(s + 3, t * 0.09))), 1 / (M * 0.3 * croit * (1 + 0.3 * bruit(s + 6, t * 0.09)))]);
    }
  };
  const lum = (x: number, y: number) => {
    let r = 1;
    for (const [cx, cy, co, si, iu, iw] of NP) {
      // Hors de l'ellipse d'une nappe, elle n'éclaire rien : pas de racine
      const dx = x - cx, dy = y - cy, u = (dx * co + dy * si) * iu, w = (dy * co - dx * si) * iw, d2 = u * u + w * w;
      if (d2 >= 1) continue;
      const d = Math.sqrt(d2);
      r *= 1 - (d < 0.45 ? 1 - d / 0.9 : (0.5 * (1 - d)) / 0.55);
    }
    return 1 - r;
  };

  // Une onde naît de chaque onde de l'œil, quand Ovrane parle, à 0,75 s d'écart
  const vues = new WeakSet<Element>();
  let naissances: number[] = [];
  const ecouter = () => {
    for (const el of document.querySelectorAll('.hexagon-wave')) {
      if (vues.has(el)) continue;
      vues.add(el);
      if (!naissances.length || t - naissances[naissances.length - 1] >= T_ONDE / NB_ONDES) naissances.push(t);
    }
    naissances = naissances.filter((n) => t - n < T_ONDE);
  };
  // Ondes de l'œil : taille et éclat de chacune, calculés une fois par instant
  let smax = 30, ct = -1, oc: [number, number][] = [];
  const ondes = () => {
    if (t !== ct) {
      ct = t;
      oc = naissances.map((n) => {
        const f = (t - n) / T_ONDE, s = S0 * Math.pow(smax / S0, f);
        return [s, lis(1.14, 1.6, s) * (1 - lis(0.05, EXTINCTION, f))];
      });
    }
    return oc;
  };
  // Rien derrière l'œil, selon `de` ; une bande autour de chaque onde vive
  const protege = (d: number, de: number) => {
    if (de < 1.2) return 0;
    let p = lis(1.2, 1.5, de);
    for (const [s, b] of ondes()) {
      if (b <= 0.02) continue;
      const w = (0.16 + 0.035 * s) * b * LARGEUR;
      p *= lis(w, w * 1.4, Math.abs(d - s));
    }
    return p;
  };
  // Les ondes partent de l'œil, grossissent et s'éteignent en route
  const dessinerOndes = (o: Rect) => {
    const dc = (x: number, y: number) => {
      const u = Math.abs(x - o.x) / (o.w / 2);
      return Math.max(u, Math.abs(y - o.y) / (o.h / 2) + 0.476 * u);
    };
    smax = Math.max(dc(0, 0), dc(W, 0), dc(0, H), dc(W, H)) * 1.25 + 2;
    for (const [s, b] of ondes()) {
      if (b < 0.01) continue;
      ctx.strokeStyle = `rgb(255 255 255 / ${0.85 * b})`;
      ctx.lineWidth = 1.2 + 0.12 * s;
      ctx.beginPath();
      V6.forEach(([x, y], i) => (i ? ctx.lineTo(o.x + x * o.w * s, o.y + y * o.h * s) : ctx.moveTo(o.x + x * o.w * s, o.y + y * o.h * s)));
      ctx.closePath();
      ctx.stroke();
    }
  };

  // Zones protégées : bande, boîte ou logo, chacune ouverte en largeur en 0,8 s
  type Zone = Rect & { boite: boolean; logo: boolean };
  const zones = new Map<Element, { r: Zone; k: number; e: number }>();
  let lues = new Map<Element, Zone>(), zt = -1;
  const avance = (calme: boolean) => {
    if (t === zt && !calme) return;
    const dt = zt < 0 ? 0 : Math.min(0.1, Math.max(0, t - zt));
    zt = t;
    for (const [el, r] of lues) if (!zones.has(el)) zones.set(el, { r, k: 0, e: 0 });
    for (const [el, z] of zones) {
      const r = lues.get(el);
      if (r) z.r = r;
      z.k = calme ? (r ? 1 : 0) : Math.min(1, Math.max(0, z.k + (r ? dt : -dt) / 0.8));
      z.e = 1 - Math.pow(1 - z.k, 3);
      if (!r && !z.k) zones.delete(el);
    }
    vu = calme ? +present : Math.min(1, Math.max(0, vu + (present ? dt : -dt) / 0.8));
  };
  // Écart au bord d'une zone ouverte d'une part e, négatif dedans
  const ecart = ({ r, e }: { r: Zone; e: number }, x: number, y: number) => {
    const ax = Math.abs(x - r.x - r.w / 2), dx = ax - (r.w / 2) * e;
    if (r.logo) {
      // Colonne ou pieds, le plus proche, avec les 16 px d'air des boîtes
      const a = (r.w / 2) * e, b = r.h / 2, dy = y - r.y - b, k = (PENTE * b) / a;
      return Math.min(Math.max(ax - COLONNE * a, Math.abs(dy) - b), Math.max(dx, dy - b, (k * ax - PIED * b - dy) / Math.hypot(1, k))) - 16;
    }
    return r.boite ? Math.max(dx, Math.abs(y - r.y - r.h / 2) - r.h / 2) : dx;
  };
  const zone = (x: number, y: number) => {
    let p = 1;
    for (const z of zones.values()) if (z.e > 0) p *= lis(-16, 40, ecart(z, x, y));
    return p;
  };

  // Détails en flaques : jeu de glyphes, masque par cases, calques de coulisses
  const LIGNES: string[] = [];
  for (let L = 0; L < 64; L++) {
    let s = ' '.repeat(((hache(L, 1) * 4) | 0) * 2);
    const n = 2 + ((hache(L, 2) * 5) | 0);
    for (let i = 0; i < n; i++) s += MOTS[(hache(L, i, 3) * MOTS.length) | 0] + ' ';
    LIGNES.push(s);
  }
  const JEU = [...new Set(LIGNES.join('') + '0123456789ABCDEF:xy')].join('');
  const ix = (car: string) => Math.max(0, JEU.indexOf(car));
  let Wd = 0, Hd = 0, kd = 0, cols = 0, rows = 0, der = -1, pw = 1, ph = 1, cle = '';
  // Masque par cases et ses bornes : une case hors d'un seuil est sautée
  let m = new Float32Array(0), lo = new Float32Array(0), hi = new Float32Array(0);
  let mk = document.createElement('canvas'), mx = mk.getContext('2d')!, img = mx.createImageData(1, 1);
  let off = document.createElement('canvas'), c = off.getContext('2d')!, at = document.createElement('canvas');
  // Intensité du masque en un point, interpolée entre les cases
  const e = (x: number, y: number) => {
    const fx = Math.min(cols - 1.001, Math.max(0, x / G - 0.5)), fy = Math.min(rows - 1.001, Math.max(0, y / G - 0.5));
    const i = fx | 0, j = fy | 0, a = fx - i, b = fy - j, q = j * cols + i;
    return (m[q] * (1 - a) + m[q + 1] * a) * (1 - b) + (m[q + cols] * (1 - a) + m[q + cols + 1] * a) * b;
  };
  // Case d'interpolation d'un point, la même que celle de e
  const cas = (x: number, y: number) =>
    (Math.min(rows - 1.001, Math.max(0, y / G - 0.5)) | 0) * cols + (Math.min(cols - 1.001, Math.max(0, x / G - 0.5)) | 0);
  // Glyphe n° i du jeu, tiré d'un atlas rendu une fois par densité
  const g = (i: number, x: number, y: number) => {
    if (cle !== String(k)) {
      cle = String(k);
      pw = Math.ceil(CW * k);
      ph = Math.ceil(CH * k);
      at = document.createElement('canvas');
      at.width = pw * JEU.length;
      at.height = ph;
      const a = at.getContext('2d')!;
      a.font = `500 ${FS * k}px "Geist Mono", "JetBrains Mono", Consolas, ui-monospace, monospace`;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      a.fillStyle = ENCRE;
      for (let n = 0; n < JEU.length; n++) a.fillText(JEU[n], n * pw + pw / 2, ph / 2);
    }
    c.drawImage(at, i * pw, 0, pw, ph, x, y, pw / k, ph / k);
  };
  // Glyphe ouvert en largeur sur une part s, centré dans sa case
  const gs = (i: number, x: number, y: number, s: number) => {
    if (s >= 1) return g(i, x, y);
    if (s <= 0.02) return;
    c.setTransform(k * s, 0, 0, k, k * (x + (CW * (1 - s)) / 2), k * y);
    g(i, 0, 0);
    c.setTransform(k, 0, 0, k, 0, 0);
  };
  const motif = () => {
    // Tramage ordonné en lisière des flaques, fixé aux lumières, case par case
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], X = '0123456789ABCDEF';
    c.beginPath();
    for (let j = 0; j < rows - 1; j++) {
      const ya = j ? (j + 0.5) * G : 0, yb = Math.min(H, (j + 1.5) * G);
      for (let i = 0; i < cols - 1; i++) {
        const q = j * cols + i;
        if (hi[q] < 0.04 || lo[q] > 0.7) continue;
        const xa = i ? (i + 0.5) * G : 0, xb = Math.min(W, (i + 1.5) * G);
        for (let y = Math.ceil(ya / 4) * 4; y < yb; y += 4) {
          const rang = ((y / 4) & 3) * 4;
          for (let x = Math.ceil(xa / 4) * 4; x < xb; x += 4) {
            const v = e(x, y);
            if (v < 0.04 || v > 0.7) continue;
            if (14 * (v < 0.35 ? v / 0.35 : (0.7 - v) / 0.35) > B[rang + ((x / 4) & 3)] + 0.5) c.rect(x, y, 3.2, 3.2);
          }
        }
      }
    }
    c.fill();
    // Grille de points au cœur des lumières : le point s'élargit en y entrant
    c.beginPath();
    for (let y = 7; y < H; y += 14) {
      for (let x = 7; x < W; x += 14) {
        if (hi[cas(x, y)] < 0.7) continue;
        const v = e(x, y);
        if (v < 0.7) continue;
        const s = lis(0.7, 0.8, v), b = bruit(x * 0.02, y * 0.02, t * 0.6);
        if (b > 0.3) {
          const r = 1 + 2.4 * (b - 0.3);
          c.moveTo(x + r * s, y);
          c.ellipse(x, y, r * s, r, 0, 0, 6.2832);
        } else c.rect(x - 0.75 * s, y - 0.75, 1.5 * s, 1.5);
      }
    }
    c.fill();
    // Décalage d'un calque selon sa profondeur : lente dérive
    const cal = (z: number) => [t * 7 * z, t * 2 * z];
    // Calque profond : quelques amas de binaire
    const [x1, y1] = cal(0.35);
    for (let r = Math.floor(-y1 / CH); r * CH + y1 < H; r++) {
      for (let cc = Math.floor(-x1 / CW); cc * CW + x1 < W; cc++) {
        const x = cc * CW + x1, y = r * CH + y1;
        if (hache(cc >> 3, r >> 2, 5) > 0.18 || hi[cas(x + CW / 2, y + CH / 2)] < 0.65) continue;
        const v = e(x + CW / 2, y + CH / 2);
        if (v < 0.65) continue;
        const b = hache(cc, r, Math.floor(t * 2.5 + hache(r, cc) * 9)) > 0.5;
        c.globalAlpha = b ? 0.8 : 0.3;
        gs(ix(b ? '1' : '0'), x, y, lis(0.65, 0.75, v));
      }
    }
    // Calque du milieu : panneaux de vidage mémoire ou de journal qui défile
    const [x2, y2] = cal(0.7), PW = 18 * CW, PH = 7 * CH;
    const sorte = (bi: number, bj: number) => {
      const ep = Math.floor(t / 9 + hache(bj, bi) * 3);
      return hache(bi, bj, ep) > 0.3 || e(bi * PW + x2 + PW / 2, bj * PH + y2 + PH / 2) < 0.55 ? 0 : hache(bj, bi, ep + 1) < 0.5 ? 2 : 1;
    };
    for (let bj = Math.floor(-y2 / PH) - 1; bj * PH + y2 < H; bj++) {
      for (let bi = Math.floor(-x2 / PW); bi * PW + x2 < W; bi++) {
        // Un journal est deux fois plus haut : la case du dessous lui revient
        const so = sorte(bi, bj), X0 = bi * PW + x2, Y0 = bj * PH + y2, HP = so === 2 ? 2 * PH : PH;
        if (!so || sorte(bi, bj - 1) === 2) continue;
        // Ouverture puis fermeture horizontales en 0,6 s, et selon la lumière
        const u = t / 9 + hache(bj, bi) * 3, f = (u - Math.floor(u)) * 9;
        const ou = lis(0, 0.6, f) * lis(0, 0.6, 9 - f) * lis(0.55, 0.65, e(X0 + PW / 2, Y0 + PH / 2));
        if (ou <= 0.01) continue;
        c.save();
        c.beginPath();
        c.rect(X0 + ((PW - CW) * (1 - ou)) / 2, Y0, (PW - CW) * ou, HP - CH);
        c.clip();
        if (so === 2) {
          const d = t * 9 + bi * 40, L0 = Math.floor(d / CH), y0 = Y0 - (d % CH);
          c.globalAlpha = 0.9;
          for (let n = 0; n < 15; n++) {
            const s = LIGNES[((((L0 + n + bj * 11) % 64) + 64) % 64)], y = y0 + n * CH;
            for (let i = 0; i < Math.min(17, s.length); i++) {
              const v = e(X0 + i * CW + CW / 2, y + CH / 2);
              if (s[i] !== ' ' && v > 0.5) gs(ix(s[i]), X0 + i * CW, y, lis(0.5, 0.6, v));
            }
          }
        } else {
          for (let lr = 0; lr < 6; lr++) {
            for (let lc = 0; lc < 17; lc++) {
              const x = X0 + lc * CW, y = Y0 + lr * CH, r = bj * 7 + lr, v = e(x + CW / 2, y + CH / 2);
              if (v < 0.5) continue;
              let car = '';
              if (lc < 4) car = X[((hache(bi, bj) * 49152 + Math.abs(r) * 16) >> (12 - lc * 4)) & 15];
              else if (lc === 4) car = ':';
              else {
                const q = lc - 6;
                if (q >= 0 && q % 3 !== 2) {
                  const o = (hache(bi * 8 + ((q / 3) | 0), r, Math.floor(t * 1.5 + hache(r, bi) * 5)) * 256) | 0;
                  car = X[q % 3 ? o & 15 : o >> 4];
                }
              }
              if (car) {
                c.globalAlpha = lc < 5 ? 0.5 : 1;
                gs(ix(car), x, y, lis(0.5, 0.6, v));
              }
            }
          }
        }
        c.restore();
      }
    }
    c.globalAlpha = 1;
    // Calque proche : de rares repères en croix avec leurs coordonnées écran
    const [x3, y3] = cal(1.1), PC = 190;
    c.beginPath();
    for (let j = Math.floor(-y3 / PC); j * PC + y3 < H; j++) {
      for (let i = Math.floor(-x3 / PC); i * PC + x3 < W; i++) {
        const x = i * PC + x3, y = j * PC + y3, v = e(x, y);
        if (hache(i, j, 9) > 0.55 || v < 0.4) continue;
        const s = lis(0.4, 0.5, v);
        c.moveTo(x - 6 * s, y);
        c.lineTo(x + 6 * s, y);
        c.moveTo(x, y - 6);
        c.lineTo(x, y + 6);
        if (hache(j, i, 9) > 0.5) continue;
        const a = 'x' + String(Math.abs(Math.round(x))).padStart(4, '0'), b = 'y' + String(Math.abs(Math.round(y))).padStart(4, '0');
        for (let n = 0; n < 5; n++) {
          gs(ix(a[n]), x + (5 + n * CW) * s, y - 26, s);
          gs(ix(b[n]), x + (5 + n * CW) * s, y - 15, s);
        }
      }
    }
    c.stroke();
  };

  const dessiner = (calme: boolean) => {
    nappes();
    // Bokeh seuls : le fond opaque dessous, ni détails ni ondes
    if (!details()) {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = base();
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    if (W !== Wd || H !== Hd || k !== kd) {
      Wd = W;
      Hd = H;
      kd = k;
      cols = Math.ceil(W / G) + 1;
      rows = Math.ceil(H / G) + 1;
      m = new Float32Array(cols * rows);
      lo = new Float32Array(cols * rows);
      hi = new Float32Array(cols * rows);
      der = -1;
      mk = document.createElement('canvas');
      mk.width = cols;
      mk.height = rows;
      mx = mk.getContext('2d')!;
      img = mx.createImageData(cols, rows);
      off = document.createElement('canvas');
      off.width = Math.ceil(W * k);
      off.height = Math.ceil(H * k);
      c = off.getContext('2d')!;
    }
    avance(calme);
    const o = oeil, ve = vu * vu * (3 - 2 * vu);
    if (der < 0 || t < der || t - der >= 0.9 / IPS || calme) {
      der = t;
      lumieres(Math.min(W, H));
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          // Distance hexagonale à l'œil ; le haut de l'écran reste net
          const x = (i + 0.5) * G, y = (j + 0.5) * G, q = j * cols + i;
          const u = o.w ? Math.abs(x - o.x) / (o.w / 2) : Infinity, ay = Math.abs(y - o.y) / (o.h / 2);
          const d = Math.max(u, ay + 0.476 * u), de = Math.max(u, ay * POINTE + 0.476 * u);
          const p = (o.w && ve ? 1 - ve * (1 - protege(d, de)) : 1) * zone(x, y), v = p > 0 ? lis(0.25, 0.55, lum(x, y)) * p * lis(40, 100, y) : 0;
          m[q] = v;
          img.data[q * 4 + 3] = v * 255;
        }
      }
      // Bornes de chaque case : l'interpolation reste entre ses quatre coins
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const q = j * cols + i, a = m[q], b = m[q + 1], n = m[q + cols], s = m[q + cols + 1];
          lo[q] = Math.min(a, b, n, s);
          hi[q] = Math.max(a, b, n, s);
        }
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.clearRect(0, 0, off.width, off.height);
      c.setTransform(k, 0, 0, k, 0, 0);
      c.fillStyle = c.strokeStyle = ENCRE;
      c.lineWidth = 1;
      motif();
      mx.putImageData(img, 0, 0);
      c.setTransform(k, 0, 0, k, 0, 0);
      c.globalCompositeOperation = 'destination-in';
      c.imageSmoothingEnabled = true;
      c.drawImage(mk, 0, 0, cols * G, rows * G);
      c.globalCompositeOperation = 'source-over';
    }
    // Fond opaque dessous : le mélange colore les détails au lieu de les griser
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = base();
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'color-dodge';
    ctx.globalAlpha = ALPHA;
    // Détails coupés net au bord des zones ; autour du logo, le masque suffit
    for (const { r, e } of zones.values()) {
      if (e <= 0 || r.logo) continue;
      const w = r.w * e;
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.rect(r.x + (r.w - w) / 2, r.boite ? r.y : 0, w, r.boite ? r.h : H);
      ctx.clip('evenodd');
    }
    ctx.drawImage(off, 0, 0, W, H);
    ctx.restore();
    if (o.w) dessinerOndes(o);
  };

  const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let anim = 0, sale = true, signe = '', sautee = false;
  const taille = () => {
    k = Math.min(1.5, window.devicePixelRatio || 1);
    W = toile.clientWidth || 1;
    H = toile.clientHeight || 1;
    toile.width = Math.round(W * k);
    toile.height = Math.round(H * k);
    sale = true;
  };
  const suivi = new ResizeObserver(taille);
  suivi.observe(toile);
  taille();

  const tour = (ms: number) => {
    anim = requestAnimationFrame(tour);
    if (document.hidden || !actif()) return;
    // Sous les fenêtres d'une page, leur flou suit chaque image : une sur deux
    if (lent() && (sautee = !sautee)) return;
    const p = lirePalette();
    if (p !== palette) {
      palette = p;
      depuis = cible;
      cible = teinteDe(p);
      debutFondu = ms / 1000;
      fondu = calme ? 1 : 0;
      sale = true;
    }
    if (fondu < 1) fondu = Math.min(1, (ms / 1000 - debutFondu) / FONDU);
    // L'œil et les zones protégées : lus à l'écran, à l'échelle de la toile
    const b = toile.getBoundingClientRect(), z = b.width / W || 1;
    const r = document.querySelector('.z-\\[45\\] svg[fill="none"]:not([data-cache]) > polygon')?.getBoundingClientRect();
    present = !!r?.width;
    // Effacé, l'œil garde sa dernière place le temps que sa protection s'estompe
    if (r?.width) {
      if (!oeil.w) vu = 1;
      oeil = { x: (r.left - b.left + r.width / 2) / z, y: (r.top - b.top + r.height / 2) / z, w: r.width / z, h: r.height / z };
    }
    lues = new Map();
    for (const el of document.querySelectorAll<HTMLElement>('[data-tchat], [data-protege]')) {
      // Une boîte garde 16 px d'air autour de ce qu'elle protège
      const rt = el.closest('[inert]') ? null : el.getBoundingClientRect(), forme = el.dataset.protege, marge = forme === 'boite' ? 16 : 0;
      if (rt?.width) lues.set(el, { x: (rt.left - b.left) / z - marge, y: (rt.top - b.top) / z - marge, w: rt.width / z + 2 * marge, h: rt.height / z + 2 * marge, boite: marge > 0, logo: forme === 'logo' });
    }
    // Mouvement réduit : image fixe, redessinée quand la scène change
    if (calme) {
      const s = [+details(), +present, oeil.x, oeil.y, oeil.w, ...[...lues.values()].flatMap((q) => [q.x, q.y, q.w, q.h])].join();
      if (!sale && s === signe) return;
      signe = s;
    }
    sale = false;
    t = calme ? 8 : ms / 1000;
    // Arrivée : au réveil du site, les bokeh naissent petits et grossissent
    if (t0 < 0 && eveil()) t0 = t;
    croit = calme ? 1 : t0 < 0 ? 0.02 : Math.max(0.02, 1 - Math.pow(1 - Math.min(1, (t - t0) / ARRIVEE), 3));
    // Mouvement réduit : pas d'ondes, comme pour celles de l'œil
    if (!calme) ecouter();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    dessiner(calme);
  };
  anim = requestAnimationFrame(tour);

  return () => {
    cancelAnimationFrame(anim);
    suivi.disconnect();
  };
}
