'use client';

import './candidatures.css';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useUIStore } from '@/lib/uiStore';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Activite } from '../../activite/Activite';
import { useSondage } from '../../activite/sondage';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, MarqueAdmin, Panneau } from '../../dock/Panneau';
import { ongletFicheEntreprise } from '../../partage/FicheEntreprise';
import { ETAPES, OFFRE_CHANGEE, dateUtc, jourMois, libelleSource, nomProfil, ongletAjoutCompetence, ongletFicheOffre, type DemandeAjout } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import { ongletProfilIncomplet, useOngletAjout, useOngletDirect, useOngletReglages, type Incomplet } from './panneaux';
import { MenuChoix, PaginationAller, useLignesAuto, ICONES_COMMUNES, TRAIT, message, useAvisBref, useEchap, type Avis } from '../commun';

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
const LANGUES: Record<string, string> = { fr: 'Français', en: 'Anglais', de: 'Allemand', es: 'Espagnol', it: 'Italien', pt: 'Portugais', nl: 'Néerlandais' };
const TAILLES = [25, 50, 100];

const ICONES = {
  ...ICONES_COMMUNES,
  reprendre: <svg {...TRAIT}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>,
};

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
  const [file, setFile] = useState(() => repris<EtatFile | null>('candidatures:file', null));
  const [erreurFile, setErreurFile] = useState('');
  const [filtres, setFiltres] = useState(() => repris<Filtres>('candidatures:filtres', { etape: '', metier: '', langue: '' }));
  const [page, setPage] = useState(() => repris('candidatures:page', 1));
  const [taille, setTaille] = useState(() => repris<number | 'auto'>('candidatures:taille', 'auto'));
  const [auto, setAuto] = useState(() => repris('candidatures:auto', 16));
  useGarder('candidatures', { file, filtres, page, taille, auto });
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [incomplet, setIncomplet] = useState<Incomplet | null>(null);
  const [competence, setCompetence] = useState<DemandeAjout | null>(null);
  const [avis, setAvis] = useState<Avis>(null);
  // L'API lit au moins 10 lignes ; en « auto », le défileur garde le surplus
  const adresse = `/candidatures?${new URLSearchParams({ ...filtres, page: String(page), taille: String(taille === 'auto' ? Math.max(10, auto) : taille) })}`;
  const relire = useCallback(async () => {
    try {
      const lu = await appeler<EtatFile>(adresse);
      setFile(lu);
      setErreurFile('');
      if (lu.page > lu.pages) setPage(lu.pages);
    } catch (e) {
      setErreurFile(message(e));
    }
  }, [adresse]);
  // File relue toutes les 5 s, et aussitôt qu'une fiche change une offre
  useSondage(relire, 5000, true, adresse);
  useEffect(() => {
    const changee = () => void relire();
    window.addEventListener(OFFRE_CHANGEE, changee);
    return () => window.removeEventListener(OFFRE_CHANGEE, changee);
  }, [relire]);

  return (
    <Dock id="candidatures" principal="tableau" panneau={null}>
      <ActiviteDePage admin={compte.admin} />
      <Tableau admin={compte.admin} direct={new URLSearchParams(recherche).get('panneau') === 'direct'} file={file} erreurFile={erreurFile} filtres={filtres} setFiltres={(f) => { setFiltres(f); setPage(1); }}
        page={page} setPage={setPage} taille={taille} setTaille={(t) => { setTaille(t); setPage(1); }} auto={auto} setAuto={setAuto}
        selection={selection} setSelection={setSelection} avis={avis} setAvis={setAvis} relire={relire} />
      <PanneauDePage admin={compte.admin} incomplet={incomplet} setIncomplet={setIncomplet}
        competence={competence} setCompetence={setCompetence} setAvis={setAvis} relire={relire} />
    </Dock>
  );
}

// L'Activité de la page : chez l'admin, « Maintenant » ouvre En direct
function ActiviteDePage({ admin }: { admin: boolean }) {
  const { ouvrir } = usePanneau();
  return <Activite surMaintenant={admin ? () => ouvrir('direct') : undefined} />;
}

type ProprietesTableau = {
  admin: boolean; direct: boolean; file: EtatFile | null; erreurFile: string; filtres: Filtres; setFiltres: (f: Filtres) => void;
  page: number; setPage: (p: number) => void; taille: number | 'auto'; setTaille: (t: number | 'auto') => void; auto: number; setAuto: (n: number) => void;
  selection: Set<string>; setSelection: (s: Set<string>) => void; avis: Avis; setAvis: (a: Avis) => void; relire: () => Promise<void>;
};

function Tableau({ admin, direct, file, erreurFile, filtres, setFiltres, page, setPage, taille, setTaille, auto, setAuto, selection, setSelection, avis, setAvis, relire }: ProprietesTableau) {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const [confirmation, setConfirmation] = useState<'supprimer' | 'vider' | null>(null);
  const [occupe, setOccupe] = useState(false);
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
  // Échap ferme un menu, sinon la confirmation, sinon le panneau
  useEchap(() => {
    if (menu) setMenu(null);
    else if (confirmation) setConfirmation(null);
    else fermer();
  }, true);
  useAvisBref(avis, setAvis);
  useLignesAuto(defile, setAuto, 36, file?.offres?.length ?? 0);

  const offres = file?.offres ?? [];
  const toutes = offres.length > 0 && offres.every((o) => selection.has(o.cle));
  const cocher = (cles: string[], oui: boolean) => {
    const s = new Set(selection);
    cles.forEach((c) => (oui ? s.add(c) : s.delete(c)));
    setSelection(s);
  };
  const ouvrirFiche = (c: string) => ouvrir('fiche-offre', c);
  const geste = async (faire: () => Promise<string>) => {
    setOccupe(true);
    try {
      setAvis({ texte: await faire() });
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    } finally {
      setOccupe(false);
      setConfirmation(null);
      await relire();
    }
  };
  const supprimer = () => geste(async () => {
    const cles = [...selection];
    const r = await appeler<{ offres: number; candidatures: number; fichiers: number; mails: number }>('/offres/supprimer', { methode: 'POST', corps: { cles } });
    setSelection(new Set());
    return `${r.offres} offre(s) supprimée(s) : ${r.candidatures} candidature(s), ${r.fichiers} fichier(s), ${r.mails} mail(s) détaché(s).`;
  });
  const vider = () => geste(async () => `${(await appeler<{ efface: number }>('/candidatures/vider', { methode: 'POST' })).efface} candidature(s) effacée(s) de l'historique.`);
  const reprendre = () => geste(async () => `${(await appeler<{ reprises: number }>('/candidatures/echecs/reprendre', { methode: 'POST' })).reprises} offre(s) rendue(s) à la file.`);

  const groupe = (valeurs: Record<string, number> | undefined, choisi: string, nom: (v: string) => string) => {
    const tous = { ...(valeurs ?? {}) };
    if (choisi && !(choisi in tous)) tous[choisi] = 0;
    return Object.entries(tous).sort(([a], [b]) => Number(a === '-') - Number(b === '-') || a.localeCompare(b, 'fr')).map(([v, n]) => ({ valeur: v, nom: nom(v), compte: n }));
  };
  const menus: { cle: keyof Filtres; lib: string; tous: string; precis?: string; options: { valeur: string; nom: string; compte: number }[] }[] = [
    { cle: 'etape', lib: 'Étape', tous: 'Total', options: Object.entries(ETAPES).map(([v, e]) => ({ valeur: v, nom: e.nom, compte: file?.comptes[v] ?? 0 })) },
    { cle: 'metier', lib: 'Métier', tous: 'tous', precis: 'les métiers', options: groupe(file?.groupes.metiers, filtres.metier, (v) => (v === '-' ? 'sans métier' : v)) },
    { cle: 'langue', lib: 'Langue', tous: 'toutes', precis: 'les langues', options: groupe(file?.groupes.langues, filtres.langue, (v) => (v === '-' ? 'sans langue' : LANGUES[v] ?? v)) },
  ];
  const pages = file?.pages ?? 1;

  return (
    <Fenetre id="tableau" as="main" className="tableau candidatures" aria-label="Candidatures" titrePrise="Glisser pour détacher les candidatures">
      <div className="outils">
        {menus.map((m) => {
          const actif = filtres[m.cle];
          const choisi = m.options.find((o) => o.valeur === actif);
          return (
            <MenuChoix key={m.cle} ouvert={menu === m.cle} basculer={() => setMenu(menu === m.cle ? null : m.cle)} fermer={() => setMenu(null)}
              actif={!!actif} label={`${m.lib} : ${choisi ? choisi.nom : m.tous}`}
              valeur={m.cle === 'etape' && !actif ? <span>Total</span> : <span><span className="lib">{m.lib}</span>{choisi ? `${choisi.nom} · ${choisi.compte}` : m.tous}{!choisi && <span className="precis"> {m.precis}</span>}</span>}
              options={[{ valeur: '', nom: m.cle === 'etape' ? `Total · ${file?.total ?? 0}` : m.tous[0].toUpperCase() + m.tous.slice(1), compte: -1 }, ...m.options]}
              courant={actif} choisir={(v) => { setFiltres({ ...filtres, [m.cle]: v }); setMenu(null); }} />
          );
        })}
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          {admin && (
            <>
              <button type="button" className="action repli-2" title="Reprendre les échecs : les offres dont la candidature a échoué retournent dans la file" disabled={occupe} onClick={() => void reprendre()}>
                <span className="ico">{ICONES.reprendre}</span><span className="txt">Reprendre les échecs</span><MarqueAdmin />
              </button>
              <button type="button" className="action repli-2" title="Vider l'historique" aria-haspopup="dialog" aria-expanded={confirmation === 'vider'} onClick={() => setConfirmation('vider')}>
                <span className="ico">{ICONES.vider}</span><span className="txt">Vider l&apos;historique</span><MarqueAdmin />
              </button>
            </>
          )}
          <button type="button" className="action rouge" title={`Supprimer ${selection.size} offre(s)`} aria-haspopup="dialog" onClick={() => setConfirmation('supprimer')}>
            <span className="ico">{ICONES.supprimer}</span><span><span className="txt">Supprimer </span>({selection.size})</span>
          </button>
          <button type="button" className={`action repli-1${onglet === 'reglages' ? ' allume' : ''}`} title="Réglages" aria-haspopup="dialog" aria-expanded={onglet === 'reglages'} onClick={() => ouvrir('reglages')}>
            <span className="ico">{ICONES.reglages}</span><span className="txt">Réglages</span>
          </button>
          <button type="button" className="action plein" aria-haspopup="dialog" aria-expanded={onglet === 'ajout'} onClick={() => ouvrir('ajout')}>
            Ajouter une offre<span className="ico">{ICONES.plus}</span>
          </button>
        </div>
      </div>
      {confirmation === 'supprimer' && (
        <Confirmer question={`Supprimer ${selection.size} offre${selection.size > 1 ? 's' : ''} ?`} detail="Leurs dossiers sont effacés, leurs mails détachés." action="Supprimer"
          occupe={occupe} onAnnuler={() => setConfirmation(null)} onConfirmer={() => void supprimer()} />
      )}
      {confirmation === 'vider' && (
        <Confirmer question="Vider l'historique ?" admin detail={`Ses ${file?.statistiques.total ?? 0} candidatures partent, les offres restent.`} action="Vider"
          occupe={occupe} onAnnuler={() => setConfirmation(null)} onConfirmer={() => void vider()} />
      )}
      <div className="defile" ref={defile}>
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" className="case" aria-label="Tout sélectionner" checked={toutes} onChange={(e) => cocher(offres.map((o) => o.cle), e.target.checked)} /></th>
              <th>Publiée</th><th>Entreprise</th><th>Intitulé</th><th>Lieu / contrat</th><th>Profil</th><th>Source</th><th>Étape</th><th>Timer</th>
            </tr>
          </thead>
          <tbody>
            {offres.map((o) => {
              const etape = ETAPES[o.etape] ?? { nom: o.etape, classe: '' };
              const ouverte = onglet === 'fiche-offre' && objet === o.cle;
              return (
                <tr key={o.cle} className={`${selection.has(o.cle) ? 'coche' : ''}${ouverte ? ' ouverte' : ''}`} tabIndex={0} data-ouvre="fiche-offre" data-objet={o.cle}
                  onClick={() => ouvrirFiche(o.cle)} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && ouvrirFiche(o.cle)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="case" aria-label={`Sélectionner ${o.entreprise_brute}`} checked={selection.has(o.cle)} onChange={(e) => cocher([o.cle], e.target.checked)} />
                  </td>
                  <td className="d">{jourMois(o.publiee_le)}</td>
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
            {file && !offres.length && (
              <tr className="vide-f"><td colSpan={9}>{filtres.etape || filtres.metier || filtres.langue ? 'Aucune offre sous ces filtres.' : 'Aucune offre : la veille en apportera, ou ajoutez-en une.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {(avis || erreurFile) && (
        <p className={`avis-file${avis?.erreur || (!avis && erreurFile) ? ' erreur' : ''}`} role={avis?.erreur || (!avis && erreurFile) ? 'alert' : 'status'} onClick={() => setAvis(null)}>
          {avis?.texte ?? erreurFile}
        </p>
      )}
      <PaginationAller page={page} pages={pages} setPage={setPage} taille={taille} tailles={TAILLES} setTaille={setTaille} auto={auto}>
        <span className="espace" />
        <span className="compteur">{file ? `${file.total_filtre} offre${file.total_filtre > 1 ? 's' : ''}` : ''}</span>
      </PaginationAller>
    </Fenetre>
  );
}

type ProprietesPanneau = {
  admin: boolean; incomplet: Incomplet | null; setIncomplet: (i: Incomplet | null) => void; competence: DemandeAjout | null; setCompetence: (d: DemandeAjout | null) => void;
  setAvis: (a: Avis) => void; relire: () => Promise<void>;
};

// Panneau : les fiches (une par fenêtre), puis chaque sous-fenêtre en onglet
function PanneauDePage({ admin, incomplet, setIncomplet, competence, setCompetence, setAvis, relire }: ProprietesPanneau) {
  const { onglet, ouvrir, fermer } = usePanneau();
  // Refermé, le panneau oublie les fenêtres d'un geste
  useEffect(() => {
    if (onglet !== null) return;
    setIncomplet(null);
    setCompetence(null);
  }, [onglet, setIncomplet, setCompetence]);
  const reglages = useOngletReglages({ admin, actif: onglet === 'reglages', fermer, setAvis });
  const ajout = useOngletAjout({ admin, actif: onglet === 'ajout', setAvis, relire: () => void relire(), montrerIncomplet: (i) => { setIncomplet(i); ouvrir('profil-incomplet'); } });
  const direct = useOngletDirect({ actif: admin && onglet === 'direct', ouvrirFiche: (c) => ouvrir('fiche-offre', c) });
  const elements = {
    'fiche-offre': (c: string) => ongletFicheOffre(c, {
      ouvrirEntreprise: (s) => ouvrir('fiche-entreprise', s),
      ajouterAuProfil: (d) => { setCompetence(d); ouvrir('ajout-competence'); },
    }),
    'fiche-entreprise': (s: string) => ongletFicheEntreprise(s, { ouvrirOffre: (c) => ouvrir('fiche-offre', c) }),
  };
  const onglets = [
    ongletAjoutCompetence(competence, (texte) => { if (texte) setAvis({ texte }); if (competence) ouvrir('fiche-offre', competence.cle); setCompetence(null); }),
    ongletProfilIncomplet(incomplet, () => { setIncomplet(null); ouvrir('ajout'); }),
    reglages,
    ajout,
    ...(admin ? [direct] : []),
  ];
  // Un onglet sans objet (ajout sans compétence) ne se montre pas
  const pret: Record<string, boolean> = { 'ajout-competence': !!competence, 'profil-incomplet': !!incomplet };
  return <Panneau elements={elements} onglets={onglets.filter((o) => pret[o.cle] !== false)} />;
}
