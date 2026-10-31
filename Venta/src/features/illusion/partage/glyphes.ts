'use client';

// Ce qui apparaît ou disparaît dans une fenêtre : chaque morceau se déplie ou se replie depuis son milieu, son texte s'écrit ou s'efface
// lettre par lettre derrière une tête de quelques glyphes ; le texte d'origine est toujours rendu, sauf si React l'a changé entre-temps
const GLYPHES = '#$%&*+<=>?@/|^~0123456789ABCDEFX';
const LETTRE = /[\p{L}\p{N}]/u;
const TETE = 4;
// Morceaux animés un à un, du milieu de la fenêtre vers ses bords : cellules, têtes, blocs de fiche, vignettes, lignes du fil
const MORCEAUX =
  'td,th,.outils>*,.confirmer,.etat-boite,.pagination,.vignette,.p-tete,.f-pied,.f-tete,.section-f>*,.bloc-f,' +
  '.f-corps>:not(.section-f):not(.f-tete):not(.bloc-f),.detail-appel>*,.echos-tete>*,.tuiles-sortes>*,.fil-actions>li,.tete>*';
// Textes jamais touchés : la valeur d'un champ et les dessins
const HORS = 'textarea,select,option,svg,script,style';
// Décor d'une fenêtre, laissé en place pendant un fondu
const DECOR = ':scope>:not(.verre-halos):not(.prise):not(.taille):not(.ouv-ligne)';

// Durées des passages, en ms : effacement avant repli, écriture à l'ouverture, contenu réécrit, fondu d'une page à l'autre, ce qui change
export const DUREES = { effacer: 130, ouvrir: 560, ouverture: 700, contenu: 520, fondu: 120, signal: 380, canaux: 300 };

export type Controle = { fini: Promise<void>; annuler: () => void };
// `texte` : seul le texte s'écrit, avec un bref éclat blanc, sans que l'élément se déplie (un compteur, un nom de canal)
type Options = { duree: number; delai?: number; texte?: boolean };
type Texte = { n: Text; v0: string; dernier: string; debut: number; fin: number; fait: boolean };

const RIEN: Controle = { fini: Promise.resolve(), annuler: () => {} };

export const mouvementReduit = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function brouiller(s: string) {
  let sortie = '';
  for (let i = 0; i < s.length; i += 1) sortie += LETTRE.test(s[i]) ? GLYPHES[Math.floor(Math.random() * GLYPHES.length)] : s[i];
  return sortie;
}

// À l'avancement p (0 à 1) : les lettres posées, puis la tête en glyphes ; la suite n'est pas encore écrite
function aLAvancement(v0: string, p: number) {
  const q = Math.floor(p * (v0.length + TETE));
  const ecrit = Math.min(v0.length, q);
  const pose = Math.max(0, Math.min(v0.length, q - TETE));
  return v0.slice(0, pose) + brouiller(v0.slice(pose, ecrit));
}

// Les morceaux visibles de la cible, sans ceux déjà portés par un autre ; à défaut, la cible entière
function morceauxDe(cible: Element): HTMLElement[] {
  const r = cible.getBoundingClientRect();
  const morceaux = Array.from(cible.querySelectorAll<HTMLElement>(MORCEAUX)).filter((el) => {
    const porteur = el.parentElement?.closest(MORCEAUX);
    if (porteur && cible.contains(porteur)) return false;
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && b.bottom >= r.top && b.top <= r.bottom;
  });
  return morceaux.length ? morceaux : [cible as HTMLElement];
}

function textesDe(el: Element): Text[] {
  const textes: Text[] = [];
  const marche = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    if (n.nodeValue && LETTRE.test(n.nodeValue) && !n.parentElement?.closest(HORS)) textes.push(n as Text);
  }
  return textes;
}

function animer(cible: Element, sens: 'ecrire' | 'effacer', { duree, delai = 0, texte = false }: Options): Controle {
  if (mouvementReduit() || typeof (cible as HTMLElement).animate !== 'function') return RIEN;
  const ecrit = sens === 'ecrire';
  const r = cible.getBoundingClientRect();
  const anims: Animation[] = [];
  const textes: Texte[] = [];
  if (texte) {
    anims.push(cible.animate([{ filter: 'drop-shadow(0 0 3px rgb(255 255 255 / .125))' }, { filter: 'none' }], { duration: duree * 2, delay: delai, easing: 'ease-out' }));
    for (const n of textesDe(cible)) textes.push({ n, v0: n.nodeValue ?? '', dernier: n.nodeValue ?? '', debut: delai, fin: delai + duree, fait: false });
  }
  for (const el of texte ? [] : morceauxDe(cible)) {
    const b = el.getBoundingClientRect();
    // 0 au milieu de la cible, 1 à ses bords : l'écriture part du milieu, l'effacement des bords
    const ecart = r.height ? Math.min(1, Math.abs((b.top + b.height / 2 - r.top) / r.height - 0.5) * 2) : 0;
    const depart = delai + (ecrit ? ecart * 0.4 : (1 - ecart) * 0.35) * duree;
    const longueur = (ecrit ? 0.45 : 0.6) * duree;
    anims.push(
      el.animate(
        ecrit
          ? [{ opacity: 0, clipPath: 'inset(0 50% 0 50%)' }, { opacity: 1, offset: 0.02 }, { clipPath: 'inset(0 0% 0 0%)' }]
          : [{ opacity: 1, clipPath: 'inset(0 0% 0 0%)' }, { opacity: 0, clipPath: 'inset(0 50% 0 50%)' }],
        { duration: longueur, delay: depart, easing: ecrit ? 'cubic-bezier(.2,.7,.3,1)' : 'cubic-bezier(.5,0,.75,0)', fill: ecrit ? 'both' : 'forwards' },
      ),
    );
    const debut = depart + (ecrit ? 0.05 * duree : 0);
    for (const n of textesDe(el)) {
      const v0 = n.nodeValue ?? '';
      textes.push({ n, v0, dernier: v0, debut, fin: debut + longueur, fait: false });
    }
  }

  const poser = (t: Texte, valeur: string) => {
    // React a réécrit ce texte entre-temps : sa valeur est la bonne, on n'y touche plus
    if (t.n.nodeValue !== t.dernier) { t.fait = true; return; }
    t.n.nodeValue = valeur;
    t.dernier = valeur;
  };
  const rendre = () => textes.forEach((t) => { if (!t.fait) { poser(t, t.v0); t.fait = true; } });
  textes.forEach((t) => poser(t, aLAvancement(t.v0, ecrit ? 0 : 1)));

  let image = 0;
  let annule = false;
  const t0 = performance.now();
  const textesFinis = new Promise<void>((fin) => {
    const pas = (maintenant: number) => {
      if (annule) return fin();
      const t = maintenant - t0;
      let reste = false;
      for (const x of textes) {
        if (x.fait) continue;
        if (t >= x.fin) { poser(x, x.v0); x.fait = true; continue; }
        reste = true;
        const p = t <= x.debut ? 0 : (t - x.debut) / (x.fin - x.debut);
        poser(x, aLAvancement(x.v0, ecrit ? p : 1 - p));
      }
      if (reste) image = requestAnimationFrame(pas);
      else fin();
    };
    image = requestAnimationFrame(pas);
  });
  const fini = Promise.all([textesFinis, ...anims.map((a) => a.finished.catch(() => {}))]).then(() => {
    // Écrit : les morceaux reprennent leur style ; effacé : ils restent repliés jusqu'à l'annulation, une fois la fenêtre cachée
    if (ecrit || texte) anims.forEach((a) => a.cancel());
  });
  return {
    fini,
    annuler: () => {
      annule = true;
      cancelAnimationFrame(image);
      rendre();
      anims.forEach((a) => a.cancel());
    },
  };
}

export const ecrire = (cible: Element, options: Options) => animer(cible, 'ecrire', options);
export const effacer = (cible: Element, options: Options) => animer(cible, 'effacer', options);

// Contenu d'une fenêtre qui reste en place mais change de page : un simple fondu, le verre ne bouge pas
export function fondu(fenetre: Element, duree: number): Controle {
  if (mouvementReduit()) return RIEN;
  const anims = Array.from(fenetre.querySelectorAll<HTMLElement>(DECOR)).map((el) =>
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duree, easing: 'ease-out' }),
  );
  return { fini: Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => {}), annuler: () => anims.forEach((a) => a.cancel()) };
}

// Contenu caché le temps qu'une fenêtre se déplie, avant d'être écrit
export function voiler(fenetre: Element, duree: number): Controle {
  if (mouvementReduit()) return RIEN;
  const anims = Array.from(fenetre.querySelectorAll<HTMLElement>(DECOR)).map((el) =>
    el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: duree }),
  );
  return { fini: Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => {}), annuler: () => anims.forEach((a) => a.cancel()) };
}
