'use client';

import './fiches.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { ecrireBrouillon, lireBrouillon, repris, useGarder } from '../../stockage';
import { useSondage } from '../../activite/sondage';
import { Dock, Fenetre, usePanneau, useVues, type ArbreDepart } from '../../dock/Dock';
import { useAvis, type Avis, type Dire } from '../../elements/Avis';
import { ECART } from '../../dock/moteur';
import { Confirmer, MarqueAdmin, Panneau, type Onglet } from '../../dock/Panneau';
import { CANAUX, ConfirmerQuestion, ETATS, Etape, FLECHE, Marques, libelleEtat, ongletDejaAudite, ongletFicheEntreprise, sansProtocole, useFicheEntreprise, useQuestionsFiche } from '../../partage/FicheEntreprise';
import { ongletFicheOffre } from '../../partage/FicheOffre';
import { PaginationAller, duree, useEchap, useLignesAuto, usePagination } from '../commun';
import { MenuFiltre, useClicDehors } from '../../elements/Menu';
import { useCoches } from '../../elements/Case';
import { Action } from '../../elements/Action';
import { Case } from '../../elements/Case';
import { Champ, Interrupteur, ChampSaisie, SectionFiche, LibelleValeur, OptionsModele } from '../../elements/Champ';
import { ICONES } from '../../elements/icones';
import { ouvrable } from '../../elements/Case';
import { lienSur, message, parVirgules, quand } from '../../elements/format';
import { PageDock } from '../../activite/PageDock';

const BARRES = <span className="barres vivant" aria-hidden="true"><i /><i /><i /><i /></span>;

// Fiches et panneau partagent leur rangée : l'Activité garde sa largeur
export const arbreFiches = (panneau: (largeurEcran: number) => number | null): ArbreDepart => (zone, style) => {
  const lp = panneau(window.innerWidth) ?? (parseFloat(style.getPropertyValue('--panneau')) || 440);
  const reste = zone.w - 228 - ECART;
  return { dir: 'row', enfants: [{ id: 'activite' }, { dir: 'row', enfants: [{ id: 'fiches' }, { id: 'panneau' }], parts: [Math.max(reste - lp - ECART, 470), lp] }], parts: [228, reste] };
};

// Briques qui tournent au nom du compte, relues toutes les 5 s
export function useBriques(section: string) {
  const [actives, setActives] = useState(() => repris(`${section}:briques:actives`, new Set<string>()));
  useGarder(`${section}:briques`, { actives });
  const lire = useCallback(async () => {
    try {
      const vu = await appeler<{ briques_en_cours: { nom: string }[] }>('/pipeline');
      setActives(new Set(vu.briques_en_cours.map((b) => b.nom)));
    } catch {
      // Serveur injoignable : les lots restent jusqu'à la prochaine lecture
    }
  }, []);
  useSondage(lire, 5000);
  return { actives, lire };
}

export type Confirmation = { question: string; detail?: React.ReactNode; action: string; faire: () => Promise<void> } | null;

type Choix = { valeur: string; libelle: string; compte?: number };
function FiltreFiches({ lib, affiche, choix, valeur, choisir }: { lib: string; affiche: string; choix: Choix[]; valeur: string; choisir: (v: string) => void }) {
  return <MenuFiltre lib={lib} valeur={affiche} actif={!!valeur} courant={valeur} choisir={choisir} icone={ICONES.chevron}
    choix={choix.map((c) => ({ cle: c.valeur, libelle: c.libelle, fin: c.compte !== undefined && <span className="compte">{c.compte.toLocaleString('fr-FR')}</span> }))} />;
}

type Ligne = {
  siren: string; nom: string; secteur: string | null; localisation: string | null; effectif: string | null; site: string | null;
  email: string | null; telephone: string | null; tags: string[]; offres: number; etat: string;
};
type ReponseFiches = { page: number; taille: number; total_filtre: number; pages: number; total: number; comptes: Record<string, number>; lignes: Ligne[] };

// Pages montrées : les bords, la courante et ses voisines
type ProprietesTableau = {
  // La section qui monte le tableau garde ses choix et ses fiches sous son nom
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

// Tableau des fiches commun à Collecte, Parser et Audit
export function TableauFiches({ section, titre, actions, confirmation, annuler, avis, note, version, selection, choisir }: ProprietesTableau) {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const question = useQuestionsFiche();
  const versionFiche = useFicheEntreprise((s) => s.version);
  // Le lu et le choisi restent d'une visite à l'autre et se relisent derrière
  const garde = `${section}:fiches`;
  const [etat, setEtat] = useState(() => repris(`${garde}:etat`, ''));
  const [canal, setCanal] = useState(() => repris(`${garde}:canal`, ''));
  const [saisie, setSaisie] = useState(() => repris(`${garde}:saisie`, ''));
  const [cherche, setCherche] = useState(() => repris(`${garde}:cherche`, ''));
  const { page, setPage, taille, setTaille, auto, setAuto } = usePagination(garde, 16);
  const [donnees, setDonnees] = useState(() => repris<ReponseFiches | null>(`${garde}:donnees`, null));
  useGarder(garde, { etat, canal, saisie, cherche, donnees });
  const [erreur, setErreur] = useState('');
  const defile = useRef<HTMLDivElement>(null);
  const rang = useRef(0);
  const parPage = taille === 'auto' ? auto : taille;

  // La frappe se pose avant de partir ; une recherche gardée garde sa page
  useEffect(() => {
    if (saisie.trim() === cherche) return;
    const minuteur = setTimeout(() => {
      setCherche(saisie.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(minuteur);
  }, [saisie, cherche]);

  // « auto » : lignes selon la hauteur de la fenêtre, dix au moins
  useLignesAuto(defile, setAuto, donnees, 10);

  const adresse = `/vues/collecte/fiches?${new URLSearchParams({ q: cherche, etat, tags: canal, page: String(page), taille: String(parPage) })}`;
  const lire = useCallback(async () => {
    const n = ++rang.current;
    try {
      const vu = await appeler<ReponseFiches>(adresse);
      if (n !== rang.current) return;
      setDonnees(vu);
      setErreur('');
      if (page > vu.pages) setPage(vu.pages);
    } catch (e) {
      if (n === rang.current) setErreur(message(e));
    }
  }, [adresse, page]);
  useSondage(lire, 8000, true, `${adresse}|${version}|${versionFiche}`);

  // Échap referme la confirmation d'abord, puis le panneau
  useEchap(() => {
    if (!confirmation && !question && onglet) fermer();
  });

  const lignes = donnees?.lignes ?? [];
  const comptes = donnees?.comptes ?? {};
  const { toutes, cocher } = useCoches(selection, choisir, lignes.map((l) => l.siren));
  const choixEtat: Choix[] = [{ valeur: '', libelle: 'Total', compte: donnees?.total ?? 0 }, ...ETATS.map((e) => ({ valeur: e.code, libelle: e.libelle, compte: comptes[e.code] ?? 0 }))];
  const etatChoisi = choixEtat.find((c) => c.valeur === etat) ?? choixEtat[0];
  const pages = donnees?.pages ?? 1;

  return (
    <Fenetre id="fiches" as="div" className="tableau" aria-label={titre} titrePrise={`Glisser pour détacher ${titre.toLowerCase()}`}>
      <div className="outils">
        <FiltreFiches lib="État" affiche={`${etatChoisi.libelle} · ${(etatChoisi.compte ?? 0).toLocaleString('fr-FR')}`} choix={choixEtat} valeur={etat}
          choisir={(v) => {
            setEtat(v);
            setPage(1);
          }} />
        <FiltreFiches lib="Canaux" affiche={canal || 'tous'} valeur={canal} choix={[{ valeur: '', libelle: 'tous' }, ...CANAUX.map((c) => ({ valeur: c.nom, libelle: c.nom }))]}
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
        <Confirmer question={confirmation.question} detail={confirmation.detail} action={confirmation.action} onAnnuler={annuler}
          onConfirmer={async () => {
            await confirmation.faire();
            annuler();
          }} />
      ) : question && <ConfirmerQuestion question={question} fermer={fermer} />}
      <div className="defile" ref={defile}>
        <table className="fiches">
          <thead>
            <tr>
              <th><Case aria-label="Tout sélectionner" checked={toutes} onChange={(e) => cocher(lignes.map((l) => l.siren), e.target.checked)} /></th>
              <th>Entreprise</th><th>Secteur</th><th>Localisation</th><th>Effectif</th><th>Site</th><th>Email</th><th>Téléphone</th><th>Offres</th><th>Canaux</th><th>État</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.siren} className={[selection.has(l.siren) && 'coche', l.siren === objet && onglet === 'fiche-entreprise' && 'ouverte'].filter(Boolean).join(' ') || undefined} {...ouvrable('fiche-entreprise', l.siren, () => ouvrir('fiche-entreprise', l.siren))}>
                <td onClick={(e) => e.stopPropagation()}>
                  <Case aria-label={`Sélectionner ${l.nom}`} checked={selection.has(l.siren)} onChange={(e) => cocher([l.siren], e.target.checked)} />
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
                {/* Fiche à peine collectée, pas encore cherchée : un tiret plutôt qu'un zéro */}
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
      <PaginationAller page={page} pages={pages} setPage={setPage} taille={taille} tailles={[25, 50]} auto={auto} setTaille={(t) => {
        setTaille(t);
        setPage(1);
      }}>
        {avis ? <span className={`note-bas avis${avis.erreur ? ' erreur' : ''}`} role="status">{avis.texte}</span>
          : erreur && lignes.length ? <span className="note-bas erreur" role="status">{erreur}</span>
          : note && <span className="note-bas">{note}</span>}
      </PaginationAller>
    </Fenetre>
  );
}

// Onglets d'un geste (fiche, offre, question) ; les autres, ceux des actions
const OUVERTS_PAR_UN_GESTE = new Set(['fiche-entreprise', 'deja-audit', 'fiche-offre', 'deja-base']);

// Après un geste, un onglet d'action ne reste que s'il est ouvert
export function PanneauFiches({ avant = [], apres = [] }: { avant?: Onglet[]; apres?: Onglet[] }) {
  const { onglet, ouvrir } = usePanneau();
  const objets = useVues().vues[0].objets;
  const deja = useFicheEntreprise((s) => s.deja);
  const elements = {
    'fiche-entreprise': (s: string) => ongletFicheEntreprise(s, { ouvrirOffre: (c) => ouvrir('fiche-offre', c), dejaEnOnglet: true }),
    'fiche-offre': (c: string) => ongletFicheOffre(c, { ouvrirEntreprise: (s) => ouvrir('fiche-entreprise', s) }),
  };
  // « Voir l'audit » rouvre la fiche sans objet : celle de l'audit passe après
  const onglets = [...avant, ...(deja ? [ongletDejaAudite()] : []), ...apres];
  const parGeste = Object.keys(elements).some((cle) => objets[cle] !== undefined) || onglets.some((o) => OUVERTS_PAR_UN_GESTE.has(o.cle));
  return <Panneau elements={elements} onglets={onglets.filter((o) => !parGeste || OUVERTS_PAR_UN_GESTE.has(o.cle) || o.cle === onglet)} />;
}

// État commun d'une page de fiches : avis, sélection, confirmation, relecture
export function useEtatFiches() {
  const { avis, dire } = useAvis();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [version, setVersion] = useState(0);
  const relire = useCallback(() => setVersion((v) => v + 1), []);
  return { avis, dire, selection, setSelection, confirmation, setConfirmation, version, relire };
}

// Page de fiches : Activité, tableau, panneau ; la page donne gestes et onglets
export function PageFiches({ section, etat, arbre, fenetres, panneau, note, actions, avant, apres }: Pick<React.ComponentProps<typeof Dock>, 'arbre' | 'fenetres' | 'panneau'> & Pick<React.ComponentProps<typeof PanneauFiches>, 'avant' | 'apres'> & {
  section: string; etat: ReturnType<typeof useEtatFiches>; note?: React.ReactNode; actions: React.ReactNode;
}) {
  return (
    <PageDock id={section} principal="fiches" arbre={arbre} fenetres={{ fiches: { mini: [470, 220] }, ...fenetres }} panneau={panneau}>
      <TableauFiches section={section} titre="Fiches entreprises" avis={etat.avis} note={note} version={etat.version} selection={etat.selection} choisir={etat.setSelection}
        confirmation={etat.confirmation} annuler={() => etat.setConfirmation(null)} actions={actions} />
      <PanneauFiches avant={avant} apres={apres} />
    </PageDock>
  );
}

export type Lot = { brique: string; famille: string; libelle: string; aide: string; icone: React.ReactNode; plein?: boolean };

// Lots bloqués par famille ; un clic arrête, deux abandonnent la fiche
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
      dire(message(e), true);
    }
    relire();
  };
  const arreter = async (lot: Lot) => {
    try {
      const r = await appeler<{ arretee: boolean; force: boolean }>(`/briques/${lot.brique}/arreter`, { methode: 'POST' });
      dire(!r.arretee ? 'Aucun lot en cours.' : r.force ? 'Arrêt forcé — la fiche en cours est abandonnée.' : "Arrêt demandé — la fiche en cours se termine. Recliquer l'abandonne.", !r.arretee);
    } catch (e) {
      dire(message(e), true);
    }
    relire();
  };
  return lots.map((lot) => {
    if (actives.has(lot.brique)) {
      return (
        <Action className="encours" icone={BARRES} key={lot.brique} aria-pressed="true" title={`${lot.aide}. En marche — cliquer pour arrêter.`} onClick={() => arreter(lot)}><span className="txt">{lot.libelle}</span><span className="etat-a">en cours</span>
        </Action>
      );
    }
    const bloque = occupees.has(lot.famille);
    const titre = bloque ? `${lot.aide}. Un autre temps de l'audit tourne : ils écrivent la même fiche et ne peuvent pas se croiser.`
      : `${lot.aide}. Cliquer pour lancer sur ${n ? `les ${n} fiche(s) cochées` : 'toutes les fiches éligibles'} ; le résultat est écrit en base.`;
    // Sans sélection, la brique prend toutes les fiches éligibles : on demande
    const clic = () => (n ? lancer(lot) : demander({
      question: `Lancer la brique « ${lot.brique} » sur toutes les fiches éligibles ?`, detail: `${lot.aide}.`, action: 'Lancer', faire: () => lancer(lot),
    }));
    return lot.plein ? (
      <Action plein key={lot.brique} disabled={bloque} title={titre} onClick={clic}>
        <span className="txt">{lot.libelle}</span><span className="nb-sel">&nbsp;{n}</span>{FLECHE}
      </Action>
    ) : (
      <Action icone={lot.icone} key={lot.brique} disabled={bloque} title={titre} onClick={clic}><span className="txt">{lot.libelle}</span><span className="nb-sel">&nbsp;{n}</span>
      </Action>
    );
  });
}

/* Réglages globaux d'une brique ; « Enregistrer » éteint sans changement */

export type ChampReglage = {
  cle: string; libelle: string; type: 'nombre' | 'texte' | 'liste' | 'booleen' | 'catalogue' | 'modele';
  catalogue?: string; exemple?: string; aide?: string; admin?: boolean;
};
type Parametres = Record<string, unknown> & { modeles?: { nom: string }[] };
// Une liste se tape en texte et ne redevient liste qu'à l'envoi
const versSaisie = (champ: ChampReglage, valeur: unknown) => (champ.type === 'liste' ? ((valeur as string[] | undefined) ?? []).join(', ') : valeur);
const versReglage = (champ: ChampReglage, valeur: unknown) => (champ.type === 'liste' ? parVirgules(String(valeur ?? '')) : valeur);

export function useReglages(section: string, champs: ChampReglage[], dire: Dire, apres?: () => void) {
  const [parametres, setParametres] = useState(() => repris<Parametres | null>(`${section}:reglages:parametres`, null));
  useGarder(`${section}:reglages`, { parametres });
  const depuis = useCallback((p: Parametres) => Object.fromEntries(champs.map((c) => [c.cle, versSaisie(c, p[c.cle])])), [champs]);
  // Les réglages gardés remplissent le formulaire, la lecture le met à jour
  const [valeurs, setValeurs] = useState<Record<string, unknown>>(() => (parametres ? depuis(parametres) : {}));
  useEffect(() => {
    appeler<Parametres>('/parametres').then((p) => {
      setParametres(p);
      setValeurs(depuis(p));
    }).catch((e) => dire(message(e), true));
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
        dire(`Enregistrement refusé : ${message(e)}`, true);
      }
    },
  };
}
type Reglages = ReturnType<typeof useReglages>;

// Puces et recherche dans un champ ; Entrée prend le premier résultat
function Catalogue({ id, nom, codes, poser }: { id: string; nom: string; codes: string[]; poser: (codes: string[]) => void }) {
  const [libelles, setLibelles] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState('');
  const [trouves, setTrouves] = useState<{ code: string; libelle: string }[]>([]);
  const refermer = useCallback(() => setTrouves([]), []);
  const hote = useClicDehors(trouves.length > 0, refermer);
  const rang = useRef(0);
  useEffect(() => {
    const manquants = codes.filter((c) => !(c in libelles));
    if (!manquants.length) return;
    appeler<{ code: string; libelle: string }[]>(`/catalogues/${nom}?codes=${encodeURIComponent(manquants.join(','))}`)
      .then((lus) => setLibelles((l) => ({ ...l, ...Object.fromEntries(manquants.map((c) => [c, lus.find((e) => e.code === c)?.libelle ?? ''])) })))
      .catch(() => undefined);
  }, [codes, libelles, nom]);
  const proposer = async (q: string) => {
    setQuestion(q);
    // Les réponses arrivent dans le désordre : seule la dernière compte
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
    return <Interrupteur libelle={libelle} title={champ.aide} checked={!!v} onChange={(e) => r.poser(champ.cle, e.target.checked)} />;
  }
  return (
    <Champ pour={id} titre={champ.aide} libelle={libelle}>
      {champ.type === 'catalogue' ? <Catalogue id={id} nom={champ.catalogue!} codes={(v as string[] | undefined) ?? []} poser={(codes) => r.poser(champ.cle, codes)} />
        : champ.type === 'modele' ? (
          <select id={id} className="saisie" value={String(v ?? '')} onChange={(e) => r.poser(champ.cle, e.target.value)}>
            <OptionsModele modeles={r.parametres?.modeles ?? []} vide="Aucun" valeur={String(v ?? '')} detail={false} />
          </select>
        ) : (
          <input id={id} className="saisie" type={champ.type === 'nombre' ? 'number' : 'text'} placeholder={champ.exemple} value={String(v ?? '')}
            onChange={(e) => r.poser(champ.cle, champ.type === 'nombre' ? parseInt(e.target.value, 10) || 0 : e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && r.change && r.enregistrer()} />
        )}
    </Champ>
  );
}

// Catalogues d'abord, puis nombres et textes par deux, puis interrupteurs
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
      <Action className="gauche" onClick={() => {
        r.annuler();
        fermer();
      }}>Annuler</Action>
      <Action plein disabled={!r.change} title={r.change ? 'Écrit ces valeurs dans les réglages du pipeline : les lots les reprendront.' : 'Rien n’a changé.'} onClick={r.enregistrer}>Enregistrer{FLECHE}</Action>
    </>
  );
}

/* Lancement manuel d'une brique, suivi toutes les 1,5 s */

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
// Ce qui avait été tapé la dernière fois, sinon ce que le serveur propose
const valeursDe = (nom: string, b: BriqueAtelier): Valeurs => {
  const retenues = lireBrouillon<Valeurs>(`atelier:${nom}`);
  return Object.fromEntries(b.arguments.filter((a) => !a.parametre).map((a) => [a.cle, (retenues[a.cle] ?? a.valeur ?? '') as string | boolean]));
};

export function useAtelier(nom: 'parser' | 'audit', dire: Dire, relireTable: () => void) {
  // La brique, sa sortie et son résultat restent d'une visite à l'autre
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
      dire(message(e), true);
    }
  }, [nom, dire]);
  useEffect(() => {
    charger();
  }, [charger]);
  useEffect(() => {
    if (Object.keys(valeurs).length) ecrireBrouillon(`atelier:${nom}`, valeurs);
  }, [nom, valeurs]);

  const ecrireParser = async (g: { valeurs: Valeurs }) => {
    try {
      const r = await appeler<{ siren: string; nom: string; creee: boolean; etat: string }>('/atelier/parser/appliquer', { methode: 'POST', corps: { siren: g.valeurs.siren ?? '', nom: g.valeurs.nom ?? '' } });
      dire(`${r.nom} (${r.siren}) : fiche ${r.creee ? 'créée' : 'mise à jour'}, état ${libelleEtat(r.etat)}.`);
      relireTable();
    } catch (e) {
      dire(message(e), true);
    }
  };
  const ecrireAudit = async (siren: string) => {
    try {
      const r = await appeler<{ siren: string; nom: string; etat: string }>('/atelier/audit/appliquer', { methode: 'POST', corps: { siren } });
      dire(`${r.nom} (${r.siren}) : audit rangé, état ${libelleEtat(r.etat)}.`);
      setProduit((p) => p && { ...p, garde: 'Audit rangé sur la fiche.' });
      relireTable();
    } catch (e) {
      dire(message(e), true);
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
      dire(message(e), true);
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
  useSondage(lire, 1500, !!etat?.en_cours);

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
      dire(message(e), true);
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
        dire(message(e), true);
      }
      return lire();
    }
    const siren = String(valeurs.siren ?? '').trim();
    try {
      // Hors mode test, l'audit passe par le pipeline qui écrit sur la fiche du SIREN
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
      // Le parser s'accorde avec la fiche avant de partir, pas après
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
      dire(message(e), true);
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
// Le détail page par page pèse des milliers de lignes : le compte suffit
const RAPPORT_MASQUE = new Set(['pages', 'offres_details', '_prealable']);
const libelleRapport = (cle: string) => LIBELLES_RAPPORT[cle] ?? cle.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

function ValeurRapport({ cle, v }: { cle: string; v: unknown }): React.ReactNode {
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  if (typeof v === 'number') return v.toLocaleString('fr-FR');
  if (typeof v === 'string') return lienSur(v) ? <a className="lien" href={lienSur(v)} target="_blank" rel="noopener noreferrer" title={v}>{sansProtocole(v)}</a> : v;
  if (Array.isArray(v)) {
    if (cle === 'couleurs') return <span className="couleurs">{v.filter((c) => /^#[0-9a-f]{6}$/i.test(String(c))).map((c) => <span key={c}><i style={{ background: c }} />{c}</span>)}</span>;
    // Une adresse vaut seule ; une implantation, par numéro, ville et adresse
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
        <LibelleValeur key={cle} as="li" libelle={libelleRapport(cle)}><span className={`d${Array.isArray(v) && v.some((x) => x && typeof x === 'object') && cle !== 'emails' ? ' pile' : ''}`}><ValeurRapport cle={cle} v={v} /></span></LibelleValeur>
      ))}
    </ul>
  );
}

function ChampAtelier({ a, at }: { a: Argument; at: Atelier }) {
  const { ouvrir } = usePanneau();
  const id = `at-${at.nom}-${a.cle}`;
  return (
    <ChampSaisie id={id} titre={a.aide} libelle={<>{a.libelle}{a.requis && <abbr title="Obligatoire"> *</abbr>}</>} type={a.cle === 'url' || a.cle === 'site' ? 'url' : 'text'} placeholder={a.exemple} value={String(at.valeurs[a.cle] ?? '')} onChange={(e) => at.poser(a.cle, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (at.etat?.en_cours || !at.motifs.length) && at.executer(ouvrir)} />
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
            <Interrupteur key={a.cle} libelle={a.libelle} title={a.aide} checked={!!at.valeurs[a.cle]} onChange={(e) => at.poser(a.cle, e.target.checked)} />
          ))}
          <Interrupteur libelle={<>Mode test<MarqueAdmin /></>} title={at.nom === 'parser'
            ? "Coché : la brique tourne, son résultat s'affiche ici, et rien n'est écrit en base. Décoché : à la fin, le résultat est écrit sur la fiche."
            : "Coché : la brique tourne, sa sortie s'affiche ici, et rien n'est écrit en base. Décoché : le lancement passe par le pipeline et le résultat est conservé."} checked={at.test} onChange={(e) => at.setTest(e.target.checked)} />
          {args.filter((a) => a.type === 'booleen' && a.separe).map((a) => (
            <Interrupteur key={a.cle} libelle={<>{a.libelle}<MarqueAdmin /></>} title={a.aide} checked={!!at.valeurs[a.cle]} onChange={(e) => at.poser(a.cle, e.target.checked)} />
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
                ? `${p.test ? 'Mode test : rien n’est écrit. ' : ''}La fiche ${p.fiche.nom} porte déjà ${p.base.prealable ? 'une collecte brute' : 'une analyse complète'}, du ${quand(p.base.quand)} ; ce lancement a produit ${p.produit_prealable ? 'une collecte brute' : 'une analyse complète'}.`
                : `Mode test : rien n'est écrit. La fiche ${p.fiche.nom} n'a encore aucun audit en base.`)}</p>
              {!p.test && p.base && !p.garde && (
                <div className="gestes-f">
                  <Action onClick={() => at.setProduit({ ...p, garde: "La fiche garde ce qu'elle avait : ce résultat reste affiché, et rien n'est écrit." })}>Garder celle de la fiche</Action>
                  <Action onClick={() => at.ecrireAudit(p.fiche.siren)}>Remplacer par ce résultat</Action>
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
  // Une brique qui tourne s'arrête toujours : seul le lancement se grise
  return (
    <Action plein iconeApres={enCours ? ICONES.croix : ICONES.executer} disabled={!enCours && at.motifs.length > 0} title={!enCours && at.motifs.length ? `Impossible de lancer : ${at.motifs.join(' ; ')}.` : undefined} onClick={() => at.executer(ouvrir)}>{enCours ? 'Arrêter' : 'Exécuter'}</Action>
  );
}

// « Déjà en base » : ce qui est repris de la fiche et ce qui diffère, par champ
export function CorpsDejaBase({ at }: { at: Atelier }) {
  const d = at.dejaBase;
  if (!d) return <p className="texte-f">Rien à trancher.</p>;
  return (
    <div className="pf">
      <p className="texte-f"><b>{d.fiche.nom}</b> ({d.fiche.siren}) est déjà dans le pipeline, à l&apos;état {libelleEtat(d.fiche.etat)}. Ce que porte sa fiche ne correspond pas à ce qui est saisi : le parser lira ce que vous choisissez ici.</p>
      {d.reprises.length > 0 && (
        <SectionFiche titre="Repris de la fiche">
          <ul className="liste-f">{d.reprises.map((r) => <LibelleValeur key={r.champ} as="li" libelle={LIBELLES_FICHE[r.champ] ?? r.champ} d>{r.fiche}</LibelleValeur>)}</ul>
        </SectionFiche>
      )}
      <SectionFiche titre="Ce qui diffère — à trancher">
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
      </SectionFiche>
    </div>
  );
}

export function PiedDejaBase({ at }: { at: Atelier }) {
  const { ouvrir } = usePanneau();
  return (
    <>
      <Action onClick={() => {
        ouvrir('executer');
        at.setDejaBase(null);
      }}>Annuler</Action>
      <Action plein onClick={() => at.trancher(ouvrir)}>Lancer le parser{FLECHE}</Action>
    </>
  );
}
