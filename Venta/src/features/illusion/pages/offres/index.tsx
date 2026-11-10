'use client';

import './offres.css';
import { LienIllusion } from '../../partage/LienIllusion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';

import { Fenetre, usePanneau } from '../../dock/Dock';
import { MarqueAdmin, Panneau, type Onglet } from '../../dock/Panneau';
import { ConfirmerQuestion, ongletFicheEntreprise, useFicheEntreprise, useQuestionsFiche } from '../../partage/FicheEntreprise';
import { OFFRE_CHANGEE, ongletFicheOffre } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import { ChoixLangue, MenuFiltre, PiedCartes, RetraitCarte, avisAjout, posterOffre, surEntree, urlOffreValide, useCartes, useEtatVeille, useGestesStock, useParametresVeille, useProfilsVeille, type Choix, type Parametres, type ProfilRecherche, type Taille } from './commun';
import { PaginationAller, useEchap, useGeste, useLignesAuto } from '../commun';
import { Action } from '../../elements/Action';
import { useAvis, type Dire } from '../../elements/Avis';
import { Champ, Interrupteur, ChampSaisie, ChampZone, ChampListe } from '../../elements/Champ';
import { ActionOnglet } from '../../elements/Groupes';
import { ICONES } from '../../elements/icones';
import { ouvrable } from '../../elements/Case';
import { jourMoisIso, libelleSource, lienSur, message, nomFichier, nomLangue, nomMetier, optionsGroupe, parVirgules, sansJson } from '../../elements/format';
import { PageDock } from '../../activite/PageDock';

type OffreFile = {
  cle: string; entreprise_brute: string; entreprise_siren: string | null; titre: string; lieu: string; contrat: string; source: string;
  publiee_le: string; etape: string; langue: string; metiers: string[]; rattachement: string; raison: string;
};
type ReponseFile = { comptes: Record<string, number>; groupes: { langues?: Record<string, number>; metiers?: Record<string, number> }; offres: OffreFile[]; pages: number; total_filtre: number };
type Ecartee = { cle: string; motif: string; detail: string; source: string; titre: string; entreprise: string; lieu: string; contrat: string; publiee_le: string; url: string };
type ReponseEcartees = { resume: { par_motif: Record<string, number> }; offres: Ecartee[]; pages: number; total_filtre: number };
type ProfilDispo = { nom: string; chemin: string };
type Incomplets = Record<string, { cle: string; libelle: string }[]>;

// Passes dans l'ordre où une offre les traverse ; un motif filtre les écartées
type Passe = { cle: string; libelle: string; motif?: string };
const PASSES: Passe[] = [
  { cle: '', libelle: 'Total' },
  { cle: 'fenetre', libelle: 'Hors fenêtre', motif: 'hors fenêtre' },
  { cle: 'france', libelle: 'Hors France', motif: 'hors France' },
  { cle: 'banword', libelle: 'Tri banword', motif: 'terme banni' },
  { cle: 'ia', libelle: 'Tri par IA', motif: 'Hors-Contexte' },
  { cle: 'SOCLE', libelle: 'Socle' },
  { cle: 'INADAPTEE', libelle: "Tri fiche d'offre" },
  { cle: 'A_POSTULER', libelle: 'À postuler' },
  { cle: 'A_LA_MAIN', libelle: 'À faire à la main' },
  { cle: 'ENVOYEE', libelle: 'Envoyée' },
  { cle: 'ECHEC', libelle: 'Échec' },
  { cle: 'ECARTEE', libelle: 'Écartée' },
];
// Motif en double de « Inadaptée » : le compter deux fois gonflait le total
const MOTIF_FICHE = 'Hors-Profil';
const CLASSE_ETAPE: Record<string, string> = { ENVOYEE: 'env', A_LA_MAIN: 'main', ECHEC: 'ech', ECARTEE: 'eca' };
// Pourquoi une offre n'a pas de fiche : mot sous l'entreprise, infobulle
const RAISONS: Record<string, [string, string]> = {
  rattachee: ['rattachée', 'rattachée à une fiche'], creee: ['fiche créée', "fiche créée depuis l'offre"],
  inconnue: ['introuvable', 'employeur introuvable dans Sirene'],
  a_identifier: ['à identifier', "employeur pas encore recherché (il l'est après l'envoi)"],
  intermediaire: ['intermédiaire', 'pas un employeur (cabinet, jobboard, mention générique)'],
  hors_cible: ['hors cible', 'hors cible (effectif, statut)'],
};
const PREFIXE_BANNI = 'terme banni : ';
const libelleMotif = (m: string) => (m.startsWith(PREFIXE_BANNI) ? `terme banni « ${m.slice(PREFIXE_BANNI.length)} »` : m);

export default function PageOffres({ compte }: ProprietesPage) {
  return (
    <PageDock id="offres" principal="offres" panneau={compte.admin ? 'veille' : 'recherche'}>
      <Offres admin={compte.admin} />
    </PageDock>
  );
}

function Offres({ admin }: { admin: boolean }) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const { dire, vue: avis } = useAvis();
  // Ce qui a été lu et choisi reste d'une visite à l'autre, relu en arrière-plan
  const [passe, setPasse] = useState(() => repris('offres:passe', ''));
  const [groupe, setGroupe] = useState(() => repris('offres:groupe', { langue: '', metier: '' }));
  // La page se tient par sa première ligne : changer de taille la garde
  const [debut, setDebut] = useState(() => repris('offres:debut', 0));
  const [taille, setTaille] = useState(() => repris<Taille>('offres:taille', 'auto'));
  const [auto, setAuto] = useState(() => repris('offres:auto', 13));
  const [file, setFile] = useState(() => repris<ReponseFile | null>('offres:file', null));
  const [ecartees, setEcartees] = useState(() => repris<ReponseEcartees | null>('offres:ecartees', null));
  const [profils, setProfils] = useState(() => repris<ProfilDispo[]>('offres:profils', []));
  const [incomplets, setIncomplets] = useState(() => repris<Incomplets>('offres:incomplets', {}));
  useGarder('offres', { passe, groupe, debut, taille, auto, file, ecartees, profils, incomplets });
  const [ligne, setLigne] = useState<string | null>(null);
  const [tour, setTour] = useState(0);
  const defile = useRef<HTMLDivElement>(null);
  const recharger = useCallback(() => setTour((t) => t + 1), []);

  const [etat, relireEtat] = useEtatVeille(dire);
  const gestes = useGestesStock(etat, relireEtat, dire, recharger);

  // Sous un groupe, les étapes seules ; un motif imprévu a sa passe
  const groupeActif = !!(groupe.langue || groupe.metier);
  const parMotif = ecartees?.resume.par_motif ?? {};
  const passes: Passe[] = [
    ...PASSES.filter((p) => !groupeActif || !p.motif),
    ...Object.keys(file?.comptes ?? {}).filter((e) => !PASSES.some((p) => p.cle === e)).map((e) => ({ cle: e, libelle: e })),
    ...(groupeActif ? [] : Object.keys(parMotif).filter((m) => m !== MOTIF_FICHE && !PASSES.some((p) => p.motif && m.startsWith(p.motif)))
      .map((m) => ({ cle: `motif:${m}`, libelle: m, motif: m }))),
  ];
  const compte = (p: Passe): number => (p.motif
    ? Object.entries(parMotif).filter(([m]) => m.startsWith(p.motif!)).reduce((n, [, v]) => n + v, 0)
    : p.cle ? file?.comptes?.[p.cle] ?? 0 : passes.slice(1).reduce((n, q) => n + compte(q), 0));
  const choisie = passes.find((p) => p.cle === passe) ?? PASSES[0];
  const motif = choisie.motif;
  const lignes = taille === 'auto' ? Math.max(10, auto) : taille;
  const page = Math.floor(debut / lignes) + 1;
  const setPage = (n: number) => setDebut((n - 1) * lignes);

  // Deux lectures : un clic de page ne relit que la liste montrée
  const adresseFile = `/candidatures?${new URLSearchParams({ etape: motif ? '' : choisie.cle, page: String(motif ? 1 : page), taille: String(lignes), ...groupe })}`;
  const adresseEcartees = `/vues/offres/ecartees?${new URLSearchParams({ motif: motif ?? '', page: String(motif ? page : 1), taille: String(lignes) })}`;
  useEffect(() => {
    const arret = new AbortController();
    appeler<ReponseFile>(adresseFile, { signal: arret.signal }).then(setFile).catch((e) => {
      if ((e as Error).name !== 'AbortError') dire(message(e), true);
    });
    return () => arret.abort();
  }, [adresseFile, tour, dire]);
  useEffect(() => {
    const arret = new AbortController();
    appeler<ReponseEcartees>(adresseEcartees, { signal: arret.signal }).then(setEcartees).catch((e) => {
      if ((e as Error).name !== 'AbortError') dire(message(e), true);
    });
    return () => arret.abort();
  }, [adresseEcartees, tour, dire]);

  const lireProfils = useCallback(async () => {
    try {
      const [p, i] = await Promise.all([appeler<ProfilDispo[]>('/profils-candidature'), appeler<{ profils: Incomplets }>('/profils-incomplets')]);
      setProfils(p);
      setIncomplets(i.profils ?? {});
    } catch (e) {
      dire(message(e), true);
    }
  }, [dire]);
  const apresReglages = useCallback(() => {
    lireProfils();
    recharger();
  }, [lireProfils, recharger]);
  const { parametres, enregistrer } = useParametresVeille('offres', dire, apresReglages);
  useEffect(() => {
    lireProfils();
  }, [lireProfils]);

  // Une passe qui finit, un stock ou une fiche qui change : la file se relit
  const signature = etat ? `${etat.en_cours}|${etat.tri_en_cours}|${etat.stock.offres}` : '';
  const vue = useRef(signature);
  useEffect(() => {
    if (vue.current && signature && vue.current !== signature) recharger();
    vue.current = signature;
  }, [signature, recharger]);
  useEffect(() => {
    window.addEventListener(OFFRE_CHANGEE, recharger);
    return () => window.removeEventListener(OFFRE_CHANGEE, recharger);
  }, [recharger]);

  const recherche = useProfilsRecherche(parametres, profils, incomplets, enregistrer);
  const veilles = useProfilsVeille(parametres, enregistrer);
  const ajout = useAjout(profils, dire, recharger);

  const ouvrirOffre = useCallback((cle: string) => {
    setLigne(cle);
    ouvrir('fiche-offre', cle);
  }, [ouvrir]);
  const ouvrirEntreprise = useCallback((s: string, cle?: string) => {
    if (cle) setLigne(cle);
    ouvrir('fiche-entreprise', s);
  }, [ouvrir]);

  // Les questions de la fiche entreprise se posent en barre à la place des outils
  const question = useQuestionsFiche();
  const sansQuestion = () => useFicheEntreprise.setState({ question: null });

  // Échap ferme la confirmation, sinon le panneau ; celle d'une carte, seule
  const { confirmer, fermerVider } = gestes;
  useEchap((e) => {
    if ((e.target as Element | null)?.closest?.('.confirmer')) return;
    if (confirmer) fermerVider();
    else if (question) sansQuestion();
    else if (onglet) fermer();
  });

  const groupes = file?.groupes ?? {};
  const choixGroupe = (cle: 'langue' | 'metier', comptes: Record<string, number> | undefined, tous: string, nom: (v: string) => string): Choix[] =>
    [{ cle: '', libelle: tous }, ...optionsGroupe(comptes, groupe[cle], nom).map((o) => ({ cle: o.valeur, libelle: o.nom, n: o.compte }))];
  const changerGroupe = (cle: 'langue' | 'metier', v: string) => {
    setGroupe((g) => ({ ...g, [cle]: v }));
    // Un groupe choisi sur une passe d'écartées ramène à la file, seule rangée
    if (v && motif) setPasse('');
    setPage(1);
  };
  const donnees = motif ? ecartees : file;
  // La mesure attend une première lecture : la ligne d'une offre a deux étages
  useLignesAuto(defile, setAuto, `${motif}|${!!donnees}`);

  const onglets: Onglet[] = [
    { cle: 'recherche', titre: 'Recherche', label: 'Profils de recherche', corps: recherche.corps, pied: recherche.pied },
    ...(admin ? [{ cle: 'veille', titre: 'Veille', label: 'Profils de veille', admin: true, corps: veilles.corps, pied: veilles.pied }] : []),
    ...(onglet === 'ajouter' || ajout.entame ? [{ cle: 'ajouter', titre: 'Ajouter', label: 'Ajouter une offre', corps: ajout.corps, pied: ajout.pied }] : []),
  ];
  const elements = {
    'fiche-offre': (cle: string) => ongletFicheOffre(cle, { ouvrirEntreprise: (s) => ouvrirEntreprise(s) }),
    'fiche-entreprise': (s: string) => ongletFicheEntreprise(s, { ouvrirOffre }),
  };
  const ouverte = (cle: string) => cle === ligne && (onglet === 'fiche-offre' || onglet === 'fiche-entreprise');

  return (
    <>
      <Fenetre id="offres" as="div" className="tableau" aria-label="Offres" titrePrise="Glisser pour détacher les offres">
        <div className="outils">
          <MenuFiltre
            lib="Étape" courant={choisie.cle} actif={!!choisie.cle}
            valeur={choisie.cle ? `${choisie.libelle} · ${compte(choisie)}` : 'Total'}
            choix={passes.map((p) => ({ cle: p.cle, libelle: p.libelle, n: compte(p) }))}
            choisir={(c) => {
              // Rechoisir la passe active la relâche : c'est un filtre, pas un onglet
              setPasse(c === passe ? '' : c);
              setPage(1);
            }}
          />
          <MenuFiltre
            lib="Métier" courant={groupe.metier} actif={!!groupe.metier}
            valeur={groupe.metier ? `${nomMetier(groupe.metier)} · ${groupes.metiers?.[groupe.metier] ?? 0}` : 'tous'}
            choix={choixGroupe('metier', groupes.metiers, 'tous', nomMetier)} choisir={(v) => changerGroupe('metier', v)}
          />
          <MenuFiltre
            lib="Langue" courant={groupe.langue} actif={!!groupe.langue}
            valeur={groupe.langue ? `${nomLangue(groupe.langue)} · ${groupes.langues?.[groupe.langue] ?? 0}` : 'toutes'}
            choix={choixGroupe('langue', groupes.langues, 'toutes', nomLangue)} choisir={(v) => changerGroupe('langue', v)}
          />
          <span className="espace" />
          <div className="actions" role="group" aria-label="Actions">
            {admin && (
              <Action className="repli-2" icone={ICONES.tag} title={gestes.titreTri} onClick={gestes.etiquettes}><span className="txt">{gestes.libelleTri}</span><MarqueAdmin />
              </Action>
            )}
            {admin && (
              <Action className="repli-2" icone={ICONES.vider} title="Vider les offres — ADMIN" aria-haspopup="dialog" aria-expanded={confirmer} onClick={gestes.ouvrirVider}><span className="txt">Vider les offres</span><MarqueAdmin />
              </Action>
            )}
            <ActionOnglet cle="recherche" className="repli-1" icone={ICONES.recherche} title="Profils de recherche">Profils de recherche
            </ActionOnglet>
            <ActionOnglet cle="ajouter" plein iconeApres={ICONES.plus_pages} title="Ajouter une offre">
              Ajouter une offre
            </ActionOnglet>
          </div>
        </div>
        {gestes.barre ?? (question && <ConfirmerQuestion question={question} fermer={fermer} />)}
        <div className="defile" ref={defile}>
          {motif ? (
            <table className="ecartees">
              <thead><tr><th>Publiée</th><th>Motif</th><th>Entreprise</th><th>Intitulé</th><th>Lieu / contrat</th><th>Source</th><th><span className="cache">Ouvrir l&apos;offre</span></th></tr></thead>
              <tbody>
                {ecartees?.offres.map((o) => (
                  <tr key={o.cle}>
                    <td className="d">{jourMoisIso(o.publiee_le)}</td>
                    <td><span className="motif" title={o.detail || undefined}>{libelleMotif(o.motif)}</span></td>
                    <td title={o.entreprise}><b className="ent">{o.entreprise || '—'}</b></td>
                    <td title={o.titre}>{o.titre || '—'}</td>
                    <td>{[o.lieu, o.contrat].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="d">{libelleSource(o.source)}</td>
                    <td>{lienSur(o.url) ? <a className="lien-d" href={lienSur(o.url)} target="_blank" rel="noopener noreferrer" aria-label={`Voir l'offre ${o.titre}`}>voir</a> : null}</td>
                  </tr>
                ))}
                {ecartees && !ecartees.offres.length && <tr className="vide"><td colSpan={7}>Aucune offre écartée à cette passe.</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="file">
              <thead><tr><th>Publiée</th><th>Entreprise</th><th>Intitulé</th><th>Lieu / contrat</th><th>Source</th><th>Étape</th></tr></thead>
              <tbody>
                {file?.offres.map((o) => {
                  const sous = [(o.langue ?? '').toUpperCase(), (o.metiers ?? []).join(', ')].filter(Boolean).join(' · ');
                  const etape = passes.find((p) => p.cle === o.etape)?.libelle ?? o.etape;
                  return (
                    <tr
                      key={o.cle} className={ouverte(o.cle) ? 'ouverte' : undefined} {...ouvrable('fiche-offre', o.cle, () => ouvrirOffre(o.cle))}
                      aria-label={`${o.titre} chez ${o.entreprise_brute} : ouvrir la fiche de l'offre`}
                    >
                      <td className="d">{jourMoisIso(o.publiee_le)}</td>
                      <td title={o.entreprise_brute}>
                        {o.entreprise_siren ? (
                          <>
                            <button type="button" className="ent" data-ouvre="fiche-entreprise" data-objet={o.entreprise_siren} onClick={(e) => { e.stopPropagation(); ouvrirEntreprise(o.entreprise_siren!, o.cle); }}>{o.entreprise_brute || '—'}</button>
                            <button type="button" className="sous lien-fiche" data-ouvre="fiche-entreprise" data-objet={o.entreprise_siren} onClick={(e) => { e.stopPropagation(); ouvrirEntreprise(o.entreprise_siren!, o.cle); }}>voir la fiche</button>
                          </>
                        ) : (
                          <><b className="ent">{o.entreprise_brute || '—'}</b><span className="sous" title={RAISONS[o.rattachement]?.[1]}>{RAISONS[o.rattachement]?.[0] ?? o.rattachement}</span></>
                        )}
                      </td>
                      <td title={o.titre}>{o.titre || '—'}{sous && <span className="sous">{sous}</span>}</td>
                      <td>{[o.lieu, o.contrat].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="d">{libelleSource(o.source)}</td>
                      <td><span className={`eo ${CLASSE_ETAPE[o.etape] ?? ''}`} title={o.raison || undefined}>{etape}</span></td>
                    </tr>
                  );
                })}
                {file && !file.offres.length && (
                  <tr className="vide"><td colSpan={6}>{choisie.cle ? 'Aucune offre à cette passe.' : 'Aucune offre : démarrez la veille pour en ramener.'}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <PaginationAller page={page} pages={donnees?.pages ?? 1} setPage={setPage} taille={taille} tailles={[25, 50]} setTaille={(t) => setTaille(t as Taille)} auto={Math.max(10, auto)} />
        {avis}
      </Fenetre>
      <Panneau elements={elements} onglets={onglets} />
    </>
  );
}

// Profils de recherche : une carte par profil de recherche.
type CarteRecherche = { id: number; enregistre: boolean; nom: string; actif: boolean; langue: string; mots_cles: string; mots_bannis: string; departements: string; profils_candidature: string[] };
let numero = 0;
const carteRecherche = (p: Partial<ProfilRecherche>, enregistre: boolean): CarteRecherche => ({
  id: ++numero, enregistre, nom: p.nom ?? '', actif: p.actif !== false, langue: p.langue || 'fr', mots_cles: (p.mots_cles ?? []).join(', '),
  mots_bannis: (p.mots_bannis ?? []).join(', '), departements: (p.departements ?? []).join(', '), profils_candidature: p.profils_candidature ?? [],
});
const lireRecherche = (c: CarteRecherche): ProfilRecherche => ({
  nom: c.nom.trim(), actif: c.actif, langue: c.langue, mots_cles: parVirgules(c.mots_cles), mots_bannis: parVirgules(c.mots_bannis),
  departements: parVirgules(c.departements), profils_candidature: c.profils_candidature,
});
const versProfil = (nom?: string) => `profil?${nom ? `fiche=${encodeURIComponent(nom)}` : 'nouveau=1'}`;

function useProfilsRecherche(parametres: Parametres | null, profils: ProfilDispo[], incomplets: Incomplets, enregistrer: (m: Partial<Parametres>) => Promise<boolean>) {
  const editeur = useCartes({ source: parametres?.profils_recherche, carte: carteRecherche, lire: lireRecherche, sauver: (lus) => enregistrer({ profils_recherche: lus.filter((p) => p.nom) }) });
  const { cartes, setCartes, reprendre, change, modifier, sauver } = editeur;
  const [choix, setChoix] = useState<Record<number, string>>({});

  const corps = (
    <div className="cartes" onKeyDown={surEntree(() => change && sauver(), 'input:not([type=checkbox])')}>
      {cartes.map((c) => {
        const fautifs = c.profils_candidature.filter((ch) => incomplets[nomFichier(ch)]);
        const attaches = new Set(c.profils_candidature.map(nomFichier));
        const libres = profils.filter((p) => !attaches.has(p.nom));
        return (
          <article key={c.id} className={`carte-f${fautifs.length ? ' alerte' : ''}`} aria-label={`Profil de recherche ${c.nom || 'nouveau'}`}>
            {fautifs.map((ch) => {
              const manque = incomplets[nomFichier(ch)];
              return (
                <p key={ch} className="alerte-f">
                  ⚠ « {sansJson(nomFichier(ch))} » ne peut pas candidater : {manque.length} champ(s) obligatoire(s) vide(s) ({manque.map((m) => m.libelle).join(', ')}). Ses offres attendent.{' '}
                  <LienIllusion className="lien-d" vers={versProfil(nomFichier(ch))}>Compléter</LienIllusion>
                </p>
              );
            })}
            <ChampSaisie id={`pr${c.id}-nom`} libelle="Nom" value={c.nom} onChange={(e) => modifier(c.id, { nom: e.target.value })} />
            <div className="grille-2">
              <Champ pour={`pr${c.id}-langue`} libelle="Langue"><ChoixLangue id={`pr${c.id}-langue`} valeur={c.langue} changer={(langue) => modifier(c.id, { langue })} /></Champ>
              <ChampSaisie id={`pr${c.id}-dep`} titre="Vide : ceux du ciblage général." libelle="Départements" value={c.departements} onChange={(e) => modifier(c.id, { departements: e.target.value })} />
            </div>
            <ChampZone id={`pr${c.id}-int`} libelle="Intitulés cherchés" value={c.mots_cles} onChange={(e) => modifier(c.id, { mots_cles: e.target.value })} />
            <ChampSaisie id={`pr${c.id}-ban`} libelle="Termes bannis" value={c.mots_bannis} onChange={(e) => modifier(c.id, { mots_bannis: e.target.value })} />
            <Champ groupe libelle="Profils de candidature">
              <span className="puces">
                {c.profils_candidature.map((ch) => {
                  const nom = nomFichier(ch);
                  const manque = incomplets[nom];
                  return (
                    <span key={ch} className={`puce${manque ? ' incomplet' : ''}`} title={manque ? `Non exploitable : ${manque.map((m) => m.libelle).join(', ')}` : ch}>
                      <LienIllusion vers={versProfil(nom)} className="puce-lien">{manque ? '⚠ ' : ''}{sansJson(nom)}</LienIllusion>
                      <button type="button" aria-label={`Retirer ${sansJson(nom)}`} onClick={() => modifier(c.id, { profils_candidature: c.profils_candidature.filter((x) => x !== ch) })}>×</button>
                    </span>
                  );
                })}
                <LienIllusion vers={versProfil()} className="puce ajout" title="Ouvre un profil vierge sur la page Profil.">+ Nouveau profil</LienIllusion>
              </span>
              <span className="attacher">
                <select className="saisie" aria-label="Profil à attacher" value={choix[c.id] ?? ''} onChange={(e) => setChoix((x) => ({ ...x, [c.id]: e.target.value }))}>
                  <option value="">— choisir un profil —</option>
                  {libres.map((p) => <option key={p.nom} value={p.chemin}>{sansJson(p.nom)}</option>)}
                </select>
                <button type="button" className="lien-d" disabled={!choix[c.id]} onClick={() => {
                  modifier(c.id, { profils_candidature: [...c.profils_candidature, choix[c.id]] });
                  setChoix((x) => ({ ...x, [c.id]: '' }));
                }}>Attacher</button>
              </span>
            </Champ>
            <RetraitCarte cartes={editeur} id={c.id} enregistree={c.enregistre} question="Retirer ce profil de recherche ?"
              titre={`${c.nom || 'Ce profil'} et les profils de candidature qui lui sont attachés ne seront plus interrogés par la veille.`}>
              <Interrupteur libelle="Actif" checked={c.actif} onChange={(e) => modifier(c.id, { actif: e.target.checked })} />
            </RetraitCarte>
          </article>
        );
      })}
      {!cartes.length && <p className="texte-f">Aucun profil de recherche : sans profil actif, la veille ne sait pas quoi chercher.</p>}
    </div>
  );
  const pied = <PiedCartes libelle="Nouveau profil de recherche" ajouter={() => setCartes((cs) => [...cs, carteRecherche({ actif: true }, false)])} change={change} reprendre={reprendre} sauver={sauver} />;
  return { corps, pied };
}

// Ajouter une offre à la file : le lien suffit, le reste est facultatif
function useAjout(profils: ProfilDispo[], dire: Dire, recharger: () => void) {
  const vide = { url: '', entreprise: '', titre: '', profil: '' };
  const [saisie, setSaisie] = useState(vide);
  const [cv, setCv] = useState<File | null>(null);
  const [cle, setCle] = useState(0);
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const entame = Object.values(saisie).some(Boolean) || !!cv;
  const vider = () => {
    setSaisie(vide);
    setCv(null);
    setCle((k) => k + 1);
  };
  const ajouter = () => {
    if (!urlOffreValide(saisie.url)) {
      dire("Indiquez l'URL de l'offre — c'est tout ce qu'il faut pour la mettre en file.", true);
      return;
    }
    return geste(async () => {
      dire(...avisAjout(await posterOffre(saisie, cv), 'Cette offre était déjà en base — elle est rendue à la file.'));
      vider();
      recharger();
    });
  };
  const champ = (c: keyof typeof vide) => ({ value: saisie[c], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSaisie((s) => ({ ...s, [c]: e.target.value })) });
  const corps = (
    <div className="section-f" onKeyDown={surEntree(ajouter, 'input')}>
      <ChampSaisie id="ao-url" libelle="URL de l&apos;offre" type="url" placeholder="https://…/offre/12345" required {...champ('url')} />
      <div className="grille-2">
        <ChampSaisie id="ao-ent" libelle="Entreprise" placeholder="Exemple SA" {...champ('entreprise')} />
        <ChampSaisie id="ao-titre" libelle="Intitulé" {...champ('titre')} />
      </div>
      <ChampListe id="ao-profil" libelle="Profil du candidat" {...champ('profil')}>
          <option value="">Automatique</option>
          {profils.map((p) => <option key={p.nom} value={p.chemin}>{sansJson(p.nom)}</option>)}
        </ChampListe>
      <Champ pour="ao-cv" libelle="CV imposé">
        <input key={cle} id="ao-cv" className="saisie fichier" type="file" accept=".pdf,application/pdf" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
      </Champ>
      <p className="aide-champ">L&apos;adresse entre dans la file, avec le profil et le CV saisis s&apos;il y en a. Rien ne part maintenant ; l&apos;employeur et l&apos;intitulé sont relus sur l&apos;annonce.</p>
    </div>
  );
  const pied = (
    <>
      <Action disabled={!entame} onClick={vider}>Annuler</Action>
      <Action plein iconeApres={ICONES.plus_pages} disabled={occupe} onClick={ajouter}>Ajouter à la file</Action>
    </>
  );
  return { corps, pied, entame };
}
