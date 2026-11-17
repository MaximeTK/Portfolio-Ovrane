'use client';

import { useEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { Menu, OptionMenu } from '../../elements/Menu';
import {
  CHAMPS_DIVERS, CHAMPS_RECHERCHE, GROUPES, RUBRIQUES, SECTIONS, TITRES, libelleDonnee,
  type Champ, type ChampSchema, type Forme,
} from './champs';
import { Action } from '../../elements/Action';
import { Champ as ChampFormulaire, ChampSaisie, LibelleValeur } from '../../elements/Champ';
import { Poignee, deplacer, moitieAvant } from '../../elements/glisser';
import { ICONES } from '../../elements/icones';

export type Profil = Record<string, unknown>;
export type EtatProfil = { manquants: { cle: string; libelle: string }[]; a_completer: { cle: string; valeur: unknown; sorte: string; sites: string[] }[] };
type Lieu = { libelle: string; detail?: string; voie?: string; code_postal?: string; ville?: string; pays?: string; [cle: string]: unknown };
type Bloc = { uid: number; origine: number | null; valeurs: Record<string, string> };
type GroupeCompetences = { uid: number; groupe: string; liste: string };
type Saisie = {
  gen: number;
  plats: Record<string, string>;
  recherche: Record<string, string>;
  rubriques: Record<string, Bloc[]>;
  competences: GroupeCompetences[];
  ordre: string[];
  residence: Lieu | null;
};

// Numérotation des entrées identique au serveur et au navigateur
let uid = 1_000_000_000;
const neuf = () => ++uid;
const texte = (v: unknown) => (v === undefined || v === null ? '' : String(v));
const decouper = (v: string, sep: string) => v.split(sep).map((x) => x.trim()).filter(Boolean);
const estObjet = (v: unknown): v is Profil => typeof v === 'object' && v !== null && !Array.isArray(v);

/* ------------------------------------------------- rédiger, pas remplir */

// Une entrée rédigée porte de la mise en forme, rien d'exécutable
const BALISES_RICHES = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'P', 'DIV', 'SPAN', 'UL', 'OL', 'LI']);
const STYLES_RICHES = ['color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration'];

// HTML réduit à sa mise en forme par un DOMParser qui n'exécute rien
function assainir(html: string) {
  const bac = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  for (const noeud of [...bac.querySelectorAll<HTMLElement>('*')]) {
    if (!BALISES_RICHES.has(noeud.tagName)) {
      noeud.replaceWith(...noeud.childNodes);
      continue;
    }
    const style = STYLES_RICHES.map((p) => [p, noeud.style.getPropertyValue(p)]).filter(([, v]) => v).map(([p, v]) => `${p}:${v}`).join(';');
    for (const attribut of [...noeud.attributes]) noeud.removeAttribute(attribut.name);
    if (style) noeud.setAttribute('style', style);
  }
  return bac.innerHTML;
}

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Texte rédigé, sinon l'ancienne description et ses puces mises en page
function contenuEntree(v: Profil) {
  if (v.contenu) return texte(v.contenu);
  const puces = Array.isArray(v.puces) ? v.puces.map(texte) : [];
  return (v.description ? `<p>${echapper(texte(v.description))}</p>` : '') + (puces.length ? `<ul>${puces.map((p) => `<li>${echapper(p)}</li>`).join('')}</ul>` : '');
}

// Texte NU d'une entrée : le modèle de remplissage ne lit pas les balises
function projeter(html: string) {
  const bac = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const puces = [...bac.querySelectorAll('li')].map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const liste of [...bac.querySelectorAll('ul, ol')]) liste.remove();
  // Un saut de ligne par bloc : on garde les phrases séparées par l'auteur
  for (const bloc of [...bac.querySelectorAll('p, div, br')]) bloc.after('\n');
  const description = (bac.textContent ?? '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return { description, puces };
}

/* ------------------------------------------------- lire et relire le profil */

// Valeur d'un champ par sa clé ou son repli ; « a.b » descend d'un cran
function valeurChamp(source: Profil, champ: Champ): unknown {
  if (champ.type === 'riche') return contenuEntree(source);
  const direct = source[champ.cle];
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  if (!champ.repli) return undefined;
  return champ.repli.split('.').reduce<unknown>((v, cle) => (estObjet(v) ? v[cle] : undefined), source);
}

function afficher(valeur: unknown, type?: Forme) {
  if (type === 'riche') return typeof window === 'undefined' ? texte(valeur) : assainir(texte(valeur));
  if (type === 'liste' && Array.isArray(valeur)) return valeur.map(texte).join(', ');
  if (type === 'lignes' && Array.isArray(valeur)) return valeur.map(texte).join('\n');
  return texte(valeur);
}

const versSaisie = (source: Profil, champs: Champ[]) => Object.fromEntries(champs.map((c) => [c.cle, afficher(valeurChamp(source, c), c.type)]));

// Ce qu'un groupe de champs porte, converti selon la forme déclarée
function lireChamps(valeurs: Record<string, string>, champs: Champ[]) {
  const lu: Profil = {};
  for (const champ of champs) {
    const brut = valeurs[champ.cle] ?? '';
    if (champ.type === 'riche') {
      const propre = assainir(brut);
      const nu = projeter(propre);
      // Une zone vidée garde un « <p><br></p> » : sans texte ni puce, elle est VIDE
      lu[champ.cle] = nu.description || nu.puces.length ? propre : '';
      Object.assign(lu, nu);
    } else if (champ.type === 'lignes') lu[champ.cle] = decouper(brut, '\n');
    else if (champ.type === 'liste') lu[champ.cle] = decouper(brut, ',');
    else if (champ.type === 'nombre') lu[champ.cle] = brut.trim() === '' ? '' : Number(brut);
    else lu[champ.cle] = brut.trim();
  }
  return lu;
}

// Une clé VIDE que l'original ne portait pas ne s'ajoute pas
function sansVidesInedits(edite: Profil, base: Profil) {
  for (const [cle, valeur] of Object.entries(edite)) {
    const vide = valeur === '' || (typeof valeur === 'object' && valeur !== null && !Object.keys(valeur).length);
    if (vide && !(cle in base)) delete edite[cle];
  }
  return edite;
}

const FORMES: Record<string, Forme> = { text: 'text', texte_long: 'texte_long', nombre: 'nombre', choix: 'choix', liste: 'liste', email: 'email', lieu: 'lieu' };

// Champs d'une section : les siens, puis ceux que la correction y a ajoutés
function champsDe(section: string, champs: Champ[], schema: ChampSchema[]): Champ[] {
  const ajoutes: Champ[] = schema.filter((c) => c.section === section && !champs.some((x) => x.cle === c.cle))
    .map((c) => ({ cle: c.cle, libelle: c.libelle, type: FORMES[c.type] ?? 'text', choix: c.choix, portee: 'commune', large: c.type === 'texte_long' }));
  return [...champs, ...ajoutes].map((c) => ({ ...c, obligatoire: schema.some((s) => s.cle === c.cle && s.obligatoire) }));
}

function initial(origine: Profil, schema: ChampSchema[], gen: number): Saisie {
  let n = gen * 100_000;
  const suivant = () => ++n;
  const plats: Record<string, string> = {};
  for (const g of GROUPES) Object.assign(plats, versSaisie(origine, champsDe(g.cle, g.champs, schema)));
  Object.assign(plats, versSaisie(origine, CHAMPS_DIVERS));
  const rubriques = Object.fromEntries(RUBRIQUES.map((r) => {
    // « Français (courant) » : une chaîne dans le squelette, deux champs ici
    const entrees = (Array.isArray(origine[r.cle]) ? (origine[r.cle] as unknown[]) : []).map((v) => (typeof v === 'string'
      ? { langue: v.replace(/\s*\(.*$/, ''), niveau: (/\(([^)]*)\)/.exec(v) ?? [])[1] ?? '' } : estObjet(v) ? v : {}));
    return [r.cle, entrees.map((v, rang): Bloc => ({ uid: suivant(), origine: rang, valeurs: versSaisie(v, r.champs) }))];
  }));
  const competences = estObjet(origine.competences)
    ? Object.entries(origine.competences).map(([groupe, liste]) => ({ uid: suivant(), groupe, liste: Array.isArray(liste) ? liste.map(texte).join(', ') : texte(liste) }))
    : [];
  const voulu = (Array.isArray(origine.ordre_sections) ? origine.ordre_sections.map(texte) : []).filter((c) => SECTIONS.includes(c));
  return {
    gen, plats, rubriques, competences, residence: null,
    recherche: versSaisie(estObjet(origine.recherche) ? origine.recherche : {}, CHAMPS_RECHERCHE),
    ordre: [...voulu, ...SECTIONS.filter((c) => !voulu.includes(c))],
  };
}

type Editeur = ReturnType<typeof useEditeur>;

// L'état d'un éditeur de profil, reposé quand le profil ou le schéma changent
export function useEditeur(origine: Profil, schema: ChampSchema[]) {
  const [source, setSource] = useState({ origine, schema });
  const [saisie, setSaisie] = useState(() => initial(origine, schema, 0));
  if (source.origine !== origine || source.schema !== schema) {
    setSource({ origine, schema });
    setSaisie(initial(origine, schema, saisie.gen + 1));
  }

  // Le profil tel qu'il partira : l'original, chaque section relue par-dessus
  const lire = (): Profil => {
    const profil: Profil = { ...origine };
    for (const g of GROUPES) Object.assign(profil, sansVidesInedits(lireChamps(saisie.plats, champsDe(g.cle, g.champs, schema)), origine));
    const recherche = estObjet(origine.recherche) ? origine.recherche : {};
    Object.assign(profil, sansVidesInedits({ recherche: { ...recherche, ...sansVidesInedits(lireChamps(saisie.recherche, CHAMPS_RECHERCHE), recherche) } }, origine));
    for (const r of RUBRIQUES) {
      const anciennes = Array.isArray(origine[r.cle]) ? (origine[r.cle] as unknown[]) : [];
      // Chaque entrée repose sur l'ancienne : une expérience relue garde son `id`
      const entrees = saisie.rubriques[r.cle].map((bloc) => {
        const edite = lireChamps(bloc.valeurs, r.champs);
        if (Object.values(edite).every((v) => v === '' || (Array.isArray(v) && !v.length))) return null;
        const ancienne = bloc.origine === null ? {} : anciennes[bloc.origine];
        const base = estObjet(ancienne) ? ancienne : {};
        return { ...base, ...sansVidesInedits(edite, base) };
      }).filter(Boolean);
      Object.assign(profil, sansVidesInedits({ [r.cle]: entrees }, origine));
    }
    const competences = Object.fromEntries(saisie.competences.filter((g) => g.groupe.trim()).map((g) => [g.groupe.trim(), decouper(g.liste, ',')]));
    Object.assign(profil, sansVidesInedits({ competences }, origine));
    Object.assign(profil, sansVidesInedits(lireChamps(saisie.plats, CHAMPS_DIVERS), origine));
    profil.ordre_sections = saisie.ordre;
    // Une adresse choisie garde ses détails ; réécrite à la main, ils tombent
    const choisie = saisie.residence;
    if (choisie && profil.adresse === (choisie.voie || choisie.libelle)) profil.residence = choisie;
    else if (profil.adresse !== origine.adresse) delete profil.residence;
    // L'identité est écrite À PLAT
    delete profil.identite;
    delete profil.accroche_par_defaut;
    return profil;
  };
  return { saisie, setSaisie, schema, lire };
}

/* ------------------------------------------------- les contrôles */

// Les gestes de mise en forme : ce qu'un CV imprime, et rien de plus
const OUTILS = [
  { commande: 'bold', libelle: 'G', titre: 'Gras', classe: '' },
  { commande: 'italic', libelle: 'I', titre: 'Italique', classe: ' i' },
  { commande: 'underline', libelle: 'S', titre: 'Souligné', classe: ' s' },
  { commande: 'insertUnorderedList', libelle: '☰', titre: 'Liste à puces', classe: '' },
  { commande: 'removeFormat', libelle: '⌫', titre: 'Retirer la mise en forme', classe: '' },
];
// fontSize ne connaît que ses sept crans ; on en expose quatre, nommés
const TAILLES = [['', 'Taille'], ['2', 'Petit'], ['3', 'Normal'], ['5', 'Grand'], ['6', 'Titre']];
// Des familles que Chromium a sûrement au moment d'imprimer le PDF
const POLICES = [['', 'Police'], ['Arial, Helvetica, sans-serif', 'Sans empattement'], ["Georgia, 'Times New Roman', serif", 'Avec empattement'], ["'Courier New', monospace", 'Chasse fixe']];

// Un seul espace où écrire, avec sa mise en forme : le CV rend ce qui s'y voit
function Riche({ id, initiale, exemple, libelle, changer }: { id: string; initiale: string; exemple?: string; libelle: string; changer: (html: string) => void }) {
  const zone = useRef<HTMLDivElement>(null);
  const [couleur, setCouleur] = useState('#FFC08A');
  useEffect(() => {
    if (zone.current) zone.current.innerHTML = initiale;
    // Le contenu de départ seul : la zone garde ensuite ce qui s'y écrit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const agir = (commande: string, valeur?: string) => {
    zone.current?.focus();
    // En CSS plutôt qu'en <font> : un style s'assainit et s'imprime
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(commande, false, valeur);
    if (zone.current) changer(zone.current.innerHTML);
  };
  return (
    <div>
      <div className="barre-r" role="toolbar" aria-label={`Mise en forme : ${libelle}`}>
        {OUTILS.map((o) => (
          // mousedown : au clic, la zone a déjà perdu le curseur
          <button key={o.commande} type="button" className={`outil-r${o.classe}`} title={o.titre} aria-label={o.titre}
            onMouseDown={(e) => {
              e.preventDefault();
              agir(o.commande);
            }}>{o.libelle}</button>
        ))}
        <span className="sep-r" />
        {[['fontSize', 'Taille du texte', TAILLES], ['fontName', 'Police', POLICES]].map(([commande, nom, options]) => (
          <select key={commande as string} aria-label={nom as string} value="" onChange={(e) => e.target.value && agir(commande as string, e.target.value)}>
            {(options as string[][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <label className="outil-r coul" title="Couleur du texte">A<i style={{ background: couleur }} />
          <input type="color" className="cache" value={couleur} aria-label="Couleur du texte" onChange={(e) => {
            setCouleur(e.target.value);
            agir('foreColor', e.target.value);
          }} />
        </label>
      </div>
      <div ref={zone} id={id} className="zone-r" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
        aria-label={libelle} data-exemple={exemple} onInput={(e) => changer(e.currentTarget.innerHTML)} />
    </div>
  );
}

// Pays par code ISO 3166-1, nommés en français par le navigateur
const CODES_PAYS = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY '
  + 'BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB '
  + 'GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI '
  + 'KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ '
  + 'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI '
  + 'SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN '
  + 'VU WF WS YE YT ZA ZM ZW').split(' ');
const aplati = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Lieux proposés selon la liste de référence du champ
async function lieuxProposes(portee: string, saisie: string): Promise<Lieu[]> {
  if (portee === 'pays') {
    const noms = new Intl.DisplayNames(['fr'], { type: 'region' });
    return CODES_PAYS.map((code) => ({ libelle: noms.of(code) ?? code, code_pays: code })).filter((p) => aplati(p.libelle).includes(aplati(saisie))).slice(0, 8);
  }
  if (portee === 'adresse') return appeler<Lieu[]>(`/lieux?q=${encodeURIComponent(saisie)}`);
  // Une commune s'écrit sans son département, même proposée avec lui
  const communes = await appeler<{ code: string; libelle: string }[]>(`/catalogues/communes?q=${encodeURIComponent(saisie)}&limite=8`);
  return communes.map((c) => ({ libelle: c.libelle.replace(/\s*\([^)]*\)$/, ''), detail: c.libelle, code_insee: c.code }));
}

// Un lieu vient d'une liste de référence ; seule la dernière saisie compte
function ChampLieu({ id, valeur, portee, exemple, changer, choisir }: { id: string; valeur: string; portee: string; exemple?: string; changer: (v: string) => void; choisir: (l: Lieu) => void }) {
  const [lieux, setLieux] = useState<Lieu[]>([]);
  const rang = useRef(0);
  const saisir = async (v: string) => {
    changer(v);
    const n = ++rang.current;
    if (v.trim().length < 2) return setLieux([]);
    const trouves = await lieuxProposes(portee, v.trim()).catch(() => []);
    if (n === rang.current) setLieux(trouves);
  };
  return (
    <div className="champ-lieu">
      <input id={id} className="saisie" type="text" value={valeur} placeholder={exemple} autoComplete="off" role="combobox" aria-autocomplete="list"
        aria-expanded={lieux.length > 0} aria-controls={`${id}-lieux`} onChange={(e) => saisir(e.target.value)} onBlur={() => setTimeout(() => setLieux([]), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && lieux.length) {
            e.preventDefault();
            e.stopPropagation();
            setLieux([]);
          }
        }} />
      {lieux.length > 0 && (
        <Menu id={`${id}-lieux`} className="lieux" role="listbox" aria-label="Lieux proposés">
          <div className="menu-liste">
            {lieux.map((l, n) => (
              <OptionMenu key={n} onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  rang.current++;
                  setLieux([]);
                  choisir(l);
                }}>{l.detail ?? l.libelle}</OptionMenu>
            ))}
          </div>
        </Menu>
      )}
    </div>
  );
}

function Controle({ id, champ, valeur, changer, choisirLieu, gen }: { id: string; champ: Champ; valeur: string; changer: (v: string) => void; choisirLieu: (l: Lieu) => void; gen: number }) {
  const t = champ.type;
  if (t === 'riche') return <Riche key={gen} id={id} initiale={valeur} exemple={champ.exemple} libelle={champ.libelle} changer={changer} />;
  if (t === 'texte_long' || t === 'lignes') return <textarea id={id} className="saisie" rows={t === 'lignes' ? 4 : 3} value={valeur} placeholder={champ.exemple} onChange={(e) => changer(e.target.value)} />;
  if (t === 'choix') {
    return (
      <select id={id} className="saisie" value={valeur} onChange={(e) => changer(e.target.value)}>
        {['', ...(champ.choix ?? [])].map((c) => <option key={c} value={c}>{c || '—'}</option>)}
        {valeur && !(champ.choix ?? []).includes(valeur) && <option value={valeur}>{valeur}</option>}
      </select>
    );
  }
  if (t === 'lieu') return <ChampLieu id={id} valeur={valeur} portee={champ.portee ?? 'commune'} exemple={champ.exemple} changer={changer} choisir={choisirLieu} />;
  return <input id={id} className="saisie" type={t === 'nombre' ? 'number' : t === 'email' ? 'email' : 'text'} value={valeur} placeholder={champ.exemple} onChange={(e) => changer(e.target.value)} />;
}

function Libelle({ id, champ }: { id: string; champ: Champ }) {
  const etoile = champ.obligatoire && <abbr className="requis" title="Obligatoire">*</abbr>;
  return champ.type === 'riche' ? <span className="lib-champ" id={`${id}-lib`}>{champ.libelle}{etoile}</span> : <label htmlFor={id}>{champ.libelle}{etoile}</label>;
}

type Vol = { sorte: 'section'; cle: string } | { sorte: 'bloc'; rubrique: string; uid: number } | null;

type ProprietesEditeur = {
  e: Editeur;
  // Nom du fichier ; vide pour un profil neuf, qui se nomme ici
  nom: string;
  nomNeuf?: string;
  setNomNeuf?: (n: string) => void;
  etat: EtatProfil;
  completer?: (cle: string, valeur: string) => Promise<boolean>;
  // Sections ouvertes à l'arrivée
  ouvertes: string[];
  // Préfixe des id : l'éditeur principal et celui du panneau cohabitent
  prefixe: string;
};

// Éditeur d'un profil de candidature : sections, entrées, compétences
export function EditeurProfil({ e, nom, nomNeuf, setNomNeuf, etat, completer, ouvertes: depart, prefixe: base }: ProprietesEditeur) {
  const { saisie, setSaisie, schema } = e;
  const racine = useRef<HTMLElement>(null);
  const [ouvertes, setOuvertes] = useState(() => new Set(depart));
  const [colonnes, setColonnes] = useState(false);
  const [completions, setCompletions] = useState<Record<string, string>>({});
  const vol = useRef<Vol>(null);
  // Relu après enregistrement, le profil garde ses sections ouvertes
  const [gen, setGen] = useState(saisie.gen);
  if (gen !== saisie.gen) {
    setGen(saisie.gen);
    setCompletions({});
  }

  // Deux colonnes si la place le permet : identité à gauche, le reste à droite
  useEffect(() => {
    const el = racine.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setColonnes(el.clientWidth >= 880));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const idDe = (section: string, cle: string, bloc?: number) => `${base}-${section}-${bloc ?? ''}-${cle.replace(/[^\w-]+/g, '-')}`;
  const poser = (quoi: 'plats' | 'recherche', cle: string, v: string) => setSaisie((s) => ({ ...s, [quoi]: { ...s[quoi], [cle]: v } }));
  const poserBloc = (rubrique: string, id: number, cle: string, v: string) => setSaisie((s) => ({
    ...s, rubriques: { ...s.rubriques, [rubrique]: s.rubriques[rubrique].map((b) => (b.uid === id ? { ...b, valeurs: { ...b.valeurs, [cle]: v } } : b)) },
  }));
  // Une adresse choisie remplit aussi code postal, ville et pays
  const choisirLieu = (champ: Champ, l: Lieu, bloc?: { rubrique: string; uid: number }) => {
    if (bloc) return poserBloc(bloc.rubrique, bloc.uid, champ.cle, l.libelle);
    if (champ.portee !== 'adresse') return poser('plats', champ.cle, l.libelle);
    setSaisie((s) => ({
      ...s, residence: { ...l },
      plats: { ...s.plats, adresse: l.voie || l.libelle, ...(l.code_postal && { code_postal: l.code_postal }), ...(l.ville && { ville: l.ville }), ...(l.pays && { pays: l.pays }) },
    }));
  };

  // Un champ obligatoire vide ouvre sa section et y pose le curseur
  const aller = (cle: string) => {
    const sections = [...GROUPES, { cle: 'recherche', champs: CHAMPS_RECHERCHE }, { cle: 'divers', champs: CHAMPS_DIVERS }];
    const g = sections.find((x) => champsDe(x.cle, x.champs, schema).some((c) => c.cle === cle));
    if (!g) return;
    setOuvertes((o) => new Set(o).add(g.cle));
    requestAnimationFrame(() => {
      const el = document.getElementById(idDe(g.cle, cle));
      el?.scrollIntoView({ block: 'center' });
      el?.focus();
    });
  };

  const champ = (section: string, c: Champ, valeur: string, changer: (v: string) => void, bloc?: { rubrique: string; uid: number }) => {
    const id = idDe(section, c.cle, bloc?.uid);
    return (
      <div key={c.cle} className={`champ${c.large ? ' large' : ''}`} style={bloc ? { gridColumn: `span ${c.col ?? 3}` } : undefined}>
        <Libelle id={id} champ={c} />
        <Controle id={id} champ={c} valeur={valeur} changer={changer} choisirLieu={(l) => choisirLieu(c, l, bloc)} gen={saisie.gen} />
      </div>
    );
  };

  const surVol = (ev: React.DragEvent, cible: Vol, horizontal: boolean) => {
    const v = vol.current;
    if (!v || !cible || v.sorte !== cible.sorte) return;
    if (v.sorte === 'section' && cible.sorte === 'section') {
      ev.preventDefault();
      ev.stopPropagation();
      const dessus = moitieAvant(ev, horizontal);
      setSaisie((s) => {
        const ordre = deplacer(s.ordre, v.cle, cible.cle, dessus);
        return ordre === s.ordre ? s : { ...s, ordre };
      });
    } else if (v.sorte === 'bloc' && cible.sorte === 'bloc' && v.rubrique === cible.rubrique) {
      // Une expérience ne se range pas dans les projets : elle reste dans SA liste
      ev.preventDefault();
      ev.stopPropagation();
      const dessus = moitieAvant(ev);
      setSaisie((s) => {
        if (v.rubrique === 'competences') {
          const quoi = s.competences.find((g) => g.uid === v.uid)!, sur = s.competences.find((g) => g.uid === cible.uid)!;
          const competences = deplacer(s.competences, quoi, sur, dessus);
          return competences === s.competences ? s : { ...s, competences };
        }
        const liste = s.rubriques[v.rubrique];
        const neuve = deplacer(liste, liste.find((b) => b.uid === v.uid)!, liste.find((b) => b.uid === cible.uid)!, dessus);
        return neuve === liste ? s : { ...s, rubriques: { ...s.rubriques, [v.rubrique]: neuve } };
      });
    }
  };
  const prise = (quoi: Vol, titre: string, classe: string) => (
    <Poignee classe={classe} titre={titre}
      prendre={(ev) => {
        vol.current = quoi;
        ev.currentTarget.closest('.sec, .bloc')?.classList.add('en-vol');
      }}
      lacher={(ev) => {
        vol.current = null;
        ev.currentTarget.closest('.sec, .bloc')?.classList.remove('en-vol');
      }} />
  );
  const retirer = (rubrique: string, id: number) => setSaisie((s) => (rubrique === 'competences'
    ? { ...s, competences: s.competences.filter((g) => g.uid !== id) }
    : { ...s, rubriques: { ...s.rubriques, [rubrique]: s.rubriques[rubrique].filter((b) => b.uid !== id) } }));
  const piedBloc = (rubrique: string, id: number) => (
    <div className="pied-bloc"><Action rouge onClick={() => retirer(rubrique, id)}>Retirer</Action></div>
  );

  const corps = (cle: string) => {
    const g = GROUPES.find((x) => x.cle === cle);
    if (g || cle === 'recherche' || cle === 'divers') {
      // Recherche et savoir-être suivent le schéma : obligatoires pour tous
      const champs = champsDe(cle, g ? g.champs : cle === 'recherche' ? CHAMPS_RECHERCHE : CHAMPS_DIVERS, schema);
      const quoi = cle === 'recherche' ? 'recherche' : 'plats';
      return <div className="grille-2">{champs.map((c) => champ(cle, c, saisie[quoi][c.cle] ?? '', (v) => poser(quoi, c.cle, v)))}</div>;
    }
    if (cle === 'competences') {
      return (
        <div className="corps-sec blocs">
          {saisie.competences.map((gr) => (
            <div key={gr.uid} className="bloc" onDragOver={(ev) => surVol(ev, { sorte: 'bloc', rubrique: 'competences', uid: gr.uid }, false)}>
              {prise({ sorte: 'bloc', rubrique: 'competences', uid: gr.uid }, "Glisser pour changer l'ordre des groupes", 'poignee-b')}
              <ChampSaisie id={idDe(cle, 'groupe', gr.uid)} libelle="Groupe" value={gr.groupe} placeholder="Langages" onChange={(ev) => setSaisie((s) => ({ ...s, competences: s.competences.map((x) => (x.uid === gr.uid ? { ...x, groupe: ev.target.value } : x)) }))} />
              <ChampSaisie id={idDe(cle, 'liste', gr.uid)} libelle="Compétences" value={gr.liste} placeholder="Python, JavaScript" onChange={(ev) => setSaisie((s) => ({ ...s, competences: s.competences.map((x) => (x.uid === gr.uid ? { ...x, liste: ev.target.value } : x)) }))} />
              {piedBloc('competences', gr.uid)}
            </div>
          ))}
          <Action className="ajout" icone={ICONES.plus} onClick={() => setSaisie((s) => ({ ...s, competences: [...s.competences, { uid: neuf(), groupe: '', liste: '' }] }))}>
            Ajouter un groupe
          </Action>
        </div>
      );
    }
    const r = RUBRIQUES.find((x) => x.cle === cle)!;
    return (
      <div className="corps-sec blocs">
        {saisie.rubriques[cle].map((b) => (
          <div key={b.uid} className="bloc" onDragOver={(ev) => surVol(ev, { sorte: 'bloc', rubrique: cle, uid: b.uid }, false)}>
            {prise({ sorte: 'bloc', rubrique: cle, uid: b.uid }, "Glisser pour changer l'ordre des entrées", 'poignee-b')}
            <div className="grille-6">{r.champs.map((c) => champ(cle, c, b.valeurs[c.cle] ?? '', (v) => poserBloc(cle, b.uid, c.cle, v), { rubrique: cle, uid: b.uid }))}</div>
            {piedBloc(cle, b.uid)}
          </div>
        ))}
        <Action className="ajout" icone={ICONES.plus} onClick={() => setSaisie((s) => ({ ...s, rubriques: { ...s.rubriques, [cle]: [...s.rubriques[cle], { uid: neuf(), origine: null, valeurs: {} }] } }))}>
          Ajouter {r.singulier}
        </Action>
      </div>
    );
  };

  const section = (cle: string) => {
    const ouverte = ouvertes.has(cle);
    return (
      <details key={cle} className="sec" open={ouverte} data-section={cle}
        onToggle={(ev) => {
          const o = ev.currentTarget.open;
          if (o !== ouvertes.has(cle)) setOuvertes((s) => { const n = new Set(s); if (o) n.add(cle); else n.delete(cle); return n; });
        }}
        onDragOver={(ev) => surVol(ev, { sorte: 'section', cle }, !ouverte)}>
        <summary>{prise({ sorte: 'section', cle }, "Glisser pour changer l'ordre des sections", 'poignee')}{TITRES[cle]}{ICONES.chevron_profil}</summary>
        {ouverte && corps(cle)}
      </details>
    );
  };

  const encarts = (
    <>
      {etat.manquants.length > 0 && (
        <section className="encart rouge" aria-label="Profil inutilisable">
          <h3>Ce profil ne peut servir à aucune candidature</h3>
          <p>Tant que ces champs obligatoires sont vides, aucune candidature ne part avec lui ; la veille continue de récolter ses offres.</p>
          <p className="liens">{etat.manquants.map((m) => <button key={m.cle} type="button" className="lien" onClick={() => aller(m.cle)}>{m.libelle}</button>)}</p>
        </section>
      )}
      {etat.a_completer.length > 0 && completer && (
        <section className="encart" aria-label="À compléter">
          <h3>À compléter</h3>
          <p>JADE les a déduites ou inventées en attendant. La vraie valeur servira partout.</p>
          {etat.a_completer.map((d) => {
            const id = idDe('completer', d.cle);
            const garder = async () => {
              if (await completer(d.cle, (completions[d.cle] ?? '').trim())) setCompletions((c) => ({ ...c, [d.cle]: '' }));
            };
            return (
              <ChampFormulaire pour={id} libelle={libelleDonnee(d.cle, schema)} aide={<>En attendant : « {texte(d.valeur)} », {d.sorte === 'deduite' ? 'déduite' : d.sorte === 'inventee' ? 'inventée' : d.sorte}{d.sites.length ? ` — ${d.sites.join(', ')}` : ''}</>} key={d.cle}>
                <div className="ligne-saisie">
                  <input id={id} className="saisie" type="text" value={completions[d.cle] ?? ''} onChange={(ev) => setCompletions((c) => ({ ...c, [d.cle]: ev.target.value }))}
                    onKeyDown={(ev) => ev.key === 'Enter' && garder()} />
                  <Action onClick={garder}>Enregistrer</Action>
                </div>
              </ChampFormulaire>
            );
          })}
        </section>
      )}
    </>
  );

  const [premiere, ...suite] = saisie.ordre;
  return (
    <section ref={racine} className="editeur ed-profil" aria-label={nom ? `Profil · ${nom}` : 'Nouveau profil de candidature'}>
      <div className="f-corps">
        {nom ? (
          <ul className="liste-f nom-profil"><LibelleValeur as="li" libelle="Nom du profil"><span className="d mono">{nom}</span></LibelleValeur></ul>
        ) : (
          <ChampSaisie id={`${base}-nom`} libelle="Nom du profil" aide="Un identifiant sera ajouté : « Dev » donne « Dev-1561.json »." classeChamp="nom-profil" type="text" placeholder="Dev" value={nomNeuf ?? ''} onChange={(ev) => setNomNeuf?.(ev.target.value)} />
        )}
        {colonnes ? (
          <div className="colonnes-p">
            <div className="secs">{section(premiere)}</div>
            <div>{encarts}<div className="secs">{suite.map(section)}</div></div>
          </div>
        ) : (
          <>{encarts}<div className="secs">{saisie.ordre.map(section)}</div></>
        )}
      </div>
    </section>
  );
}
