'use client';

import './offres.css';
import { LienIllusion } from '../../partage/LienIllusion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appeler, televerser } from '../../api';
import { Activite } from '../../activite/Activite';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, MarqueAdmin, Panneau, type Onglet } from '../../dock/Panneau';
import { ongletFicheEntreprise, useFicheEntreprise, useQuestionsFiche } from '../../partage/FicheEntreprise';
import { OFFRE_CHANGEE, ongletFicheOffre } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import {
  ChoixLangue, ICONES, LANGUES, MenuFiltre, Pagination, enregistrerReglages, jourMois, libelleSource, liste, message, nomFiche,
  sansJson, useAvis, useEtatVeille, useGestesStock, useProfilsVeille,
  type Choix, type Parametres, type ProfilRecherche, type Taille,
} from './commun';

type OffreFile = {
  cle: string; entreprise_brute: string; entreprise_siren: string | null; titre: string; lieu: string; contrat: string; source: string;
  publiee_le: string; etape: string; langue: string; metiers: string[]; rattachement: string; raison: string;
};
type ReponseFile = { comptes: Record<string, number>; groupes: { langues?: Record<string, number>; metiers?: Record<string, number> }; offres: OffreFile[]; pages: number; total_filtre: number };
type Ecartee = { cle: string; motif: string; detail: string; source: string; titre: string; entreprise: string; lieu: string; contrat: string; publiee_le: string; url: string };
type ReponseEcartees = { resume: { par_motif: Record<string, number> }; offres: Ecartee[]; pages: number; total_filtre: number };
type ProfilDispo = { nom: string; chemin: string };
type Incomplets = Record<string, { cle: string; libelle: string }[]>;

// Les passes, dans l'ordre où une offre les traverse ; une passe à motif filtre les écartées, une autre la file
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
// Motif en double de l'étape « Inadaptée » : l'offre reste en base, la compter deux fois gonflait le total
const MOTIF_FICHE = 'Hors-Profil';
const CLASSE_ETAPE: Record<string, string> = { ENVOYEE: 'env', A_LA_MAIN: 'main', ECHEC: 'ech', ECARTEE: 'eca' };
// Pourquoi une offre n'a pas de fiche : le mot sous l'entreprise, la phrase en infobulle
const RAISONS: Record<string, [string, string]> = {
  rattachee: ['rattachée', 'rattachée à une fiche'], creee: ['fiche créée', "fiche créée depuis l'offre"],
  inconnue: ['introuvable', 'employeur introuvable dans Sirene'],
  a_identifier: ['à identifier', "employeur pas encore recherché (il l'est après l'envoi)"],
  intermediaire: ['intermédiaire', 'pas un employeur (cabinet, jobboard, mention générique)'],
  hors_cible: ['hors cible', 'hors cible (effectif, statut)'],
};
const PREFIXE_BANNI = 'terme banni : ';
const libelleMotif = (m: string) => (m.startsWith(PREFIXE_BANNI) ? `terme banni « ${m.slice(PREFIXE_BANNI.length)} »` : m);
const lienSur = (url: string) => (/^https?:\/\//i.test(url ?? '') ? url : undefined);

export default function PageOffres({ compte }: ProprietesPage) {
  return (
    <Dock id="offres" principal="offres" panneau={compte.admin ? 'veille' : 'recherche'}>
      <Activite />
      <Offres admin={compte.admin} />
    </Dock>
  );
}

function Offres({ admin }: { admin: boolean }) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const { dire, vue: avis } = useAvis();
  const [passe, setPasse] = useState('');
  const [groupe, setGroupe] = useState({ langue: '', metier: '' });
  // La page se tient par sa première ligne : une autre taille de page la garde affichée, d'une seule lecture
  const [debut, setDebut] = useState(0);
  const [taille, setTaille] = useState<Taille>('auto');
  const [auto, setAuto] = useState(13);
  const [file, setFile] = useState<ReponseFile | null>(null);
  const [ecartees, setEcartees] = useState<ReponseEcartees | null>(null);
  const [parametres, setParametres] = useState<Parametres | null>(null);
  const [profils, setProfils] = useState<ProfilDispo[]>([]);
  const [incomplets, setIncomplets] = useState<Incomplets>({});
  const [cleOffre, setCleOffre] = useState<string | null>(null);
  const [siren, setSiren] = useState<string | null>(null);
  const [ligne, setLigne] = useState<string | null>(null);
  const [tour, setTour] = useState(0);
  const defile = useRef<HTMLDivElement>(null);
  const recharger = useCallback(() => setTour((t) => t + 1), []);

  const [etat, relireEtat] = useEtatVeille(dire);
  const gestes = useGestesStock(etat, relireEtat, dire, recharger);

  // Sous un groupe, les étapes seules : une écartée n'a ni langue ni métier ; une étape ou un motif imprévus ont leur passe
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

  // La file et les écartées d'un coup : l'une se montre, l'autre donne ses comptes à la barre des passes
  useEffect(() => {
    const arret = new AbortController();
    const filtre = new URLSearchParams({ etape: motif ? '' : choisie.cle, page: String(motif ? 1 : page), taille: String(lignes), ...groupe });
    const ecart = new URLSearchParams({ motif: motif ?? '', page: String(motif ? page : 1), taille: String(lignes) });
    Promise.all([
      appeler<ReponseFile>(`/candidatures?${filtre}`, { signal: arret.signal }),
      appeler<ReponseEcartees>(`/vues/offres/ecartees?${ecart}`, { signal: arret.signal }),
    ]).then(([f, e]) => {
      setFile(f);
      setEcartees(e);
    }).catch((e) => {
      if ((e as Error).name !== 'AbortError') dire(message(e), true);
    });
    return () => arret.abort();
  }, [choisie.cle, motif, page, lignes, groupe, tour, dire]);

  const lireProfils = useCallback(async () => {
    try {
      const [p, i] = await Promise.all([appeler<ProfilDispo[]>('/profils-candidature'), appeler<{ profils: Incomplets }>('/profils-incomplets')]);
      setProfils(p);
      setIncomplets(i.profils ?? {});
    } catch (e) {
      dire(message(e), true);
    }
  }, [dire]);
  useEffect(() => {
    appeler<Parametres>('/parametres').then(setParametres, (e) => dire(message(e), true));
    lireProfils();
  }, [dire, lireProfils]);

  // Une passe qui finit, un stock qui change ou une offre changée dans sa fiche : la file se relit
  const signature = etat ? `${etat.en_cours}|${etat.stock.offres}` : '';
  const vue = useRef(signature);
  useEffect(() => {
    if (vue.current && signature && vue.current !== signature) recharger();
    vue.current = signature;
  }, [signature, recharger]);
  useEffect(() => {
    window.addEventListener(OFFRE_CHANGEE, recharger);
    return () => window.removeEventListener(OFFRE_CHANGEE, recharger);
  }, [recharger]);

  // « auto » : autant de lignes que la hauteur du tableau en tient ; une ligne d'offre a deux étages
  useLayoutEffect(() => {
    const el = defile.current;
    if (!el) return;
    let minuteur = 0;
    const mesurer = () => {
      const bas = window.innerHeight <= 780;
      const hauteur = motif ? (bas ? 30 : 36) : bas ? 40 : 44;
      setAuto(Math.max(1, Math.floor((el.clientHeight - (bas ? 30 : 34)) / hauteur)));
    };
    mesurer();
    const suivi = new ResizeObserver(() => {
      window.clearTimeout(minuteur);
      minuteur = window.setTimeout(mesurer, 250);
    });
    suivi.observe(el);
    return () => {
      suivi.disconnect();
      window.clearTimeout(minuteur);
    };
  }, [motif]);

  const enregistrer = useCallback(async (modifs: Partial<Parametres>) => {
    const r = await enregistrerReglages(modifs, dire);
    if (!r) return false;
    setParametres(r);
    lireProfils();
    recharger();
    return true;
  }, [dire, lireProfils, recharger]);
  const recherche = useProfilsRecherche(parametres, profils, incomplets, enregistrer);
  const veilles = useProfilsVeille(parametres, enregistrer);
  const ajout = useAjout(profils, dire, recharger);

  const ouvrirOffre = useCallback((cle: string) => {
    setCleOffre(cle);
    setLigne(cle);
    ouvrir('fiche-offre');
  }, [ouvrir]);
  const ouvrirEntreprise = useCallback((s: string, cle?: string) => {
    setSiren(s);
    if (cle) setLigne(cle);
    ouvrir('fiche-entreprise');
  }, [ouvrir]);

  // Les questions de la fiche entreprise (supprimer, remettre à zéro…) se posent en barre à la place des outils
  const question = useQuestionsFiche();
  const [occupe, setOccupe] = useState(false);
  const sansQuestion = () => useFicheEntreprise.setState({ question: null });

  // Échap ferme la confirmation, sinon le panneau ; celle d'une carte se ferme seule
  const { confirmer, fermerVider } = gestes;
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || (e.target as Element | null)?.closest?.('.confirmer')) return;
      if (confirmer) fermerVider();
      else if (question) useFicheEntreprise.setState({ question: null });
      else if (onglet) fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [confirmer, fermerVider, question, onglet, fermer]);

  const groupes = file?.groupes ?? {};
  const choixGroupe = (cle: 'langue' | 'metier', comptes: Record<string, number> = {}, tous: string, nom: (v: string) => string): Choix[] => {
    const valeurs = { ...comptes, ...(groupe[cle] && !(groupe[cle] in comptes) ? { [groupe[cle]]: 0 } : {}) };
    return [{ cle: '', libelle: tous }, ...Object.entries(valeurs)
      .sort(([a], [b]) => Number(a === '-') - Number(b === '-') || a.localeCompare(b, 'fr'))
      .map(([v, n]) => ({ cle: v, libelle: nom(v), n }))];
  };
  const nomLangue = (v: string) => (v === '-' ? 'sans langue' : LANGUES[v] ?? v);
  const nomMetier = (v: string) => (v === '-' ? 'sans métier' : v);
  const changerGroupe = (cle: 'langue' | 'metier', v: string) => {
    setGroupe((g) => ({ ...g, [cle]: v }));
    // Un groupe choisi sur une passe d'écartées ramène à la file : elle seule se range par langue et par métier
    if (v && motif) setPasse('');
    setPage(1);
  };
  const donnees = motif ? ecartees : file;

  const onglets: Onglet[] = [
    { cle: 'recherche', titre: 'Recherche', label: 'Profils de recherche', corps: recherche.corps, pied: recherche.pied },
    ...(admin ? [{ cle: 'veille', titre: 'Veille', label: 'Profils de veille', admin: true, corps: veilles.corps, pied: veilles.pied }] : []),
    ...(cleOffre ? [ongletFicheOffre(cleOffre, { ouvrirEntreprise: (s) => ouvrirEntreprise(s) })] : []),
    ...(siren ? [ongletFicheEntreprise(siren, { ouvrirOffre })] : []),
    ...(onglet === 'ajouter' || ajout.entame ? [{ cle: 'ajouter', titre: 'Ajouter', label: 'Ajouter une offre', corps: ajout.corps, pied: ajout.pied }] : []),
  ];
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
              <button type="button" className="action repli-2" title={gestes.titreTri} onClick={gestes.etiquettes}>
                <span className="ico">{ICONES.etiquettes}</span><span className="txt">{gestes.libelleTri}</span><MarqueAdmin />
              </button>
            )}
            {admin && (
              <button type="button" className="action repli-2" title="Vider les offres — ADMIN" aria-haspopup="dialog" aria-expanded={confirmer} onClick={gestes.ouvrirVider}>
                <span className="ico">{ICONES.vider}</span><span className="txt">Vider les offres</span><MarqueAdmin />
              </button>
            )}
            <button type="button" className={`action repli-1${onglet === 'recherche' ? ' allume' : ''}`} title="Profils de recherche" aria-haspopup="dialog" aria-expanded={onglet === 'recherche'} onClick={() => ouvrir('recherche')}>
              <span className="ico">{ICONES.recherche}</span><span className="txt">Profils de recherche</span>
            </button>
            <button type="button" className={`action plein${onglet === 'ajouter' ? ' allume' : ''}`} title="Ajouter une offre" aria-haspopup="dialog" aria-expanded={onglet === 'ajouter'} onClick={() => ouvrir('ajouter')}>
              <span className="txt">Ajouter une offre</span><span className="ico">{ICONES.plus}</span>
            </button>
          </div>
        </div>
        {gestes.barre ?? (question && (
          <Confirmer
            question={question.question} detail={question.detail} action={question.action} occupe={occupe} onAnnuler={sansQuestion}
            onConfirmer={async () => {
              setOccupe(true);
              await question.faire(fermer);
              setOccupe(false);
              sansQuestion();
            }}
          />
        ))}
        <div className="defile" ref={defile}>
          {motif ? (
            <table className="ecartees">
              <thead><tr><th>Publiée</th><th>Motif</th><th>Entreprise</th><th>Intitulé</th><th>Lieu / contrat</th><th>Source</th><th><span className="cache">Ouvrir l&apos;offre</span></th></tr></thead>
              <tbody>
                {ecartees?.offres.map((o) => (
                  <tr key={o.cle}>
                    <td className="d">{jourMois(o.publiee_le)}</td>
                    <td><span className="motif" title={o.detail || undefined}>{libelleMotif(o.motif)}</span></td>
                    <td title={o.entreprise}><b className="ent">{o.entreprise || '—'}</b></td>
                    <td title={o.titre}>{o.titre || '—'}</td>
                    <td>{[o.lieu, o.contrat].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="d">{libelleSource(o.source) || '—'}</td>
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
                      key={o.cle} className={ouverte(o.cle) ? 'ouverte' : undefined} tabIndex={0}
                      aria-label={`${o.titre} chez ${o.entreprise_brute} : ouvrir la fiche de l'offre`}
                      onClick={() => ouvrirOffre(o.cle)}
                      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && ouvrirOffre(o.cle)}
                    >
                      <td className="d">{jourMois(o.publiee_le)}</td>
                      <td title={o.entreprise_brute}>
                        {o.entreprise_siren ? (
                          <>
                            <button type="button" className="ent" onClick={(e) => { e.stopPropagation(); ouvrirEntreprise(o.entreprise_siren!, o.cle); }}>{o.entreprise_brute || '—'}</button>
                            <button type="button" className="sous lien-fiche" onClick={(e) => { e.stopPropagation(); ouvrirEntreprise(o.entreprise_siren!, o.cle); }}>voir la fiche</button>
                          </>
                        ) : (
                          <><b className="ent">{o.entreprise_brute || '—'}</b><span className="sous" title={RAISONS[o.rattachement]?.[1]}>{RAISONS[o.rattachement]?.[0] ?? o.rattachement}</span></>
                        )}
                      </td>
                      <td title={o.titre}>{o.titre || '—'}{sous && <span className="sous">{sous}</span>}</td>
                      <td>{[o.lieu, o.contrat].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="d">{libelleSource(o.source) || '—'}</td>
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
        <Pagination page={page} pages={donnees?.pages ?? 1} taille={taille} auto={Math.max(10, auto)} surPage={setPage} surTaille={setTaille} />
        {avis}
      </Fenetre>
      <Panneau onglets={onglets} />
    </>
  );
}

// Profils de recherche : une carte par profil ; la fiche d'un profil de candidature se complète sur la page Profil
type CarteRecherche = { id: number; enregistre: boolean; nom: string; actif: boolean; langue: string; mots_cles: string; mots_bannis: string; departements: string; profils_candidature: string[] };
let numero = 0;
const carteRecherche = (p: Partial<ProfilRecherche>, enregistre: boolean): CarteRecherche => ({
  id: ++numero, enregistre, nom: p.nom ?? '', actif: p.actif !== false, langue: p.langue || 'fr', mots_cles: (p.mots_cles ?? []).join(', '),
  mots_bannis: (p.mots_bannis ?? []).join(', '), departements: (p.departements ?? []).join(', '), profils_candidature: p.profils_candidature ?? [],
});
const lireRecherche = (c: CarteRecherche): ProfilRecherche => ({
  nom: c.nom.trim(), actif: c.actif, langue: c.langue, mots_cles: liste(c.mots_cles), mots_bannis: liste(c.mots_bannis),
  departements: liste(c.departements), profils_candidature: c.profils_candidature,
});
const versProfil = (nom?: string) => `profil?${nom ? `fiche=${encodeURIComponent(nom)}` : 'nouveau=1'}`;

function useProfilsRecherche(parametres: Parametres | null, profils: ProfilDispo[], incomplets: Incomplets, enregistrer: (m: Partial<Parametres>) => Promise<boolean>) {
  const [cartes, setCartes] = useState<CarteRecherche[]>([]);
  const [retrait, setRetrait] = useState<number | null>(null);
  const [choix, setChoix] = useState<Record<number, string>>({});
  const reprendre = useCallback(() => setCartes((parametres?.profils_recherche ?? []).map((p) => carteRecherche(p, true))), [parametres]);
  useEffect(() => reprendre(), [reprendre]);
  const enregistres = JSON.stringify((parametres?.profils_recherche ?? []).map((p) => lireRecherche(carteRecherche(p, true))));
  const change = JSON.stringify(cartes.map(lireRecherche)) !== enregistres;
  const modifier = (id: number, champs: Partial<CarteRecherche>) => setCartes((cs) => cs.map((c) => (c.id === id ? { ...c, ...champs } : c)));
  const sauver = async () => {
    if (await enregistrer({ profils_recherche: cartes.map(lireRecherche).filter((p) => p.nom) })) setRetrait(null);
  };

  const corps = (
    <div className="cartes" onKeyDown={(e) => {
      if (e.key === 'Enter' && (e.target as HTMLElement).matches('input:not([type=checkbox])') && change) sauver();
    }}>
      {cartes.map((c) => {
        const fautifs = c.profils_candidature.filter((ch) => incomplets[nomFiche(ch)]);
        const attaches = new Set(c.profils_candidature.map(nomFiche));
        const libres = profils.filter((p) => !attaches.has(p.nom));
        return (
          <article key={c.id} className={`carte-f${fautifs.length ? ' alerte' : ''}`} aria-label={`Profil de recherche ${c.nom || 'nouveau'}`}>
            {fautifs.map((ch) => {
              const manque = incomplets[nomFiche(ch)];
              return (
                <p key={ch} className="alerte-f">
                  ⚠ « {sansJson(nomFiche(ch))} » ne peut pas candidater : {manque.length} champ(s) obligatoire(s) vide(s) ({manque.map((m) => m.libelle).join(', ')}). Ses offres attendent.{' '}
                  <LienIllusion className="lien-d" vers={versProfil(nomFiche(ch))}>Compléter</LienIllusion>
                </p>
              );
            })}
            <div className="champ"><label htmlFor={`pr${c.id}-nom`}>Nom</label><input id={`pr${c.id}-nom`} className="saisie" value={c.nom} onChange={(e) => modifier(c.id, { nom: e.target.value })} /></div>
            <div className="grille-2">
              <div className="champ"><label htmlFor={`pr${c.id}-langue`}>Langue</label><ChoixLangue id={`pr${c.id}-langue`} valeur={c.langue} changer={(langue) => modifier(c.id, { langue })} /></div>
              <div className="champ"><label htmlFor={`pr${c.id}-dep`} title="Vide : ceux du ciblage général.">Départements</label><input id={`pr${c.id}-dep`} className="saisie" value={c.departements} onChange={(e) => modifier(c.id, { departements: e.target.value })} /></div>
            </div>
            <div className="champ"><label htmlFor={`pr${c.id}-int`}>Intitulés cherchés</label><textarea id={`pr${c.id}-int`} className="saisie" value={c.mots_cles} onChange={(e) => modifier(c.id, { mots_cles: e.target.value })} /></div>
            <div className="champ"><label htmlFor={`pr${c.id}-ban`}>Termes bannis</label><input id={`pr${c.id}-ban`} className="saisie" value={c.mots_bannis} onChange={(e) => modifier(c.id, { mots_bannis: e.target.value })} /></div>
            <div className="champ">
              <span className="lib-champ">Profils de candidature</span>
              <span className="puces">
                {c.profils_candidature.map((ch) => {
                  const nom = nomFiche(ch);
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
            </div>
            {retrait === c.id ? (
              <Confirmer
                question="Retirer ce profil de recherche ?" action="Retirer" detail="Effet à l'enregistrement."
                onAnnuler={() => setRetrait(null)}
                onConfirmer={() => {
                  setCartes((cs) => cs.filter((x) => x.id !== c.id));
                  setRetrait(null);
                }}
              />
            ) : (
              <div className="carte-pied">
                <button type="button" className="lien-d" title={c.enregistre ? `${c.nom || 'Ce profil'} et les profils de candidature qui lui sont attachés ne seront plus interrogés par la veille.` : undefined}
                  onClick={() => (c.enregistre ? setRetrait(c.id) : setCartes((cs) => cs.filter((x) => x.id !== c.id)))}>Retirer</button>
                <label className="inter">Actif<input type="checkbox" checked={c.actif} onChange={(e) => modifier(c.id, { actif: e.target.checked })} /></label>
              </div>
            )}
          </article>
        );
      })}
      {!cartes.length && <p className="texte-f">Aucun profil de recherche : sans profil actif, la veille ne sait pas quoi chercher.</p>}
    </div>
  );
  const pied = (
    <>
      <button type="button" className="action gauche" onClick={() => setCartes((cs) => [...cs, carteRecherche({ actif: true }, false)])}><span className="ico">{ICONES.plus}</span>Nouveau profil de recherche</button>
      <button type="button" className="action" disabled={!change} onClick={reprendre}>Annuler</button>
      <button type="button" className="action plein" disabled={!change} onClick={sauver}>Enregistrer<span className="ico">{ICONES.fleche}</span></button>
    </>
  );
  return { corps, pied };
}

// Ajouter une offre à la file : le lien suffit ; l'employeur, l'intitulé, le profil et un CV imposé sont facultatifs
function useAjout(profils: ProfilDispo[], dire: (t: string, e?: boolean) => void, recharger: () => void) {
  const vide = { url: '', entreprise: '', titre: '', profil: '' };
  const [saisie, setSaisie] = useState(vide);
  const [cv, setCv] = useState<File | null>(null);
  const [cle, setCle] = useState(0);
  const [occupe, setOccupe] = useState(false);
  const entame = Object.values(saisie).some(Boolean) || !!cv;
  const vider = () => {
    setSaisie(vide);
    setCv(null);
    setCle((k) => k + 1);
  };
  const ajouter = async () => {
    if (!/^https?:\/\/\S+$/i.test(saisie.url.trim())) {
      dire("Indiquez l'URL de l'offre — c'est tout ce qu'il faut pour la mettre en file.", true);
      return;
    }
    setOccupe(true);
    try {
      const r = await appeler<{ neuve: boolean; entreprise_siren: string | null }>('/offres', {
        methode: 'POST', corps: { ...saisie, url: saisie.url.trim(), ...(cv ? { cv: await televerser(cv) } : {}) },
      });
      dire(r.neuve ? `Offre ajoutée à la file${r.entreprise_siren ? ' et rattachée à sa fiche' : ''}.` : 'Cette offre était déjà en base — elle est rendue à la file.', !r.neuve);
      vider();
      recharger();
    } catch (e) {
      dire(message(e), true);
    }
    setOccupe(false);
  };
  const champ = (c: keyof typeof vide) => ({ value: saisie[c], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSaisie((s) => ({ ...s, [c]: e.target.value })) });
  const corps = (
    <div className="section-f" onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).matches('input') && ajouter()}>
      <div className="champ"><label htmlFor="ao-url">URL de l&apos;offre</label><input id="ao-url" className="saisie" type="url" placeholder="https://…/offre/12345" required {...champ('url')} /></div>
      <div className="grille-2">
        <div className="champ"><label htmlFor="ao-ent">Entreprise</label><input id="ao-ent" className="saisie" placeholder="Exemple SA" {...champ('entreprise')} /></div>
        <div className="champ"><label htmlFor="ao-titre">Intitulé</label><input id="ao-titre" className="saisie" {...champ('titre')} /></div>
      </div>
      <div className="champ">
        <label htmlFor="ao-profil">Profil du candidat</label>
        <select id="ao-profil" className="saisie" {...champ('profil')}>
          <option value="">Automatique</option>
          {profils.map((p) => <option key={p.nom} value={p.chemin}>{sansJson(p.nom)}</option>)}
        </select>
      </div>
      <div className="champ">
        <label htmlFor="ao-cv">CV imposé</label>
        <input key={cle} id="ao-cv" className="saisie fichier" type="file" accept=".pdf,application/pdf" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
      </div>
      <p className="aide-champ">L&apos;adresse entre dans la file, avec le profil et le CV saisis s&apos;il y en a. Rien ne part maintenant ; l&apos;employeur et l&apos;intitulé sont relus sur l&apos;annonce.</p>
    </div>
  );
  const pied = (
    <>
      <button type="button" className="action" disabled={!entame} onClick={vider}>Annuler</button>
      <button type="button" className="action plein" disabled={occupe} onClick={ajouter}>Ajouter à la file<span className="ico">{ICONES.plus}</span></button>
    </>
  );
  return { corps, pied, entame };
}
