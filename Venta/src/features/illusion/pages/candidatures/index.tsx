'use client';

import './candidatures.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useUIStore } from '@/lib/uiStore';
import { appeler } from '../../api';
import { Activite } from '../../activite/Activite';
import { useSondage } from '../../activite/sondage';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, MarqueAdmin, Panneau } from '../../dock/Panneau';
import { ongletFicheEntreprise } from '../../partage/FicheEntreprise';
import { ETAPES, OFFRE_CHANGEE, dateUtc, jourMois, libelleSource, nomProfil, ongletAjoutCompetence, ongletFicheOffre, type DemandeAjout } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import { ongletProfilIncomplet, useOngletAjout, useOngletDirect, useOngletReglages, type Avis, type Incomplet } from './panneaux';

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
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
const ICONES = {
  chevron: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>,
  reprendre: <svg {...TRAIT}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>,
  vider: <svg {...TRAIT}><path d="M4 6h16M6 6l1 14h10l1-14M9 10l6 6M15 10l-6 6" /></svg>,
  supprimer: <svg {...TRAIT}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  reglages: <svg {...TRAIT}><polygon points="22.3,10.2 22.3,13.8 19.4,13.8 18.5,15.9 20.6,18.0 18.0,20.6 15.9,18.5 13.8,19.4 13.8,22.3 10.2,22.3 10.2,19.4 8.1,18.5 6.0,20.6 3.4,18.0 5.5,15.9 4.6,13.8 1.7,13.8 1.7,10.2 4.6,10.2 5.5,8.1 3.4,6.0 6.0,3.4 8.1,5.5 10.2,4.6 10.2,1.7 13.8,1.7 13.8,4.6 15.9,5.5 18.0,3.4 20.6,6.0 18.5,8.1 19.4,10.2" /><circle cx="12" cy="12" r="3" /></svg>,
  plus: <svg {...TRAIT} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
};

// « 6:04:47:12 » : jours, heures, minutes, secondes depuis l'envoi, le compteur qui dit quand relancer
function chrono(iso: string, maintenant: number) {
  const s = Math.max(0, Math.floor((maintenant - dateUtc(iso).getTime()) / 1000));
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(s / 86400)}:${deux(Math.floor(s / 3600) % 24)}:${deux(Math.floor(s / 60) % 60)}:${deux(s % 60)}`;
}

export default function PageCandidatures({ compte, recherche }: ProprietesPage) {
  const [file, setFile] = useState<EtatFile | null>(null);
  const [erreurFile, setErreurFile] = useState('');
  const [filtres, setFiltres] = useState<Filtres>({ etape: '', metier: '', langue: '' });
  const [page, setPage] = useState(1);
  const [taille, setTaille] = useState<number | 'auto'>('auto');
  const [auto, setAuto] = useState(16);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [cle, setCle] = useState<string | null>(null);
  const [siren, setSiren] = useState<string | null>(null);
  const [incomplet, setIncomplet] = useState<Incomplet | null>(null);
  const [competence, setCompetence] = useState<DemandeAjout | null>(null);
  const [avis, setAvis] = useState<Avis>(null);
  // L'API lit au moins 10 lignes ; en « auto », le défileur garde les lignes qui ne tiennent pas
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
  // La file relue toutes les 5 s, comme le bandeau de l'ancien dashboard, et aussitôt qu'une fiche change une offre
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
        selection={selection} setSelection={setSelection} cle={cle} setCle={setCle} setSiren={setSiren} avis={avis} setAvis={setAvis} relire={relire} />
      <PanneauDePage admin={compte.admin} cle={cle} setCle={setCle} siren={siren} setSiren={setSiren} incomplet={incomplet} setIncomplet={setIncomplet}
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
  selection: Set<string>; setSelection: (s: Set<string>) => void; cle: string | null; setCle: (c: string | null) => void; setSiren: (s: string) => void;
  avis: Avis; setAvis: (a: Avis) => void; relire: () => Promise<void>;
};

function Tableau({ admin, direct, file, erreurFile, filtres, setFiltres, page, setPage, taille, setTaille, auto, setAuto, selection, setSelection, cle, setCle, setSiren, avis, setAvis, relire }: ProprietesTableau) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const [confirmation, setConfirmation] = useState<'supprimer' | 'vider' | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [menu, setMenu] = useState<keyof Filtres | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [aller, setAller] = useState('');
  const defile = useRef<HTMLDivElement>(null);

  // Les compteurs des offres envoyées tournent à la seconde, sans rien redemander au serveur
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // « Maintenant » d'une autre page mène ici avec ?panneau=direct
  useEffect(() => {
    if (!direct) return;
    if (admin) ouvrir('direct');
    // Une fois l'entrée d'historique de la vue posée, la vue et son adresse oublient la demande
    const minuteur = setTimeout(() => {
      const vue = 'illusion/candidatures';
      window.history.replaceState({ page: vue }, '', `/${vue}`);
      useUIStore.setState({ page: vue });
    });
    return () => clearTimeout(minuteur);
  }, [direct, admin, ouvrir]);
  // Échap ferme un menu, sinon la confirmation, sinon le panneau
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menu) setMenu(null);
      else if (confirmation) setConfirmation(null);
      else fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [menu, confirmation, fermer]);
  // Un avis se lit 3,5 s, une erreur 8 s
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis, setAvis]);
  // « auto » : autant de lignes que la hauteur du défileur en montre sans en couper une ; remesuré quand les lignes arrivent
  const nbLignes = file?.offres?.length ?? 0;
  useLayoutEffect(() => {
    const zone = defile.current;
    if (!zone) return;
    const mesurer = () => {
      const tete = zone.querySelector('thead')?.getBoundingClientRect().height ?? 34;
      const ligne = zone.querySelector('tbody tr')?.getBoundingClientRect().height || 36;
      setAuto(Math.max(1, Math.floor((zone.clientHeight - tete) / ligne)));
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(zone);
    return () => observateur.disconnect();
  }, [setAuto, nbLignes]);

  const offres = file?.offres ?? [];
  const toutes = offres.length > 0 && offres.every((o) => selection.has(o.cle));
  const cocher = (cles: string[], oui: boolean) => {
    const s = new Set(selection);
    cles.forEach((c) => (oui ? s.add(c) : s.delete(c)));
    setSelection(s);
  };
  const ouvrirFiche = (c: string) => {
    setCle(c);
    ouvrir('fiche-offre');
  };
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
    if (cle && cles.includes(cle)) setCle(null);
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
  const numeros = [...new Set([1, 2, 3, page - 1, page, page + 1, pages - 2, pages - 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const allerA = () => {
    const n = Number(aller);
    if (Number.isInteger(n) && n >= 1 && n <= pages) setPage(n);
    setAller('');
  };
  // Les numéros proches du début, de la page et de la fin ; le premier trou devient le « … » où taper la page voulue
  const boutons: React.ReactNode[] = [];
  numeros.forEach((n, i) => {
    if (i > 0 && n - numeros[i - 1] > 1) {
      boutons.push(boutons.some((b) => (b as React.ReactElement).key === 'aller')
        ? <span key={`trou-${n}`} className="pl trou" aria-hidden="true">…</span>
        : <input key="aller" type="text" className="aller" inputMode="numeric" placeholder="…" size={3} aria-label="Aller à la page" value={aller}
            onChange={(e) => setAller(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && allerA()} onBlur={() => aller && allerA()} />);
    }
    boutons.push(<button key={n} type="button" className={`pl${n === page ? ' actif' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>);
  });

  return (
    <Fenetre id="tableau" as="main" className="tableau candidatures" aria-label="Candidatures" titrePrise="Glisser pour détacher les candidatures">
      <div className="outils">
        {menus.map((m) => {
          const actif = filtres[m.cle];
          const choisi = m.options.find((o) => o.valeur === actif);
          return (
            <MenuFiltre key={m.cle} ouvert={menu === m.cle} basculer={() => setMenu(menu === m.cle ? null : m.cle)} fermer={() => setMenu(null)}
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
              const ouverte = onglet === 'fiche-offre' && cle === o.cle;
              return (
                <tr key={o.cle} className={`${selection.has(o.cle) ? 'coche' : ''}${ouverte ? ' ouverte' : ''}`} tabIndex={0}
                  onClick={() => ouvrirFiche(o.cle)} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && ouvrirFiche(o.cle)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="case" aria-label={`Sélectionner ${o.entreprise_brute}`} checked={selection.has(o.cle)} onChange={(e) => cocher([o.cle], e.target.checked)} />
                  </td>
                  <td className="d">{jourMois(o.publiee_le)}</td>
                  <td title={o.entreprise_brute}>{o.entreprise_siren
                    ? <button type="button" className="ent" title="Voir la fiche entreprise" onClick={(e) => { e.stopPropagation(); setSiren(o.entreprise_siren!); ouvrir('fiche-entreprise'); }}>{o.entreprise_brute}</button>
                    : <span className="ent">{o.entreprise_brute || '—'}</span>}</td>
                  <td title={o.titre}>{o.titre || '—'}</td>
                  <td>{[o.lieu, o.contrat].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="d">{nomProfil(o.profil_cv) || (o.cv_auto ? 'automatique' : '—')}{o.cv_auto && o.profil_cv && <span className="auto">auto</span>}</td>
                  <td className="d">{libelleSource(o.source)}</td>
                  <td title={o.raison || undefined}><span className={`eo ${etape.classe}`}>{etape.nom}</span></td>
                  <td className={`chrono${o.postule_le ? '' : ' vide'}`} title={o.postule_le ? "Temps écoulé depuis l'envoi : jours:heures:minutes:secondes" : undefined}>
                    {o.postule_le ? chrono(o.postule_le, maintenant) : '—'}
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
      <div className="pagination">
        <select aria-label="Lignes par page" value={String(taille)} onChange={(e) => setTaille(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
          <option value="auto">auto ({auto})</option>
          {TAILLES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <nav className="pages" aria-label="Pages">
          <button type="button" className="pl" disabled={page <= 1} aria-label="Page précédente" onClick={() => setPage(page - 1)}>‹</button>
          {boutons}
          <button type="button" className="pl" disabled={page >= pages} aria-label="Page suivante" onClick={() => setPage(page + 1)}>›</button>
        </nav>
        <span className="espace" />
        <span className="compteur">{file ? `${file.total_filtre} offre${file.total_filtre > 1 ? 's' : ''}` : ''}</span>
      </div>
    </Fenetre>
  );
}

// Un filtre en texte seul et son menu : un clic ailleurs ou Échap le referme
function MenuFiltre({ ouvert, basculer, fermer, actif, label, valeur, options, courant, choisir }: {
  ouvert: boolean; basculer: () => void; fermer: () => void; actif: boolean; label: string; valeur: React.ReactNode;
  options: { valeur: string; nom: string; compte: number }[]; courant: string; choisir: (v: string) => void;
}) {
  const hote = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!hote.current?.contains(e.target as Node)) fermer();
    };
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [ouvert, fermer]);
  return (
    <div ref={hote} className="menu-hote filtre-hote">
      <button type="button" className={`filtre${actif ? ' actif' : ''}`} aria-haspopup="listbox" aria-expanded={ouvert} aria-label={label} onClick={basculer}>
        {valeur}{ICONES.chevron}
      </button>
      {ouvert && (
        <div className="menu verre" role="listbox" aria-label={label}>
          <span className="verre-halos" aria-hidden="true" />
          {options.map((o) => (
            <button key={o.valeur || 'tous'} type="button" role="option" aria-selected={o.valeur === courant} className={`menu-option${o.valeur === courant ? ' actif' : ''}`} onClick={() => choisir(o.valeur)}>
              {o.nom}{o.compte >= 0 && <span className="compteur">{o.compte}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type ProprietesPanneau = {
  admin: boolean; cle: string | null; setCle: (c: string | null) => void; siren: string | null; setSiren: (s: string | null) => void;
  incomplet: Incomplet | null; setIncomplet: (i: Incomplet | null) => void; competence: DemandeAjout | null; setCompetence: (d: DemandeAjout | null) => void;
  setAvis: (a: Avis) => void; relire: () => Promise<void>;
};

// Le panneau : chaque sous-fenêtre de la page en onglet, dans l'ordre de la planche ; la fiche et les fenêtres d'un geste n'y sont qu'avec leur objet
function PanneauDePage({ admin, cle, setCle, siren, setSiren, incomplet, setIncomplet, competence, setCompetence, setAvis, relire }: ProprietesPanneau) {
  const { onglet, ouvrir, fermer } = usePanneau();
  // Refermé, le panneau oublie les fenêtres d'un geste
  useEffect(() => {
    if (onglet !== null) return;
    setIncomplet(null);
    setCompetence(null);
  }, [onglet, setIncomplet, setCompetence]);
  const reglages = useOngletReglages({ admin, actif: onglet === 'reglages', fermer, setAvis });
  const ajout = useOngletAjout({ admin, actif: onglet === 'ajout', setAvis, relire: () => void relire(), montrerIncomplet: (i) => { setIncomplet(i); ouvrir('profil-incomplet'); } });
  const direct = useOngletDirect({ actif: admin && onglet === 'direct', ouvrirFiche: (c) => { setCle(c); ouvrir('fiche-offre'); } });
  const onglets = [
    ongletFicheOffre(cle, {
      ouvrirEntreprise: (s) => { setSiren(s); ouvrir('fiche-entreprise'); },
      ajouterAuProfil: (d) => { setCompetence(d); ouvrir('ajout-competence'); },
    }),
    ongletFicheEntreprise(siren, { ouvrirOffre: (c) => { setCle(c); ouvrir('fiche-offre'); } }),
    ongletAjoutCompetence(competence, (texte) => { setCompetence(null); if (texte) setAvis({ texte }); ouvrir('fiche-offre'); }),
    ongletProfilIncomplet(incomplet, () => { setIncomplet(null); ouvrir('ajout'); }),
    reglages,
    ajout,
    ...(admin ? [direct] : []),
  ];
  // Un onglet sans objet (fiche sans offre, ajout sans compétence) ne se montre pas
  const pret: Record<string, boolean> = { 'fiche-offre': !!cle, 'fiche-entreprise': !!siren, 'ajout-competence': !!competence, 'profil-incomplet': !!incomplet };
  return <Panneau onglets={onglets.filter((o) => pret[o.cle] !== false)} />;
}
