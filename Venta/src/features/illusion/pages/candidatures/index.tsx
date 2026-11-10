'use client';

import './candidatures.css';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useUIStore } from '@/lib/uiStore';
import { appeler } from '../../api';
import { Activite } from '../../activite/Activite';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, MarqueAdmin, Panneau } from '../../dock/Panneau';
import { ongletFicheEntreprise } from '../../partage/FicheEntreprise';
import { ETAPES, OFFRE_CHANGEE, ongletAjoutCompetence, ongletFicheOffre, type DemandeAjout } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import { ongletProfilIncomplet, useOngletAjout, useOngletDirect, useOngletReglages, type Incomplet } from './panneaux';
import { PaginationAller, useEchap, useFileServeur, useGeste, useLignesAuto, type FileServeur } from '../commun';
import { useCoches } from '../../elements/Case';
import { MenuTenu, choixDe } from '../../elements/Menu';
import { Action } from '../../elements/Action';
import { Case } from '../../elements/Case';
import { ICONES } from '../../elements/icones';
import { ouvrable } from '../../elements/Case';
import { ActionSupprimer } from '../../elements/Action';
import { useAvis, type Dire } from '../../elements/Avis';
import { ActionOnglet } from '../../elements/Groupes';
import { dateUtc, jourMoisIso, libelleSource, nomLangue, nomMetier, nomProfil, optionsGroupe } from '../../elements/format';

// Une ligne de la file telle que /candidatures la rend
type OffreFile = {
  cle: string; entreprise_brute: string; entreprise_siren: string | null; titre: string; lieu: string; contrat: string; source: string;
  publiee_le: string; etape: string; raison: string; profil_cv: string; cv_auto: boolean; postule_le: string;
};
type EtatFile = {
  statistiques: { total: number }; page: number; taille: number; total_filtre: number; pages: number; total: number;
  comptes: Record<string, number>; groupes: { langues: Record<string, number>; metiers: Record<string, number> }; offres: OffreFile[];
};
type Filtres = { etape: string; metier: string; langue: string };
const TAILLES = [25, 50, 100];



// Une seule minuterie pour tous les chronos, lancée tant qu'il y en a un
const abonnesHorloge = new Set<() => void>();
let minuteurHorloge: ReturnType<typeof setInterval>;
const abonnerHorloge = (f: () => void) => {
  if (!abonnesHorloge.size) minuteurHorloge = setInterval(() => document.visibilityState === 'visible' && abonnesHorloge.forEach((a) => a()), 1000);
  abonnesHorloge.add(f);
  return () => {
    abonnesHorloge.delete(f);
    if (!abonnesHorloge.size) clearInterval(minuteurHorloge);
  };
};
const lireSeconde = () => Math.floor(Date.now() / 1000);

// « 6:04:47:12 » : jours, heures, minutes, secondes depuis l'envoi
function Chrono({ iso }: { iso: string }) {
  const seconde = useSyncExternalStore(abonnerHorloge, lireSeconde, lireSeconde);
  const s = Math.max(0, seconde - Math.floor(dateUtc(iso).getTime() / 1000));
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(s / 86400)}:${deux(Math.floor(s / 3600) % 24)}:${deux(Math.floor(s / 60) % 60)}:${deux(s % 60)}`;
}

export default function PageCandidatures({ compte, recherche }: ProprietesPage) {
  // File lue et choix gardés d'une visite à l'autre, relus en arrière-plan
  const file = useFileServeur<EtatFile, Filtres>({ section: 'candidatures', nom: 'file', chemin: '/candidatures', filtres: { etape: '', metier: '', langue: '' }, autoDepart: 16 });
  const { relire } = file;
  const [incomplet, setIncomplet] = useState<Incomplet | null>(null);
  const [competence, setCompetence] = useState<DemandeAjout | null>(null);
  const { dire, vue: avis } = useAvis('avis-file', true, file.erreur);
  // Une fiche qui change une offre fait relire la file aussitôt
  useEffect(() => {
    const changee = () => void relire();
    window.addEventListener(OFFRE_CHANGEE, changee);
    return () => window.removeEventListener(OFFRE_CHANGEE, changee);
  }, [relire]);

  return (
    <Dock id="candidatures" principal="tableau" panneau={null}>
      <ActiviteDePage admin={compte.admin} />
      <Tableau admin={compte.admin} direct={new URLSearchParams(recherche).get('panneau') === 'direct'} file={file} avis={avis} dire={dire} />
      <PanneauDePage admin={compte.admin} incomplet={incomplet} setIncomplet={setIncomplet}
        competence={competence} setCompetence={setCompetence} dire={dire} relire={relire} />
    </Dock>
  );
}

// L'Activité de la page : chez l'admin, « Maintenant » ouvre En direct
function ActiviteDePage({ admin }: { admin: boolean }) {
  const { ouvrir } = usePanneau();
  return <Activite surMaintenant={admin ? () => ouvrir('direct') : undefined} />;
}

type ProprietesTableau = { admin: boolean; direct: boolean; file: FileServeur<EtatFile, Filtres>; avis: React.ReactNode; dire: Dire };

function Tableau({ admin, direct, file, avis, dire }: ProprietesTableau) {
  const { lu, filtres, setFiltres, page, setPage, taille, setTaille, auto, setAuto, selection, setSelection, relire } = file;
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const [confirmation, setConfirmation] = useState<'supprimer' | 'vider' | null>(null);
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const [menu, setMenu] = useState<keyof Filtres | null>(null);
  const defile = useRef<HTMLDivElement>(null);

  // « Maintenant » d'une autre page mène ici avec ?panneau=direct
  useEffect(() => {
    if (!direct) return;
    if (admin) ouvrir('direct');
    // Une fois l'entrée d'historique posée, la vue oublie la demande
    const minuteur = setTimeout(() => {
      const vue = 'illusion/candidatures';
      window.history.replaceState({ page: vue }, '', `/${vue}`);
      useUIStore.setState({ page: vue });
    });
    return () => clearTimeout(minuteur);
  }, [direct, admin, ouvrir]);
  // Échap ferme un menu, sinon la confirmation, sinon le panneau s'il est libre
  useEchap((e) => {
    if (menu) setMenu(null);
    else if (confirmation) setConfirmation(null);
    else if (!e.defaultPrevented) fermer();
  }, true);
  useLignesAuto(defile, setAuto, lu?.offres?.length ?? 0);

  const offres = lu?.offres ?? [];
  const { toutes, cocher } = useCoches(selection, setSelection, offres.map((o) => o.cle));
  const ouvrirFiche = (c: string) => ouvrir('fiche-offre', c);
  const agir = (faire: () => Promise<string>) => geste(async () => dire(await faire()), () => {
    setConfirmation(null);
    return relire();
  });
  const supprimer = () => agir(async () => {
    const cles = [...selection];
    const r = await appeler<{ offres: number; candidatures: number; fichiers: number; mails: number }>('/offres/supprimer', { methode: 'POST', corps: { cles } });
    setSelection(new Set());
    return `${r.offres} offre(s) supprimée(s) : ${r.candidatures} candidature(s), ${r.fichiers} fichier(s), ${r.mails} mail(s) détaché(s).`;
  });
  const vider = () => agir(async () => `${(await appeler<{ efface: number }>('/candidatures/vider', { methode: 'POST' })).efface} candidature(s) effacée(s) de l'historique.`);
  const reprendre = () => agir(async () => `${(await appeler<{ reprises: number }>('/candidatures/echecs/reprendre', { methode: 'POST' })).reprises} offre(s) rendue(s) à la file.`);

  const menus: { cle: keyof Filtres; lib: string; tous: string; precis?: string; options: { valeur: string; nom: string; compte: number }[] }[] = [
    { cle: 'etape', lib: 'Étape', tous: 'Total', options: Object.entries(ETAPES).map(([v, e]) => ({ valeur: v, nom: e.nom, compte: lu?.comptes[v] ?? 0 })) },
    { cle: 'metier', lib: 'Métier', tous: 'tous', precis: 'les métiers', options: optionsGroupe(lu?.groupes.metiers, filtres.metier, nomMetier) },
    { cle: 'langue', lib: 'Langue', tous: 'toutes', precis: 'les langues', options: optionsGroupe(lu?.groupes.langues, filtres.langue, nomLangue) },
  ];
  const pages = lu?.pages ?? 1;

  return (
    <Fenetre id="tableau" as="main" className="tableau candidatures" aria-label="Candidatures" titrePrise="Glisser pour détacher les candidatures">
      <div className="outils">
        {menus.map((m) => {
          const actif = filtres[m.cle];
          const choisi = m.options.find((o) => o.valeur === actif);
          const label = `${m.lib} : ${choisi ? choisi.nom : m.tous}`;
          return (
            <MenuTenu key={m.cle} ouvert={menu === m.cle} basculer={() => setMenu(menu === m.cle ? null : m.cle)} fermer={() => setMenu(null)} classeHote="filtre-hote"
              actif={!!actif} aria-label={label} titre={label} lib={m.cle === 'etape' && !actif ? undefined : m.lib}
              valeur={m.cle === 'etape' && !actif ? 'Total' : <>{choisi ? `${choisi.nom} · ${choisi.compte}` : m.tous}{!choisi && <span className="precis"> {m.precis}</span>}</>}
              choix={choixDe([{ valeur: '', nom: m.cle === 'etape' ? `Total · ${lu?.total ?? 0}` : m.tous[0].toUpperCase() + m.tous.slice(1), compte: -1 }, ...m.options])}
              courant={actif} choisir={(v) => { setFiltres({ ...filtres, [m.cle]: v }); setMenu(null); }} />
          );
        })}
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          {admin && (
            <>
              <Action className="repli-2" icone={ICONES.reprendre} title="Reprendre les échecs : les offres dont la candidature a échoué retournent dans la file" disabled={occupe} onClick={() => void reprendre()}><span className="txt">Reprendre les échecs</span><MarqueAdmin />
              </Action>
              <Action className="repli-2" icone={ICONES.vider} title="Vider l'historique" aria-haspopup="dialog" aria-expanded={confirmation === 'vider'} onClick={() => setConfirmation('vider')}><span className="txt">Vider l&apos;historique</span><MarqueAdmin />
              </Action>
            </>
          )}
          <ActionSupprimer n={selection.size} title={`Supprimer ${selection.size} offre(s)`} aria-haspopup="dialog" onClick={() => setConfirmation('supprimer')} />
          <ActionOnglet cle="reglages" className="repli-1" icone={ICONES.reglages} title="Réglages">Réglages
          </ActionOnglet>
          <ActionOnglet cle="ajout" allume={false} txt={false} plein iconeApres={ICONES.plus_pages}>
            Ajouter une offre
          </ActionOnglet>
        </div>
      </div>
      {confirmation === 'supprimer' && (
        <Confirmer question={`Supprimer ${selection.size} offre${selection.size > 1 ? 's' : ''} ?`} detail="Leurs dossiers sont effacés, leurs mails détachés." action="Supprimer"
          occupe={occupe} onAnnuler={() => setConfirmation(null)} onConfirmer={() => void supprimer()} />
      )}
      {confirmation === 'vider' && (
        <Confirmer question="Vider l'historique ?" admin detail={`Ses ${lu?.statistiques.total ?? 0} candidatures partent, les offres restent.`} action="Vider"
          occupe={occupe} onAnnuler={() => setConfirmation(null)} onConfirmer={() => void vider()} />
      )}
      <div className="defile" ref={defile}>
        <table>
          <thead>
            <tr>
              <th><Case aria-label="Tout sélectionner" checked={toutes} onChange={(e) => cocher(offres.map((o) => o.cle), e.target.checked)} /></th>
              <th>Publiée</th><th>Entreprise</th><th>Intitulé</th><th>Lieu / contrat</th><th>Profil</th><th>Source</th><th>Étape</th><th>Timer</th>
            </tr>
          </thead>
          <tbody>
            {offres.map((o) => {
              const etape = ETAPES[o.etape] ?? { nom: o.etape, classe: '' };
              const ouverte = onglet === 'fiche-offre' && objet === o.cle;
              return (
                <tr key={o.cle} className={`${selection.has(o.cle) ? 'coche' : ''}${ouverte ? ' ouverte' : ''}`} {...ouvrable('fiche-offre', o.cle, () => ouvrirFiche(o.cle))}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Case aria-label={`Sélectionner ${o.entreprise_brute}`} checked={selection.has(o.cle)} onChange={(e) => cocher([o.cle], e.target.checked)} />
                  </td>
                  <td className="d">{jourMoisIso(o.publiee_le)}</td>
                  <td title={o.entreprise_brute}>{o.entreprise_siren
                    ? <button type="button" className="ent" title="Voir la fiche entreprise" data-ouvre="fiche-entreprise" data-objet={o.entreprise_siren} onClick={(e) => { e.stopPropagation(); ouvrir('fiche-entreprise', o.entreprise_siren!); }}>{o.entreprise_brute}</button>
                    : <span className="ent">{o.entreprise_brute || '—'}</span>}</td>
                  <td title={o.titre}>{o.titre || '—'}</td>
                  <td>{[o.lieu, o.contrat].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="d">{nomProfil(o.profil_cv) || (o.cv_auto ? 'automatique' : '—')}{o.cv_auto && o.profil_cv && <span className="auto">auto</span>}</td>
                  <td className="d">{libelleSource(o.source)}</td>
                  <td title={o.raison || undefined}><span className={`eo ${etape.classe}`}>{etape.nom}</span></td>
                  <td className={`chrono${o.postule_le ? '' : ' vide'}`} title={o.postule_le ? "Temps écoulé depuis l'envoi : jours:heures:minutes:secondes" : undefined}>
                    {o.postule_le ? <Chrono iso={o.postule_le} /> : '—'}
                  </td>
                </tr>
              );
            })}
            {lu && !offres.length && (
              <tr className="vide-f"><td colSpan={9}>{filtres.etape || filtres.metier || filtres.langue ? 'Aucune offre sous ces filtres.' : 'Aucune offre : la veille en apportera, ou ajoutez-en une.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {avis}
      <PaginationAller page={page} pages={pages} setPage={setPage} taille={taille} tailles={TAILLES} setTaille={setTaille} auto={auto}>
        <span className="espace" />
        <span className="compteur">{lu ? `${lu.total_filtre} offre${lu.total_filtre > 1 ? 's' : ''}` : ''}</span>
      </PaginationAller>
    </Fenetre>
  );
}

type ProprietesPanneau = {
  admin: boolean; incomplet: Incomplet | null; setIncomplet: (i: Incomplet | null) => void; competence: DemandeAjout | null; setCompetence: (d: DemandeAjout | null) => void;
  dire: Dire; relire: () => Promise<void>;
};

// Panneau : les fiches (une par fenêtre), puis chaque sous-fenêtre en onglet
function PanneauDePage({ admin, incomplet, setIncomplet, competence, setCompetence, dire, relire }: ProprietesPanneau) {
  const { onglet, ouvrir, fermer } = usePanneau();
  // Refermé, le panneau oublie les fenêtres d'un geste
  useEffect(() => {
    if (onglet !== null) return;
    setIncomplet(null);
    setCompetence(null);
  }, [onglet, setIncomplet, setCompetence]);
  const reglages = useOngletReglages({ admin, actif: onglet === 'reglages', fermer, dire });
  const ajout = useOngletAjout({ admin, actif: onglet === 'ajout', dire, relire: () => void relire(), montrerIncomplet: (i) => { setIncomplet(i); ouvrir('profil-incomplet'); } });
  const direct = useOngletDirect({ actif: admin && onglet === 'direct', ouvrirFiche: (c) => ouvrir('fiche-offre', c) });
  const elements = {
    'fiche-offre': (c: string) => ongletFicheOffre(c, {
      ouvrirEntreprise: (s) => ouvrir('fiche-entreprise', s),
      ajouterAuProfil: (d) => { setCompetence(d); ouvrir('ajout-competence'); },
    }),
    'fiche-entreprise': (s: string) => ongletFicheEntreprise(s, { ouvrirOffre: (c) => ouvrir('fiche-offre', c) }),
  };
  const onglets = [
    ongletAjoutCompetence(competence, (texte) => { if (texte) dire(texte); if (competence) ouvrir('fiche-offre', competence.cle); setCompetence(null); }),
    ongletProfilIncomplet(incomplet, () => { setIncomplet(null); ouvrir('ajout'); }),
    reglages,
    ajout,
    ...(admin ? [direct] : []),
  ];
  // Un onglet sans objet (ajout sans compétence) ne se montre pas
  const pret: Record<string, boolean> = { 'ajout-competence': !!competence, 'profil-incomplet': !!incomplet };
  return <Panneau elements={elements} onglets={onglets.filter((o) => pret[o.cle] !== false)} />;
}
