'use client';

import './fiches.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { cleBrouillon, repris, useGarder } from '../../stockage';
import { Fenetre, usePanneau, useVues, type ArbreDepart } from '../../dock/Dock';
import { ECART } from '../../dock/moteur';
import { Confirmer, MarqueAdmin, Panneau, type Onglet } from '../../dock/Panneau';
import {
  CANAUX, ETATS, Etape, Marques, dateHeure, libelleEtat, lienSur, messageDe, ongletDejaAudite, ongletFicheEntreprise, sansProtocole, useFicheEntreprise,
  useQuestionsFiche,
} from '../../partage/FicheEntreprise';
import { ongletFicheOffre } from '../../partage/FicheOffre';

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
export const ICONES = {
  reglages: <svg {...TRAIT}><polygon points="22.3,10.2 22.3,13.8 19.4,13.8 18.5,15.9 20.6,18.0 18.0,20.6 15.9,18.5 13.8,19.4 13.8,22.3 10.2,22.3 10.2,19.4 8.1,18.5 6.0,20.6 3.4,18.0 5.5,15.9 4.6,13.8 1.7,13.8 1.7,10.2 4.6,10.2 5.5,8.1 3.4,6.0 6.0,3.4 8.1,5.5 10.2,4.6 10.2,1.7 13.8,1.7 13.8,4.6 15.9,5.5 18.0,3.4 20.6,6.0 18.5,8.1 19.4,10.2" /><circle cx="12" cy="12" r="3" /></svg>,
  importer: <svg {...TRAIT}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></svg>,
  reparer: <svg {...TRAIT}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" /></svg>,
  executer: <svg {...TRAIT}><path d="M7 4v16l13-8z" /></svg>,
  loupe: <svg {...TRAIT}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>,
  actualiser: <svg {...TRAIT}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>,
  fleche: <svg {...TRAIT} strokeWidth={2.6}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  croix: <svg {...TRAIT} strokeWidth={2.4}><path d="M6 6l12 12M18 6 6 18" /></svg>,
};
const CHEVRON = <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
const BARRES = <span className="barres vivant" aria-hidden="true"><i /><i /><i /><i /></span>;
export const FLECHE = <span className="ico">{ICONES.fleche}</span>;

// Rangée de départ des trois pages : Activité | fiches | panneau, le panneau à la largeur que la page donne pour cet écran ;
// fiches et panneau partagent leur propre rangée, pour que l'Activité garde sa largeur quand le panneau se ferme
export const arbreFiches = (panneau: (largeurEcran: number) => number | null): ArbreDepart => (zone, style) => {
  const lp = panneau(window.innerWidth) ?? (parseFloat(style.getPropertyValue('--panneau')) || 440);
  const reste = zone.w - 228 - ECART;
  return { dir: 'row', enfants: [{ id: 'activite' }, { dir: 'row', enfants: [{ id: 'fiches' }, { id: 'panneau' }], parts: [Math.max(reste - lp - ECART, 470), lp] }], parts: [228, reste] };
};

// Relance `lire` toutes les `ms` tant que l'onglet du navigateur est visible, et dès qu'il le redevient ; `null` coupe
export function useSondage(lire: () => void, ms: number | null) {
  const courant = useRef(lire);
  useEffect(() => {
    courant.current = lire;
  });
  useEffect(() => {
    if (ms === null) return;
    const tic = () => document.visibilityState === 'visible' && courant.current();
    const minuteur = setInterval(tic, ms);
    document.addEventListener('visibilitychange', tic);
    return () => {
      clearInterval(minuteur);
      document.removeEventListener('visibilitychange', tic);
    };
  }, [ms]);
}

export type Avis = { texte: string; erreur: boolean } | null;
// L'avis du dernier geste, 3,5 s comme les notifications de l'ancien dashboard, plus longtemps pour une erreur
export function useAvis() {
  const [avis, setAvis] = useState<Avis>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dire = useCallback((texte: string, erreur = false) => {
    setAvis({ texte, erreur });
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setAvis(null), erreur ? 6000 : 3500);
  }, []);
  return { avis, dire };
}
export type Dire = (texte: string, erreur?: boolean) => void;

// Les briques qui tournent au nom du compte, lues comme le bandeau de l'ancien dashboard, toutes les 5 s
export function useBriques(section: string) {
  const [actives, setActives] = useState(() => repris(`${section}:briques:actives`, new Set<string>()));
  useGarder(`${section}:briques`, { actives });
  const lire = useCallback(async () => {
    try {
      const vu = await appeler<{ briques_en_cours: { nom: string }[] }>('/pipeline');
      setActives(new Set(vu.briques_en_cours.map((b) => b.nom)));
    } catch {
      // Serveur injoignable : les lots restent comme ils étaient jusqu'à la prochaine lecture
    }
  }, []);
  useEffect(() => {
    lire();
  }, [lire]);
  useSondage(lire, 5000);
  return { actives, lire };
}

export type Confirmation = { question: string; detail?: React.ReactNode; action: string; faire: () => Promise<void> } | null;

type Choix = { valeur: string; libelle: string; compte?: number };
function MenuFiltre({ lib, affiche, choix, valeur, choisir }: { lib: string; affiche: string; choix: Choix[]; valeur: string; choisir: (v: string) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const hote = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => !hote.current?.contains(e.target as Node) && setOuvert(false);
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setOuvert(false);
    };
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', echap, true);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      document.removeEventListener('keydown', echap, true);
    };
  }, [ouvert]);
  return (
    <div ref={hote} className="menu-hote">
      <button type="button" className={`filtre${valeur ? ' actif' : ''}`} aria-haspopup="listbox" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        <span><span className="lib">{lib}</span>{affiche}</span>{CHEVRON}
      </button>
      {ouvert && (
        <div className="menu verre" role="listbox" aria-label={lib}>
          <span className="verre-halos" aria-hidden="true" />
          {choix.map((c) => (
            <button key={c.valeur} type="button" role="option" aria-selected={c.valeur === valeur} className={`menu-option${c.valeur === valeur ? ' actif' : ''}`}
              onClick={() => {
                choisir(c.valeur);
                setOuvert(false);
              }}>
              {c.libelle}{c.compte !== undefined && <span className="compte">{c.compte.toLocaleString('fr-FR')}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Ligne = {
  siren: string; nom: string; secteur: string | null; localisation: string | null; effectif: string | null; site: string | null;
  email: string | null; telephone: string | null; tags: string[]; offres: number; etat: string;
};
type ReponseFiches = { page: number; taille: number; total_filtre: number; pages: number; total: number; comptes: Record<string, number>; lignes: Ligne[] };

// Les pages à montrer : les trois premières et les trois dernières, la courante et ses voisines, « … » où taper la page voulue
function numeros(page: number, pages: number): (number | null)[] {
  const vus = [...new Set([1, 2, 3, page - 1, page, page + 1, pages - 2, pages - 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const sortie: (number | null)[] = [];
  vus.forEach((n, i) => {
    if (i && n - vus[i - 1] > 1 && !sortie.includes(null)) sortie.push(null);
    sortie.push(n);
  });
  return sortie;
}

type ProprietesTableau = {
  // La section qui monte le tableau : ses choix et ses fiches sont gardés sous son nom
  section: string;
  titre: string;
  actions: React.ReactNode;
  confirmation: Confirmation;
  annuler: () => void;
  avis: Avis;
  note?: React.ReactNode;
  // Change quand la page a fait bouger des fiches : le tableau se relit
  version: number;
  selection: Set<string>;
  choisir: (selection: Set<string>) => void;
};

// Le tableau des fiches, le même dans Collecte, Parser et Audit : états filtrants, canaux, recherche, sélection, pagination
export function TableauFiches({ section, titre, actions, confirmation, annuler, avis, note, version, selection, choisir }: ProprietesTableau) {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const question = useQuestionsFiche();
  const versionFiche = useFicheEntreprise((s) => s.version);
  // Ce qui a été lu et choisi reste d'une visite à l'autre, sous le nom de la section : en revenant, tout s'affiche aussitôt et se relit derrière
  const garde = `${section}:fiches`;
  const [etat, setEtat] = useState(() => repris(`${garde}:etat`, ''));
  const [canal, setCanal] = useState(() => repris(`${garde}:canal`, ''));
  const [saisie, setSaisie] = useState(() => repris(`${garde}:saisie`, ''));
  const [cherche, setCherche] = useState(() => repris(`${garde}:cherche`, ''));
  const [page, setPage] = useState(() => repris(`${garde}:page`, 1));
  const [taille, setTaille] = useState(() => repris<number | 'auto'>(`${garde}:taille`, 'auto'));
  const [auto, setAuto] = useState(() => repris(`${garde}:auto`, 16));
  const [donnees, setDonnees] = useState(() => repris<ReponseFiches | null>(`${garde}:donnees`, null));
  useGarder(garde, { etat, canal, saisie, cherche, page, taille, auto, donnees });
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const defile = useRef<HTMLDivElement>(null);
  const rang = useRef(0);
  const parPage = taille === 'auto' ? auto : taille;

  // La frappe se pose avant de partir : « developpement » ne lance pas douze requêtes, et une recherche déjà posée (celle gardée au retour) garde sa page
  useEffect(() => {
    if (saisie.trim() === cherche) return;
    const minuteur = setTimeout(() => {
      setCherche(saisie.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(minuteur);
  }, [saisie, cherche]);

  // « auto » : autant de lignes que la hauteur de la fenêtre en tient, dix au moins comme le serveur l'exige ; remesuré quand les lignes arrivent
  const mesurer = useCallback(() => {
    const el = defile.current;
    if (!el) return;
    const tete = el.querySelector('thead')?.getBoundingClientRect().height ?? 34;
    const ligne = el.querySelector('tbody tr:not(.vide-tableau)')?.getBoundingClientRect().height || parseFloat(getComputedStyle(el).getPropertyValue('--ligne')) || 36;
    setAuto(Math.max(10, Math.floor((el.clientHeight - tete) / ligne)));
  }, []);
  useLayoutEffect(() => {
    if (!defile.current) return;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(defile.current);
    return () => observateur.disconnect();
  }, [mesurer]);

  const lire = useCallback(async () => {
    const n = ++rang.current;
    const params = new URLSearchParams({ q: cherche, etat, tags: canal, page: String(page), taille: String(parPage) });
    try {
      const vu = await appeler<ReponseFiches>(`/vues/collecte/fiches?${params}`);
      if (n !== rang.current) return;
      setDonnees(vu);
      setErreur('');
      if (page > vu.pages) setPage(vu.pages);
    } catch (e) {
      if (n === rang.current) setErreur(messageDe(e));
    }
  }, [cherche, etat, canal, page, parPage]);
  useEffect(() => {
    lire();
  }, [lire, version, versionFiche]);
  useSondage(lire, 8000);

  // Échap referme la confirmation d'abord, puis le panneau
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || confirmation || question || !onglet) return;
      fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [confirmation, question, onglet, fermer]);

  useLayoutEffect(mesurer, [donnees, mesurer]);
  const lignes = donnees?.lignes ?? [];
  const comptes = donnees?.comptes ?? {};
  const toutes = lignes.length > 0 && lignes.every((l) => selection.has(l.siren));
  const cocher = (sirens: string[], oui: boolean) => {
    const s = new Set(selection);
    sirens.forEach((x) => (oui ? s.add(x) : s.delete(x)));
    choisir(s);
  };
  const choixEtat: Choix[] = [{ valeur: '', libelle: 'Total', compte: donnees?.total ?? 0 }, ...ETATS.map((e) => ({ valeur: e.code, libelle: e.libelle, compte: comptes[e.code] ?? 0 }))];
  const etatChoisi = choixEtat.find((c) => c.valeur === etat) ?? choixEtat[0];
  const pages = donnees?.pages ?? 1;
  const [aller, setAller] = useState('');

  return (
    <Fenetre id="fiches" as="div" className="tableau" aria-label={titre} titrePrise={`Glisser pour détacher ${titre.toLowerCase()}`}>
      <div className="outils">
        <MenuFiltre lib="État" affiche={`${etatChoisi.libelle} · ${(etatChoisi.compte ?? 0).toLocaleString('fr-FR')}`} choix={choixEtat} valeur={etat}
          choisir={(v) => {
            setEtat(v);
            setPage(1);
          }} />
        <MenuFiltre lib="Canaux" affiche={canal || 'tous'} valeur={canal} choix={[{ valeur: '', libelle: 'tous' }, ...CANAUX.map((c) => ({ valeur: c.nom, libelle: c.nom }))]}
          choisir={(v) => {
            setCanal(v);
            setPage(1);
          }} />
        <label className="cherche">
          <span className="ico-cherche">{ICONES.loupe}</span>
          <input type="search" placeholder="Nom, SIREN, ville, site…" aria-label="Chercher une fiche" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        </label>
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">{actions}</div>
      </div>
      {confirmation ? (
        <Confirmer question={confirmation.question} detail={confirmation.detail} action={confirmation.action} occupe={occupe} onAnnuler={annuler}
          onConfirmer={async () => {
            setOccupe(true);
            await confirmation.faire();
            setOccupe(false);
            annuler();
          }} />
      ) : question && (
        <Confirmer question={question.question} detail={question.detail} action={question.action} occupe={occupe}
          onAnnuler={() => useFicheEntreprise.setState({ question: null })}
          onConfirmer={async () => {
            setOccupe(true);
            await question.faire(fermer);
            setOccupe(false);
            useFicheEntreprise.setState({ question: null });
          }} />
      )}
      <div className="defile" ref={defile}>
        <table className="fiches">
          <thead>
            <tr>
              <th><input type="checkbox" className="case" aria-label="Tout sélectionner" checked={toutes} onChange={(e) => cocher(lignes.map((l) => l.siren), e.target.checked)} /></th>
              <th>Entreprise</th><th>Secteur</th><th>Localisation</th><th>Effectif</th><th>Site</th><th>Email</th><th>Téléphone</th><th>Offres</th><th>Canaux</th><th>État</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.siren} className={[selection.has(l.siren) && 'coche', l.siren === objet && onglet === 'fiche-entreprise' && 'ouverte'].filter(Boolean).join(' ') || undefined}
                tabIndex={0} data-ouvre="fiche-entreprise" data-objet={l.siren}
                onClick={() => ouvrir('fiche-entreprise', l.siren)} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && ouvrir('fiche-entreprise', l.siren)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="case" aria-label={`Sélectionner ${l.nom}`} checked={selection.has(l.siren)} onChange={(e) => cocher([l.siren], e.target.checked)} />
                </td>
                <td className="ent2"><a href={`#${l.siren}`} className="ent" title={l.nom} onClick={(e) => e.preventDefault()}>{l.nom}</a><span className="siren">{l.siren}</span></td>
                <td className={l.secteur ? 'd' : 'vide'} title={l.secteur ?? undefined}>{l.secteur ?? '—'}</td>
                <td className={l.localisation ? undefined : 'vide'}>{l.localisation ?? '—'}</td>
                <td className={l.effectif ? 'd' : 'vide'}>{l.effectif ?? '—'}</td>
                <td className={l.site ? undefined : 'vide'}>
                  {lienSur(l.site) ? <a href={lienSur(l.site)} target="_blank" rel="noopener noreferrer" title={l.site ?? ''} onClick={(e) => e.stopPropagation()}>{sansProtocole(l.site)}</a> : l.site ?? '—'}
                </td>
                <td className={l.email ? 'd' : 'vide'}>{l.email ?? '—'}</td>
                <td className={l.telephone ? 'd' : 'vide'}>{l.telephone ?? '—'}</td>
                {/* Une fiche à peine collectée n'a pas encore été cherchée : « — » plutôt qu'un zéro */}
                <td className={!l.offres && l.etat === 'COLLECTEE' ? 'vide' : undefined}>
                  {l.offres ? <span className="nb">{l.offres}</span> : l.etat === 'COLLECTEE' ? '—' : <span className="nb zero">0</span>}
                </td>
                <td><Marques tags={l.tags} /></td>
                <td><Etape etat={l.etat} /></td>
              </tr>
            ))}
            {!lignes.length && (
              <tr className="vide-tableau"><td colSpan={11}>{erreur || (donnees ? 'Aucune entreprise ne correspond : ajustez les filtres, ou lancez une collecte Sirene.' : 'Chargement des fiches…')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <select aria-label="Lignes par page" value={String(taille)} onChange={(e) => {
          setTaille(e.target.value === 'auto' ? 'auto' : Number(e.target.value));
          setPage(1);
        }}>
          <option value="auto">auto ({auto})</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
        <nav className="pages" aria-label="Pages">
          <button type="button" className="pl" disabled={page <= 1} aria-label="Page précédente" onClick={() => setPage(page - 1)}>‹</button>
          {numeros(page, pages).map((n) => n === null ? (
            <input key="aller" type="text" className="aller" inputMode="numeric" placeholder="…" size={3} aria-label="Aller à la page" value={aller}
              onChange={(e) => setAller(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !aller) return;
                setPage(Math.min(Math.max(1, Number(aller)), pages));
                setAller('');
              }} />
          ) : (
            <button key={n} type="button" className={`pl${n === page ? ' actif' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button type="button" className="pl" disabled={page >= pages} aria-label="Page suivante" onClick={() => setPage(page + 1)}>›</button>
        </nav>
        {avis ? <span className={`note-bas avis${avis.erreur ? ' erreur' : ''}`} role="status">{avis.texte}</span>
          : erreur && lignes.length ? <span className="note-bas erreur" role="status">{erreur}</span>
          : note && <span className="note-bas">{note}</span>}
      </div>
    </Fenetre>
  );
}

// Onglets ouverts par un geste (une fiche, une offre, une question) ; les autres sont ceux des actions de la page
const OUVERTS_PAR_UN_GESTE = new Set(['fiche-entreprise', 'deja-audit', 'fiche-offre', 'deja-base']);

// Le panneau des trois pages : les fiches, leurs onglets propres, « Déjà audité » s'il attend ; après un geste, un onglet d'action ne reste que s'il est ouvert
export function PanneauFiches({ avant = [], apres = [] }: { avant?: Onglet[]; apres?: Onglet[] }) {
  const { onglet, ouvrir } = usePanneau();
  const objets = useVues().vues[0].objets;
  const deja = useFicheEntreprise((s) => s.deja);
  const elements = {
    'fiche-entreprise': (s: string) => ongletFicheEntreprise(s, { ouvrirOffre: (c) => ouvrir('fiche-offre', c), dejaEnOnglet: true }),
    'fiche-offre': (c: string) => ongletFicheOffre(c, { ouvrirEntreprise: (s) => ouvrir('fiche-entreprise', s) }),
  };
  // « Voir l'audit » rouvre aussitôt la fiche sans objet : celle de l'audit passe après
  const onglets = [...avant, ...(deja ? [ongletDejaAudite()] : []), ...apres];
  const parGeste = Object.keys(elements).some((cle) => objets[cle] !== undefined) || onglets.some((o) => OUVERTS_PAR_UN_GESTE.has(o.cle));
  return <Panneau elements={elements} onglets={onglets.filter((o) => !parGeste || OUVERTS_PAR_UN_GESTE.has(o.cle) || o.cle === onglet)} />;
}

export type Lot = { brique: string; famille: string; libelle: string; aide: string; icone: React.ReactNode; plein?: boolean };

// Les lots d'une page : un par brique, ceux d'une même famille bloqués entre eux ; celui qui tourne s'arrête au clic, deux fois pour abandonner la fiche en cours
export function Lots({ lots, actives, selection, dire, relire, demander }: {
  lots: Lot[]; actives: Set<string>; selection: Set<string>; dire: Dire; relire: () => void; demander: (c: Confirmation) => void;
}) {
  const occupees = new Set(lots.filter((l) => actives.has(l.brique)).map((l) => l.famille));
  const n = selection.size;
  const lancer = async (lot: Lot) => {
    const sirens = [...selection];
    try {
      const r = await appeler<{ lancee: boolean; occupee_par: string }>(`/briques/${lot.brique}/lancer`, { methode: 'POST', corps: { sirens: sirens.length ? sirens : null } });
      dire(r.lancee ? `Brique ${lot.brique} lancée sur ${sirens.length ? `${sirens.length} fiche(s)` : 'toutes les fiches éligibles'}.`
        : r.occupee_par ? `« ${r.occupee_par} » tourne déjà : les temps de l'audit écrivent la même fiche et attendent leur tour.`
        : `Brique ${lot.brique} déjà en cours.`, !r.lancee);
    } catch (e) {
      dire(messageDe(e), true);
    }
    relire();
  };
  const arreter = async (lot: Lot) => {
    try {
      const r = await appeler<{ arretee: boolean; force: boolean }>(`/briques/${lot.brique}/arreter`, { methode: 'POST' });
      dire(!r.arretee ? 'Aucun lot en cours.' : r.force ? 'Arrêt forcé — la fiche en cours est abandonnée.' : "Arrêt demandé — la fiche en cours se termine. Recliquer l'abandonne.", !r.arretee);
    } catch (e) {
      dire(messageDe(e), true);
    }
    relire();
  };
  return lots.map((lot) => {
    if (actives.has(lot.brique)) {
      return (
        <button key={lot.brique} type="button" className="action encours" aria-pressed="true" title={`${lot.aide}. En marche — cliquer pour arrêter.`} onClick={() => arreter(lot)}>
          <span className="ico">{BARRES}</span><span className="txt">{lot.libelle}</span><span className="etat-a">en cours</span>
        </button>
      );
    }
    const bloque = occupees.has(lot.famille);
    const titre = bloque ? `${lot.aide}. Un autre temps de l'audit tourne : ils écrivent la même fiche et ne peuvent pas se croiser.`
      : `${lot.aide}. Cliquer pour lancer sur ${n ? `les ${n} fiche(s) cochées` : 'toutes les fiches éligibles'} ; le résultat est écrit en base.`;
    // Sans sélection, la brique prend toutes les fiches éligibles : la question est posée d'abord
    const clic = () => (n ? lancer(lot) : demander({
      question: `Lancer la brique « ${lot.brique} » sur toutes les fiches éligibles ?`, detail: `${lot.aide}.`, action: 'Lancer', faire: () => lancer(lot),
    }));
    return lot.plein ? (
      <button key={lot.brique} type="button" className="action plein" disabled={bloque} title={titre} onClick={clic}>
        <span className="txt">{lot.libelle}</span><span className="nb-sel">&nbsp;{n}</span>{FLECHE}
      </button>
    ) : (
      <button key={lot.brique} type="button" className="action" disabled={bloque} title={titre} onClick={clic}>
        <span className="ico">{lot.icone}</span><span className="txt">{lot.libelle}</span><span className="nb-sel">&nbsp;{n}</span>
      </button>
    );
  });
}

// Une action de la rangée qui ouvre un onglet du panneau, allumée tant qu'il est ouvert
export function ActionOnglet({ cle, libelle, icone, titre }: { cle: string; libelle: string; icone: React.ReactNode; titre?: string }) {
  const { onglet, ouvrir } = usePanneau();
  return (
    <button type="button" className={`action${onglet === cle ? ' allume' : ''}`} aria-haspopup="dialog" aria-expanded={onglet === cle} title={titre ?? libelle} onClick={() => ouvrir(cle)}>
      <span className="ico">{icone}</span><span className="txt">{libelle}</span>
    </button>
  );
}

/* Réglages globaux d'une brique : lus et écrits dans les réglages du compte, « Enregistrer » éteint tant que rien ne change */

export type ChampReglage = {
  cle: string; libelle: string; type: 'nombre' | 'texte' | 'liste' | 'booleen' | 'catalogue' | 'modele';
  catalogue?: string; exemple?: string; aide?: string; admin?: boolean;
};
type Parametres = Record<string, unknown> & { modeles?: { nom: string }[] };
// Une liste se tape en texte, « .fr, .com » : elle ne redevient une liste qu'à l'envoi
const versSaisie = (champ: ChampReglage, valeur: unknown) => (champ.type === 'liste' ? ((valeur as string[] | undefined) ?? []).join(', ') : valeur);
const versReglage = (champ: ChampReglage, valeur: unknown) => (champ.type === 'liste' ? String(valeur ?? '').split(',').map((v) => v.trim()).filter(Boolean) : valeur);

export function useReglages(section: string, champs: ChampReglage[], dire: Dire, apres?: () => void) {
  const [parametres, setParametres] = useState(() => repris<Parametres | null>(`${section}:reglages:parametres`, null));
  useGarder(`${section}:reglages`, { parametres });
  const depuis = useCallback((p: Parametres) => Object.fromEntries(champs.map((c) => [c.cle, versSaisie(c, p[c.cle])])), [champs]);
  // Les réglages gardés remplissent le formulaire dès l'arrivée, la lecture qui suit le remet à jour
  const [valeurs, setValeurs] = useState<Record<string, unknown>>(() => (parametres ? depuis(parametres) : {}));
  useEffect(() => {
    appeler<Parametres>('/parametres').then((p) => {
      setParametres(p);
      setValeurs(depuis(p));
    }).catch((e) => dire(messageDe(e), true));
  }, [depuis, dire]);
  const change = !!parametres && JSON.stringify(champs.map((c) => versReglage(c, valeurs[c.cle]))) !== JSON.stringify(champs.map((c) => parametres[c.cle]));
  return {
    parametres, valeurs, change,
    poser: (cle: string, valeur: unknown) => setValeurs((v) => ({ ...v, [cle]: valeur })),
    annuler: () => parametres && setValeurs(depuis(parametres)),
    enregistrer: async () => {
      try {
        const p = await appeler<Parametres>('/parametres', { methode: 'PUT', corps: Object.fromEntries(champs.map((c) => [c.cle, versReglage(c, valeurs[c.cle])])) });
        setParametres(p);
        setValeurs(depuis(p));
        dire('Réglages enregistrés — les lots les reprennent aussitôt.');
        apres?.();
      } catch (e) {
        dire(`Enregistrement refusé : ${messageDe(e)}`, true);
      }
    },
  };
}
type Reglages = ReturnType<typeof useReglages>;

// Les puces choisies et la recherche dans le même champ ; Entrée prend le premier résultat
function Catalogue({ id, nom, codes, poser }: { id: string; nom: string; codes: string[]; poser: (codes: string[]) => void }) {
  const [libelles, setLibelles] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState('');
  const [trouves, setTrouves] = useState<{ code: string; libelle: string }[]>([]);
  const hote = useRef<HTMLDivElement>(null);
  const rang = useRef(0);
  useEffect(() => {
    const manquants = codes.filter((c) => !(c in libelles));
    if (!manquants.length) return;
    appeler<{ code: string; libelle: string }[]>(`/catalogues/${nom}?codes=${encodeURIComponent(manquants.join(','))}`)
      .then((lus) => setLibelles((l) => ({ ...l, ...Object.fromEntries(manquants.map((c) => [c, lus.find((e) => e.code === c)?.libelle ?? ''])) })))
      .catch(() => undefined);
  }, [codes, libelles, nom]);
  useEffect(() => {
    if (!trouves.length) return;
    const dehors = (e: PointerEvent) => !hote.current?.contains(e.target as Node) && setTrouves([]);
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [trouves.length]);
  const proposer = async (q: string) => {
    setQuestion(q);
    // Les réponses n'arrivent pas dans l'ordre des frappes : seule la dernière compte
    const n = ++rang.current;
    if (!q.trim()) return setTrouves([]);
    try {
      const lus = await appeler<{ code: string; libelle: string }[]>(`/catalogues/${nom}?q=${encodeURIComponent(q.trim())}`);
      if (n === rang.current) setTrouves(lus.filter((e) => !codes.includes(e.code)));
    } catch {
      setTrouves([]);
    }
  };
  const prendre = (e: { code: string; libelle: string }) => {
    setLibelles((l) => ({ ...l, [e.code]: e.libelle }));
    poser([...codes, e.code]);
    setQuestion('');
    setTrouves([]);
  };
  // Une ville se reconnaît à son nom, son code INSEE ne dit rien
  const avecCode = nom !== 'communes';
  return (
    <div className="catalogue" ref={hote}>
      {codes.map((c) => (
        <span key={c} className="puce" title={libelles[c] || c}>
          {avecCode && <b>{c}</b>}<span>{libelles[c] || (avecCode ? '' : c)}</span>
          <button type="button" aria-label={`Retirer ${libelles[c] || c}`} onClick={() => poser(codes.filter((x) => x !== c))}>{ICONES.croix}</button>
        </span>
      ))}
      <input id={id} type="search" placeholder="Ajouter…" autoComplete="off" value={question} onChange={(e) => proposer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && trouves.length) {
            e.preventDefault();
            setTrouves([]);
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (trouves[0]) prendre(trouves[0]);
          }
        }} />
      {trouves.length > 0 && (
        <div className="propositions" role="listbox" aria-label="Résultats">
          {trouves.map((e) => <button key={e.code} type="button" role="option" aria-selected="false" onClick={() => prendre(e)}>{avecCode && <b>{e.code}</b>}<span>{e.libelle}</span></button>)}
        </div>
      )}
    </div>
  );
}

function ChampReglageVue({ champ, r }: { champ: ChampReglage; r: Reglages }) {
  const id = `rg-${champ.cle}`;
  const v = r.valeurs[champ.cle];
  const libelle = <>{champ.libelle}{champ.admin && <MarqueAdmin />}</>;
  if (champ.type === 'booleen') {
    return <label className="inter" title={champ.aide}><span>{libelle}</span><input type="checkbox" checked={!!v} onChange={(e) => r.poser(champ.cle, e.target.checked)} /></label>;
  }
  return (
    <div className="champ">
      <label htmlFor={id} title={champ.aide}>{libelle}</label>
      {champ.type === 'catalogue' ? <Catalogue id={id} nom={champ.catalogue!} codes={(v as string[] | undefined) ?? []} poser={(codes) => r.poser(champ.cle, codes)} />
        : champ.type === 'modele' ? (
          <select id={id} className="saisie" value={String(v ?? '')} onChange={(e) => r.poser(champ.cle, e.target.value)}>
            {['', ...(r.parametres?.modeles ?? []).map((m) => m.nom)].map((nom) => <option key={nom} value={nom}>{nom || 'Aucun'}</option>)}
          </select>
        ) : (
          <input id={id} className="saisie" type={champ.type === 'nombre' ? 'number' : 'text'} placeholder={champ.exemple} value={String(v ?? '')}
            onChange={(e) => r.poser(champ.cle, champ.type === 'nombre' ? parseInt(e.target.value, 10) || 0 : e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && r.change && r.enregistrer()} />
        )}
    </div>
  );
}

// Les catalogues pleine largeur, puis les nombres et textes deux par deux, puis les interrupteurs
export function CorpsReglages({ champs, r, aide }: { champs: ChampReglage[]; r: Reglages; aide?: React.ReactNode }) {
  if (!r.parametres) return <p className="texte-f">Chargement des réglages…</p>;
  const catalogues = champs.filter((c) => c.type === 'catalogue');
  const autres = champs.filter((c) => c.type !== 'catalogue' && c.type !== 'booleen');
  const inters = champs.filter((c) => c.type === 'booleen');
  return (
    <div className="pf">
      {catalogues.length > 0 && <div className="section-f">{catalogues.map((c) => <ChampReglageVue key={c.cle} champ={c} r={r} />)}</div>}
      <div className="section-f">
        <div className="grille-2 bas">{autres.map((c) => <ChampReglageVue key={c.cle} champ={c} r={r} />)}</div>
        {inters.map((c) => <ChampReglageVue key={c.cle} champ={c} r={r} />)}
        {aide && <p className="aide-champ">{aide}</p>}
      </div>
    </div>
  );
}

export function PiedReglages({ r }: { r: Reglages }) {
  const { fermer } = usePanneau();
  return (
    <>
      <button type="button" className="action gauche" onClick={() => {
        r.annuler();
        fermer();
      }}>Annuler</button>
      <button type="button" className="action plein" disabled={!r.change} title={r.change ? 'Écrit ces valeurs dans les réglages du pipeline : les lots les reprendront.' : 'Rien n’a changé.'} onClick={r.enregistrer}>Enregistrer{FLECHE}</button>
    </>
  );
}

/* Exécuter une brique à la main : ses arguments, le mode test, le lancement suivi toutes les 1,5 s, sa sortie */

type Argument = { cle: string; libelle: string; type: string; requis: boolean; aide: string; exemple: string; parametre: string; separe: boolean; valeur: unknown };
type EtatAtelier = { en_cours: boolean; ok: boolean | null; erreur: string; rapport: Record<string, unknown>; depuis_s: number; duree_s: number };
type BriqueAtelier = { nom: string; arguments: Argument[]; etat: EtatAtelier };
type Valeurs = Record<string, string | boolean>;
type VueFiche = { siren: string; nom: string; etat: string; site: string | null };
type Divergence = { champ: string; saisi: string; fiche: string };
type AuditEnBase = { quand: string; prealable: boolean; resume: string };
type Produit = { fiche: VueFiche; produit: Record<string, unknown>; produit_prealable: boolean; base: AuditEnBase | null; test: boolean; garde: string };

const CONTROLES: Record<string, (v: string) => string> = {
  url: (v) => (/^https?:\/\/\S+$/i.test(v) ? '' : 'le site doit commencer par http:// ou https://'),
  site: (v) => (/^https?:\/\/\S+$/i.test(v) ? '' : 'le site doit commencer par http:// ou https://'),
  siren: (v) => (/^\d{9}$/.test(v) ? '' : 'le SIREN compte 9 chiffres'),
};
const LIBELLES_FICHE: Record<string, string> = { url: 'Site officiel', nom: 'Entreprise', siren: 'SIREN' };
export const duree = (s: number) => (!s ? "à l'instant" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);
const lireRetenues = (nom: string): Valeurs => {
  try {
    return JSON.parse(localStorage.getItem(cleBrouillon(`atelier:${nom}`)) ?? '{}');
  } catch {
    return {};
  }
};
// Ce qui avait été tapé la dernière fois, sinon ce que le serveur propose
const valeursDe = (nom: string, b: BriqueAtelier): Valeurs => {
  const retenues = lireRetenues(nom);
  return Object.fromEntries(b.arguments.filter((a) => !a.parametre).map((a) => [a.cle, (retenues[a.cle] ?? a.valeur ?? '') as string | boolean]));
};

export function useAtelier(nom: 'parser' | 'audit', dire: Dire, relireTable: () => void) {
  // La brique, sa sortie et ce qu'elle a produit restent d'une visite à l'autre, sous le nom de la section
  const [brique, setBrique] = useState(() => repris<BriqueAtelier | null>(`${nom}:atelier:brique`, null));
  const [valeurs, setValeurs] = useState<Valeurs>(() => (brique ? valeursDe(nom, brique) : {}));
  const [test, setTest] = useState(true);
  const [etat, setEtat] = useState(() => repris<EtatAtelier | null>(`${nom}:atelier:etat`, null));
  const [produit, setProduit] = useState(() => repris<Produit | null>(`${nom}:atelier:produit`, null));
  useGarder(`${nom}:atelier`, { brique, etat, produit });
  const [dejaBase, setDejaBase] = useState<{ fiche: VueFiche; reprises: { champ: string; fiche: string }[]; divergences: Divergence[]; choix: Record<string, 'fiche' | 'saisi'> } | null>(null);
  // Le lancement dont il reste à écrire le résultat, une fois la brique finie
  const garde = useRef<{ valeurs: Valeurs; test: boolean } | null>(null);

  const charger = useCallback(async () => {
    try {
      const b = (await appeler<BriqueAtelier[]>('/atelier')).find((x) => x.nom === nom) ?? null;
      setBrique(b);
      if (!b) return;
      setEtat(b.etat);
      setValeurs((v) => (Object.keys(v).length ? v : valeursDe(nom, b)));
    } catch (e) {
      dire(messageDe(e), true);
    }
  }, [nom, dire]);
  useEffect(() => {
    charger();
  }, [charger]);
  useEffect(() => {
    if (!Object.keys(valeurs).length) return;
    try {
      localStorage.setItem(cleBrouillon(`atelier:${nom}`), JSON.stringify(valeurs));
    } catch {
      // Navigation privée ou stockage plein : rien n'est retenu
    }
  }, [nom, valeurs]);

  const ecrireParser = async (g: { valeurs: Valeurs }) => {
    try {
      const r = await appeler<{ siren: string; nom: string; creee: boolean; etat: string }>('/atelier/parser/appliquer', { methode: 'POST', corps: { siren: g.valeurs.siren ?? '', nom: g.valeurs.nom ?? '' } });
      dire(`${r.nom} (${r.siren}) : fiche ${r.creee ? 'créée' : 'mise à jour'}, état ${libelleEtat(r.etat)}.`);
      relireTable();
    } catch (e) {
      dire(messageDe(e), true);
    }
  };
  const ecrireAudit = async (siren: string) => {
    try {
      const r = await appeler<{ siren: string; nom: string; etat: string }>('/atelier/audit/appliquer', { methode: 'POST', corps: { siren } });
      dire(`${r.nom} (${r.siren}) : audit rangé, état ${libelleEtat(r.etat)}.`);
      setProduit((p) => p && { ...p, garde: 'Audit rangé sur la fiche.' });
      relireTable();
    } catch (e) {
      dire(messageDe(e), true);
    }
  };
  // Ce que l'audit vient de produire, et ce que la base porte en face
  const presenterAudit = async (g: { valeurs: Valeurs; test: boolean }) => {
    try {
      const vu = await appeler<Omit<Produit, 'test' | 'garde'> & { erreur: string }>('/atelier/audit/produit', {
        methode: 'POST', corps: { siren: g.valeurs.siren ?? '', nom: g.valeurs.entreprise ?? '', url: g.valeurs.site ?? '' },
      });
      if (!vu.produit) return vu.erreur && dire(vu.erreur, true);
      setProduit({ ...vu, test: g.test, garde: '' });
      if (!g.test && !vu.base) ecrireAudit(vu.fiche.siren);
    } catch (e) {
      dire(messageDe(e), true);
    }
  };

  const lire = useCallback(async () => {
    try {
      const e = await appeler<EtatAtelier>(`/atelier/${nom}`);
      setEtat(e);
      if (e.en_cours || !garde.current) return;
      const g = garde.current;
      garde.current = null;
      if (!e.ok) return;
      if (nom === 'audit') presenterAudit(g);
      else ecrireParser(g);
    } catch {
      // Le serveur ne répond pas : la prochaine lecture reprendra
    }
  }, [nom]); // eslint-disable-line react-hooks/exhaustive-deps
  useSondage(lire, etat?.en_cours ? 1500 : null);

  const avecReglages = (v: Valeurs) => ({ ...v, ...Object.fromEntries((brique?.arguments ?? []).filter((a) => a.parametre).map((a) => [a.cle, a.valeur])) });
  const partir = async (v: Valeurs) => {
    try {
      const r = await appeler<{ lancee: boolean }>(`/atelier/${nom}`, { methode: 'POST', corps: { valeurs: avecReglages(v) } });
      // L'audit se présente dans les deux modes ; le parser n'écrit qu'hors mode test
      if (r.lancee) garde.current = nom === 'audit' || !test ? { valeurs: v, test } : null;
      if (r.lancee) setProduit(null);
      dire(r.lancee ? (test ? 'Test lancé — rien ne sera écrit en base.' : 'Lancé — le résultat sera écrit sur la fiche à la fin.')
        : `Brique ${nom} déjà lancée depuis ici : attendez-la, ou arrêtez-la.`, !r.lancee);
    } catch (e) {
      dire(messageDe(e), true);
    }
    lire();
  };

  const motifs = (brique?.arguments ?? []).filter((a) => !a.parametre).flatMap((a) => {
    const v = valeurs[a.cle];
    const rempli = typeof v === 'string' ? v.trim() : v;
    if (a.requis && !rempli) return [`${a.libelle} est obligatoire`];
    const motif = typeof rempli === 'string' && rempli && CONTROLES[a.cle]?.(rempli);
    return motif ? [motif] : [];
  });

  const executer = async (ouvrir: (cle: string) => void) => {
    if (etat?.en_cours) {
      try {
        const r = await appeler<{ arretee: boolean }>(`/atelier/${nom}/arreter`, { methode: 'POST' });
        dire(r.arretee ? "Brique tuée — ce qu'elle avait dit reste affiché." : 'Aucun lancement en cours.', !r.arretee);
      } catch (e) {
        dire(messageDe(e), true);
      }
      return lire();
    }
    const siren = String(valeurs.siren ?? '').trim();
    try {
      // Hors mode test, l'audit passe par le pipeline : le résultat est écrit sur la fiche nommée par son SIREN
      if (nom === 'audit' && !test) {
        if (!/^\d{9}$/.test(siren)) return dire('Hors mode test, renseignez le SIREN de la fiche à mettre à jour.', true);
        const r = await appeler<{ lancee: boolean }>(`/entreprises/${siren}/briques/audit`, { methode: 'POST' });
        return dire(r.lancee ? 'Brique audit lancée par le pipeline — le résultat est écrit en base, suivez le journal.' : 'Brique audit déjà en cours.', !r.lancee);
      }
      if (nom === 'audit') {
        const vu = await appeler<{ fiche: VueFiche | null; base: AuditEnBase | null }>('/atelier/audit/fiche', { methode: 'POST', corps: { siren, nom: valeurs.entreprise ?? '', url: valeurs.site ?? '' } });
        if (vu.fiche && vu.base) {
          useFicheEntreprise.setState({ deja: { ...vu.base, siren: vu.fiche.siren, nom: vu.fiche.nom, retour: 'executer', lancer: () => partir(valeurs) } });
          return ouvrir('deja-audit');
        }
        return partir(valeurs);
      }
      // Le parser s'accorde avec la fiche avant de partir : c'est le seul moment où l'on peut encore changer ce qu'il lira
      const vu = await appeler<{ fiche: VueFiche | null; reprises: { champ: string; fiche: string }[]; divergences: Divergence[] }>('/atelier/parser/fiche', {
        methode: 'POST', corps: { siren, nom: valeurs.nom ?? '', url: valeurs.url ?? '' },
      });
      if (vu.fiche && vu.divergences.length) {
        setDejaBase({ fiche: vu.fiche, reprises: vu.reprises, divergences: vu.divergences, choix: Object.fromEntries(vu.divergences.map((d) => [d.champ, 'fiche'])) });
        return ouvrir('deja-base');
      }
      const v = { ...valeurs, ...Object.fromEntries(vu.reprises.map((r) => [r.champ, r.fiche])) };
      setValeurs(v);
      return partir(v);
    } catch (e) {
      dire(messageDe(e), true);
    }
  };

  const trancher = (ouvrir: (cle: string) => void) => {
    if (!dejaBase) return;
    // Ce qui part est ce qui s'affiche : le formulaire reprend les valeurs retenues
    const v = { ...valeurs, ...Object.fromEntries(dejaBase.reprises.map((r) => [r.champ, r.fiche])),
      ...Object.fromEntries(dejaBase.divergences.filter((d) => dejaBase.choix[d.champ] === 'fiche').map((d) => [d.champ, d.fiche])) };
    setValeurs(v);
    setDejaBase(null);
    ouvrir('executer');
    partir(v);
  };

  return {
    nom, brique, valeurs, test, etat, produit, dejaBase, motifs, executer, trancher,
    poser: (cle: string, v: string | boolean) => setValeurs((x) => ({ ...x, [cle]: cle === 'siren' && typeof v === 'string' ? v.replace(/\s+/g, '') : v })),
    setTest, setDejaBase, setProduit, ecrireAudit, recharger: charger,
  };
}
type Atelier = ReturnType<typeof useAtelier>;

const LIBELLES_RAPPORT: Record<string, string> = {
  site: 'Site lu', pages_visitees: 'Pages visitées', offres_url: "Page d'offres", offres_score: 'Score de la page d\'offres', offres_preuve: 'Preuve retenue',
  offres_preuve_dure: 'Preuve dure', spontanee_url: 'Candidature spontanée', spontanee_raison: 'Repérée par', email: 'Email principal', emails: 'Emails',
  telephone: 'Téléphone principal', implantations: 'Implantations', couleurs: "Couleurs de l'identité",
};
// Le détail page par page pèse des milliers de lignes et ne dit rien de plus que son compte
const RAPPORT_MASQUE = new Set(['pages', 'offres_details', '_prealable']);
const libelleRapport = (cle: string) => LIBELLES_RAPPORT[cle] ?? cle.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

function ValeurRapport({ cle, v }: { cle: string; v: unknown }): React.ReactNode {
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  if (typeof v === 'number') return v.toLocaleString('fr-FR');
  if (typeof v === 'string') return lienSur(v) ? <a className="lien" href={lienSur(v)} target="_blank" rel="noopener noreferrer" title={v}>{sansProtocole(v)}</a> : v;
  if (Array.isArray(v)) {
    if (cle === 'couleurs') return <span className="couleurs">{v.filter((c) => /^#[0-9a-f]{6}$/i.test(String(c))).map((c) => <span key={c}><i style={{ background: c }} />{c}</span>)}</span>;
    // Une adresse trouvée vaut par elle-même ; une implantation, par son numéro, sa ville et son adresse
    const textes = v.map((x) => (x && typeof x === 'object' ? (cle === 'emails' ? String((x as { email?: string }).email ?? '') : Object.values(x).filter((y) => y !== null && y !== '' && typeof y !== 'object').join(' — ')) : String(x))).filter(Boolean);
    return textes.length > 1 && v.some((x) => x && typeof x === 'object') && cle !== 'emails' ? textes.map((t) => <span key={t}>{t}</span>) : textes.join(' · ');
  }
  if (v && typeof v === 'object') return Object.entries(v).filter(([, y]) => y !== null && y !== '' && !(Array.isArray(y) && !y.length)).map(([k, y]) => `${libelleRapport(k)} : ${Array.isArray(y) ? y.join(', ') : typeof y === 'object' ? JSON.stringify(y) : y}`).join(' · ');
  return String(v);
}

function Rapport({ rapport }: { rapport: Record<string, unknown> }) {
  const lignes = Object.entries(rapport ?? {}).filter(([cle, v]) => !RAPPORT_MASQUE.has(cle) && v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length));
  if (!lignes.length) return null;
  return (
    <ul className="liste-f">
      {lignes.map(([cle, v]) => (
        <li key={cle}><span className="lib-champ">{libelleRapport(cle)}</span><span className={`d${Array.isArray(v) && v.some((x) => x && typeof x === 'object') && cle !== 'emails' ? ' pile' : ''}`}><ValeurRapport cle={cle} v={v} /></span></li>
      ))}
    </ul>
  );
}

function ChampAtelier({ a, at }: { a: Argument; at: Atelier }) {
  const { ouvrir } = usePanneau();
  const id = `at-${at.nom}-${a.cle}`;
  return (
    <div className="champ">
      <label htmlFor={id} title={a.aide}>{a.libelle}{a.requis && <abbr title="Obligatoire"> *</abbr>}</label>
      <input id={id} className="saisie" type={a.cle === 'url' || a.cle === 'site' ? 'url' : 'text'} placeholder={a.exemple} value={String(at.valeurs[a.cle] ?? '')}
        onChange={(e) => at.poser(a.cle, e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (at.etat?.en_cours || !at.motifs.length) && at.executer(ouvrir)} />
    </div>
  );
}

export function CorpsAtelier({ at }: { at: Atelier }) {
  if (!at.brique) return <p className="texte-f">Chargement de la brique…</p>;
  const args = at.brique.arguments.filter((a) => !a.parametre);
  const textes = args.filter((a) => a.type !== 'booleen');
  const premier = textes.find((a) => a.requis) ?? textes[0];
  const etat = at.etat;
  const sortie = etat && (etat.en_cours || etat.ok !== null);
  const p = at.produit;
  return (
    <div className="pf">
      <div className="section-f">
        {premier && <ChampAtelier a={premier} at={at} />}
        <div className="grille-2">{textes.filter((a) => a !== premier).map((a) => <ChampAtelier key={a.cle} a={a} at={at} />)}</div>
        <div className="grille-2 inters">
          {args.filter((a) => a.type === 'booleen' && !a.separe).map((a) => (
            <label key={a.cle} className="inter" title={a.aide}><span>{a.libelle}</span><input type="checkbox" checked={!!at.valeurs[a.cle]} onChange={(e) => at.poser(a.cle, e.target.checked)} /></label>
          ))}
          <label className="inter" title={at.nom === 'parser'
            ? "Coché : la brique tourne, son résultat s'affiche ici, et rien n'est écrit en base. Décoché : à la fin, le résultat est écrit sur la fiche."
            : "Coché : la brique tourne, sa sortie s'affiche ici, et rien n'est écrit en base. Décoché : le lancement passe par le pipeline et le résultat est conservé."}>
            <span>Mode test<MarqueAdmin /></span><input type="checkbox" checked={at.test} onChange={(e) => at.setTest(e.target.checked)} />
          </label>
          {args.filter((a) => a.type === 'booleen' && a.separe).map((a) => (
            <label key={a.cle} className="inter" title={a.aide}><span>{a.libelle}<MarqueAdmin /></span><input type="checkbox" checked={!!at.valeurs[a.cle]} onChange={(e) => at.poser(a.cle, e.target.checked)} /></label>
          ))}
        </div>
      </div>
      {sortie && (
        <div className="section-f">
          <div className="titre-badge">
            <h3>Sortie</h3>
            <span className={`badge${etat.en_cours ? '' : etat.ok ? ' fini' : ' echec'}`} title={etat.erreur || undefined}>
              {etat.en_cours ? `en cours · ${duree(etat.depuis_s)}` : etat.ok ? `terminée en ${duree(etat.duree_s)}` : `en échec — ${etat.erreur || 'voir le journal du serveur'}`}
            </span>
          </div>
          {p ? (
            <>
              <p className="note-f">{p.garde || (p.base
                ? `${p.test ? 'Mode test : rien n’est écrit. ' : ''}La fiche ${p.fiche.nom} porte déjà ${p.base.prealable ? 'une collecte brute' : 'une analyse complète'}, du ${dateHeure(p.base.quand)} ; ce lancement a produit ${p.produit_prealable ? 'une collecte brute' : 'une analyse complète'}.`
                : `Mode test : rien n'est écrit. La fiche ${p.fiche.nom} n'a encore aucun audit en base.`)}</p>
              {!p.test && p.base && !p.garde && (
                <div className="gestes-f">
                  <button type="button" className="action" onClick={() => at.setProduit({ ...p, garde: "La fiche garde ce qu'elle avait : ce résultat reste affiché, et rien n'est écrit." })}>Garder celle de la fiche</button>
                  <button type="button" className="action" onClick={() => at.ecrireAudit(p.fiche.siren)}>Remplacer par ce résultat</button>
                </div>
              )}
              <Rapport rapport={p.produit} />
            </>
          ) : <Rapport rapport={etat.rapport} />}
        </div>
      )}
    </div>
  );
}

export function PiedAtelier({ at }: { at: Atelier }) {
  const { ouvrir } = usePanneau();
  const enCours = !!at.etat?.en_cours;
  // Une brique qui tourne s'arrête toujours : le grisage ne vaut que pour le lancement
  return (
    <button type="button" className="action plein" disabled={!enCours && at.motifs.length > 0} title={!enCours && at.motifs.length ? `Impossible de lancer : ${at.motifs.join(' ; ')}.` : undefined}
      onClick={() => at.executer(ouvrir)}>{enCours ? 'Arrêter' : 'Exécuter'}<span className="ico">{enCours ? ICONES.croix : ICONES.executer}</span></button>
  );
}

// « Cette entreprise est déjà en base » : ce qui est repris de la fiche, et ce qui diffère, champ par champ
export function CorpsDejaBase({ at }: { at: Atelier }) {
  const d = at.dejaBase;
  if (!d) return <p className="texte-f">Rien à trancher.</p>;
  return (
    <div className="pf">
      <p className="texte-f"><b>{d.fiche.nom}</b> ({d.fiche.siren}) est déjà dans le pipeline, à l&apos;état {libelleEtat(d.fiche.etat)}. Ce que porte sa fiche ne correspond pas à ce qui est saisi : le parser lira ce que vous choisissez ici.</p>
      {d.reprises.length > 0 && (
        <div className="section-f"><h3>Repris de la fiche</h3>
          <ul className="liste-f">{d.reprises.map((r) => <li key={r.champ}><span className="lib-champ">{LIBELLES_FICHE[r.champ] ?? r.champ}</span><span className="d">{r.fiche}</span></li>)}</ul>
        </div>
      )}
      <div className="section-f"><h3>Ce qui diffère — à trancher</h3>
        {d.divergences.map((v) => (
          <div key={v.champ}>
            <p className="lib-champ arb">{LIBELLES_FICHE[v.champ] ?? v.champ}</p>
            <div className="grille-2 arbitre" role="radiogroup" aria-label={LIBELLES_FICHE[v.champ] ?? v.champ}>
              {(['fiche', 'saisi'] as const).map((c) => (
                <label key={c} className="choix tranche">
                  <input type="radio" name={`tranche-${v.champ}`} className="cache" checked={d.choix[v.champ] === c} onChange={() => at.setDejaBase({ ...d, choix: { ...d.choix, [v.champ]: c } })} />
                  <span className="tr-lib">{c === 'fiche' ? 'Prendre la fiche' : 'Garder ce qui est saisi'}</span>
                  <span className="tr-val">{c === 'fiche' ? v.fiche : v.saisi}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PiedDejaBase({ at }: { at: Atelier }) {
  const { ouvrir } = usePanneau();
  return (
    <>
      <button type="button" className="action" onClick={() => {
        ouvrir('executer');
        at.setDejaBase(null);
      }}>Annuler</button>
      <button type="button" className="action plein" onClick={() => at.trancher(ouvrir)}>Lancer le parser{FLECHE}</button>
    </>
  );
}
