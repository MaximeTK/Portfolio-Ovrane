'use client';

import './appels.css';
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Activite } from '../../activite/Activite';
import { Dock, Fenetre, usePanneau, useVues, type ArbreDepart } from '../../dock/Dock';
import { ECART } from '../../dock/moteur';
import { Confirmer, MarqueAdmin, Panneau, type Elements, type Onglet } from '../../dock/Panneau';
import { dateUtc, ongletFicheOffre } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import { demarrer, nomEnDirect, oublierAvis, terminer, useDirect, type Avis, type Mode, type Tour } from './direct';

// Ce que /vues/appels rend : les appels, chacun avec son offre en deux parts, et les offres envoyées avec le jour de leur candidature
type LigneAppel = {
  id: number; titre: string; mode: Mode; debut: string; duree_s: number; analyse: boolean; cout: number; fin: string | null;
  offre_cle: string; entreprise: string; intitule: string;
};
type OffreEnvoyee = { cle: string; entreprise: string; titre: string; envoyee_le: string };
type Vue = { appels: LigneAppel[]; offres: OffreEnvoyee[] };
// Ce que /appels/{appel} rend : la transcription nommée, l'analyse et l'offre
type DetailAppel = {
  id: number; titre: string; mode: Mode; debut: string; fin: string | null; offre_cle: string; offre: string; cout: number;
  analyse: string; segments: (Tour & { nom: string })[];
};
type Parametres = { ruby_cle: boolean; ruby_modele_parole: string; ruby_modele: string; modeles: { nom: string; modele?: string }[] };

const TAILLES = [25, 50];
const MODELES_PAROLE = ['universal-streaming-multilingual', 'universal-3-6-pro'];
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const quand = (iso: string) => dateUtc(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const jour = (iso: string) => dateUtc(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const duree = (s: number) => (!s ? "à l'instant" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);
const dollars = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: v > 0 && v < 0.01 ? 4 : 2 })} $`;
const minutes = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const libelleOffre = (o: OffreEnvoyee) => `${o.entreprise} — ${o.titre} · ${jour(o.envoyee_le)}`;

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
const ICONES = {
  reglages: <svg {...TRAIT}><polygon points="22.3,10.2 22.3,13.8 19.4,13.8 18.5,15.9 20.6,18.0 18.0,20.6 15.9,18.5 13.8,19.4 13.8,22.3 10.2,22.3 10.2,19.4 8.1,18.5 6.0,20.6 3.4,18.0 5.5,15.9 4.6,13.8 1.7,13.8 1.7,10.2 4.6,10.2 5.5,8.1 3.4,6.0 6.0,3.4 8.1,5.5 10.2,4.6 10.2,1.7 13.8,1.7 13.8,4.6 15.9,5.5 18.0,3.4 20.6,6.0 18.5,8.1 19.4,10.2" /><circle cx="12" cy="12" r="3" /></svg>,
  plus: <svg {...TRAIT} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
  fleche: <svg {...TRAIT} strokeWidth={2.6}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  coche: <svg {...TRAIT} strokeWidth={2.6}><path d="M5 12l5 5L20 7" /></svg>,
  refaire: <svg {...TRAIT}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>,
  supprimer: <svg {...TRAIT}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  arreter: <svg {...TRAIT}><rect x="6" y="6" width="12" height="12" /></svg>,
};

// Activité | liste | détail | panneau : la part d'une fenêtre cachée revient à la liste ; panneau fermé, liste 48 % et détail 52 %, ouvert, il prend la place du détail
const ARBRE: ArbreDepart = (zone, style) => {
  const lp = parseFloat(style.getPropertyValue('--panneau')) || 440;
  const reste = zone.w - 228 - 2 * ECART;
  return { dir: 'row', enfants: [{ id: 'activite' }, { id: 'appels' }, { id: 'appel' }, { id: 'panneau' }], parts: [228, Math.max(reste * 0.48 - lp, 1), reste * 0.52, lp] };
};

// L'analyse en parties titrées (« RÉSUMÉ — … ») ; sans titre reconnu, le texte tel quel
function parties(texte: string) {
  const lues: { titre: string; corps: string }[] = [];
  for (const brute of texte.split('\n')) {
    const ligne = brute.replace(/^[#*\s]+/, '').replace(/\*\*/g, '');
    const titre = /^([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’ ]{2,}?)\s*(?:—|–|:)\s*(.*)$/.exec(ligne);
    if (titre) lues.push({ titre: titre[1].trim(), corps: titre[2] });
    else if (lues.length) lues[lues.length - 1].corps += `${lues[lues.length - 1].corps ? '\n' : ''}${ligne}`;
    else if (ligne.trim()) return null;
  }
  return lues.length ? lues : null;
}

export default function PageAppels({ compte }: ProprietesPage) {
  const direct = useDirect();
  // Les appels lus et celui choisi restent d'une visite à l'autre : en revenant, ils s'affichent aussitôt et se relisent derrière
  const [vue, setVue] = useState(() => repris<Vue | null>('appels:vue', null));
  const [erreurVue, setErreurVue] = useState('');
  const [choisi, setChoisiEtat] = useState(() => repris<number | null>('appels:choisi', null));
  useGarder('appels', { vue, choisi });
  const [avis, setAvis] = useState<Avis>(null);
  const [version, setVersion] = useState(0);
  const dernierChoisi = useRef(choisi);
  const setChoisi = useCallback((id: number | null) => {
    dernierChoisi.current = id;
    setChoisiEtat(id);
  }, []);
  const relire = useCallback(async () => {
    try {
      const lu = await appeler<Vue>('/vues/appels');
      setVue(lu);
      setErreurVue('');
      // Sans appel choisi, le plus récent des appels clos
      if (dernierChoisi.current === null || !lu.appels.some((a) => a.id === dernierChoisi.current)) setChoisi((lu.appels.find((a) => a.fin) ?? lu.appels[0])?.id ?? null);
    } catch (e) {
      setErreurVue(message(e));
    }
    setVersion((v) => v + 1);
  }, [setChoisi]);
  // Lus à l'arrivée et après chaque geste, comme dans l'ancien dashboard ; l'appel qu'on vient de terminer s'affiche pendant son analyse, puis se relit
  useEffect(() => {
    if (direct.analyse !== null) setChoisi(direct.analyse);
    else void relire();
  }, [direct.analyse, setChoisi, relire]);
  useEffect(() => {
    if (!direct.avis) return;
    setAvis(direct.avis);
    oublierAvis();
  }, [direct.avis]);

  return (
    <Dock id="appels" principal="appels" arbre={ARBRE} panneau={direct.appel ? 'direct' : compte.admin ? 'reglages' : null}
      fenetres={{ appels: { mini: [420, 220], pref: [560, 360], flot: [640, 480] }, appel: { mini: [400, 260], pref: [520, 400], flot: [560, 620] } }}>
      <Activite />
      <Liste vue={vue} erreurVue={erreurVue} choisi={choisi} setChoisi={setChoisi} avis={avis} setAvis={setAvis} />
      <Detail vue={vue} choisi={choisi} version={version} setChoisi={setChoisi} setAvis={setAvis} relire={relire} />
      <PanneauAppels admin={compte.admin} vue={vue} version={version} setAvis={setAvis} relire={relire} />
    </Dock>
  );
}

type ProprietesListe = {
  vue: Vue | null; erreurVue: string; choisi: number | null; setChoisi: (id: number | null) => void; avis: Avis; setAvis: (a: Avis) => void;
};

function Liste({ vue, erreurVue, choisi, setChoisi, avis, setAvis }: ProprietesListe) {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const { focus } = useVues();
  const direct = useDirect();
  // La pagination choisie reste d'une visite à l'autre, avec la mesure « auto »
  const [taille, setTaille] = useState(() => repris<number | 'auto'>('appels:taille', 'auto'));
  const [auto, setAuto] = useState(() => repris('appels:auto', 8));
  const [page, setPage] = useState(() => repris('appels:page', 1));
  useGarder('appels', { taille, auto, page });
  const defile = useRef<HTMLDivElement>(null);

  // Échap ferme le panneau, sauf celui qu'une confirmation a gardé pour elle
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [fermer]);
  // Un avis se lit 3,5 s, une erreur 8 s
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis, setAvis]);
  // « auto » : autant de lignes que le défileur en montre sans en couper une
  useLayoutEffect(() => {
    const zone = defile.current;
    if (!zone) return;
    const mesurer = () => {
      const tete = zone.querySelector('thead')?.getBoundingClientRect().height ?? 34;
      const ligne = zone.querySelector('tbody tr')?.getBoundingClientRect().height || 46;
      setAuto(Math.max(1, Math.floor((zone.clientHeight - tete) / ligne)));
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(zone);
    return () => observateur.disconnect();
  }, []);

  const appels = vue?.appels ?? [];
  const parPage = taille === 'auto' ? auto : taille;
  const pages = Math.max(1, Math.ceil(appels.length / parPage));
  const courante = Math.min(page, pages);
  const visibles = appels.slice((courante - 1) * parPage, courante * parPage);

  // L'appel en cours rouvre son direct ; un autre va dans la fenêtre en plus qui a le focus, sinon s'affiche à la place du panneau
  const ouvrirLigne = (a: LigneAppel) => {
    if (direct.appel?.id === a.id) {
      ouvrir('direct');
      return;
    }
    if (focus !== 'panneau') {
      ouvrir('appel', String(a.id));
      return;
    }
    setChoisi(a.id);
    fermer();
  };

  return (
    <Fenetre id="appels" as="main" className="tableau liste-appels" aria-label="Appels" titrePrise="Glisser pour détacher la liste des appels">
      <div className="outils">
        <p className="note-outils">Seul le texte est gardé, jamais l&apos;audio : prévenez votre interlocuteur que l&apos;appel est transcrit.</p>
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          <button type="button" className={`action${onglet === 'reglages' ? ' allume' : ''}`} title="Réglages" aria-haspopup="dialog" aria-expanded={onglet === 'reglages'} onClick={() => ouvrir('reglages')}>
            <span className="ico">{ICONES.reglages}</span><span className="txt">Réglages</span>
          </button>
          <button type="button" className="action plein" aria-haspopup="dialog" aria-expanded={onglet === 'nouvel' || onglet === 'direct'} onClick={() => ouvrir(direct.appel ? 'direct' : 'nouvel')}>
            Nouvel appel<span className="ico">{ICONES.plus}</span>
          </button>
        </div>
      </div>
      <div className="defile" ref={defile}>
        <table>
          <thead><tr><th>Quand</th><th>Appel</th><th>Durée</th><th>Coût</th><th aria-label="Analyse" /></tr></thead>
          <tbody>
            {visibles.map((a) => {
              const enDirect = direct.appel?.id === a.id;
              const classe = (enDirect && onglet === 'direct') || (onglet === 'appel' && objet === String(a.id)) ? 'ouverte' : onglet === null && a.id === choisi ? 'choisi' : '';
              const offre = [a.entreprise, a.intitule].filter(Boolean).join(' · ');
              return (
                <tr key={a.id} className={classe} tabIndex={0} aria-selected={classe !== ''} title={enDirect ? 'Voir la transcription en direct' : undefined} data-ouvre="appel" data-objet={a.id}
                  onClick={() => ouvrirLigne(a)} onKeyDown={(e) => e.key === 'Enter' && ouvrirLigne(a)}>
                  <td className="mono d">{quand(a.debut)}</td>
                  <td><span className="t-appel" title={a.titre || 'Appel'}>{a.titre || 'Appel'}</span><span className={`offre-appel${offre ? '' : ' sans'}`} title={offre || undefined}>{offre || 'aucune offre'}</span></td>
                  <td className="d">{a.fin ? duree(a.duree_s) : <span className="direct-c">en cours</span>}</td>
                  <td className="mono d">{a.fin ? dollars(a.cout) : '—'}</td>
                  <td>{a.analyse && <span className="analyse-faite">analysé</span>}</td>
                </tr>
              );
            })}
            {vue && !appels.length && <tr className="vide-f"><td colSpan={5}>Aucun appel enregistré : démarrez le premier par « Nouvel appel ».</td></tr>}
          </tbody>
        </table>
      </div>
      {(avis || erreurVue) && (
        <p className={`avis-appels${avis?.erreur || (!avis && erreurVue) ? ' erreur' : ''}`} role={avis?.erreur || (!avis && erreurVue) ? 'alert' : 'status'} onClick={() => setAvis(null)}>
          {avis?.texte ?? erreurVue}
        </p>
      )}
      <div className="pagination">
        <select aria-label="Lignes par page" value={String(taille)} onChange={(e) => { setTaille(e.target.value === 'auto' ? 'auto' : Number(e.target.value)); setPage(1); }}>
          <option value="auto">auto ({auto})</option>
          {TAILLES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <nav className="pages" aria-label="Pages">
          <button type="button" className="pl" disabled={courante <= 1} aria-label="Page précédente" onClick={() => setPage(courante - 1)}>‹</button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={`pl${n === courante ? ' actif' : ''}`} aria-current={n === courante ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button type="button" className="pl" disabled={courante >= pages} aria-label="Page suivante" onClick={() => setPage(courante + 1)}>›</button>
        </nav>
        <span className="espace" />
        <span className="compteur">{vue ? `${appels.length} appel${appels.length > 1 ? 's' : ''}` : ''}</span>
      </div>
    </Fenetre>
  );
}

type ProprietesDetail = { vue: Vue | null; choisi: number | null; version: number; setChoisi: (id: number | null) => void; setAvis: (a: Avis) => void; relire: () => Promise<void> };

// L'appel choisi au clic gauche ; le panneau ouvert prend sa place
function Detail({ vue, choisi, version, setChoisi, setAvis, relire }: ProprietesDetail) {
  const { onglet } = usePanneau();
  return (
    <Fenetre id="appel" className="detail-appel" hidden={onglet !== null} aria-label="Appel choisi" titrePrise="Glisser pour détacher l'appel choisi">
      {choisi === null ? (
        <div className="appel-d"><p className="vide-appel"><b>Aucun appel choisi.</b>Choisissez un appel dans la liste, ou démarrez-en un.</p></div>
      ) : <ContenuAppel key={choisi} id={choisi} vue={vue} version={version} setAvis={setAvis} relire={relire} supprime={() => setChoisi(null)} />}
    </Fenetre>
  );
}

type ProprietesContenu = { id: number; vue: Vue | null; version: number; setAvis: (a: Avis) => void; relire: () => Promise<void>; supprime: () => void };

// Un appel, dans la fenêtre de l'appel choisi ou dans une fenêtre à lui : titre, offre, noms des voix, transcription, analyse ; sa confirmation et ses gestes sont les siens
function ContenuAppel({ id, vue, version, setAvis, relire, supprime }: ProprietesContenu) {
  const { ouvrir } = usePanneau();
  const direct = useDirect();
  const [detail, setDetail] = useState<DetailAppel | null>(null);
  const [erreur, setErreur] = useState('');
  const [titre, setTitre] = useState('');
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [geste, setGeste] = useState<'clore' | 'analyser' | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const base = useId();
  const analyseEnCours = direct.analyse === id;

  const montrer = useCallback((d: DetailAppel) => {
    setDetail(d);
    setTitre(d.titre);
    // Le micro d'abord, puis le son de l'appel, chaque piste par lettre
    setNoms(Object.fromEntries(d.segments.map((s) => [`${s.piste}:${s.locuteur || ''}`, s.nom])
      .sort(([a], [b]) => Number(a.startsWith('appel')) - Number(b.startsWith('appel')) || a.localeCompare(b))));
  }, []);
  useEffect(() => {
    if (analyseEnCours) return;
    let vivant = true;
    appeler<DetailAppel>(`/appels/${id}`).then((d) => {
      if (!vivant) return;
      montrer(d);
      setErreur('');
    }).catch((e) => {
      if (!vivant) return;
      setDetail(null);
      setErreur(message(e));
    });
    return () => {
      vivant = false;
    };
  }, [id, version, analyseEnCours, montrer]);

  const lu = detail && detail.id === id ? detail : null;
  const modifier = async (corps: Record<string, unknown>, texte: string) => {
    if (!lu) return;
    try {
      montrer(await appeler<DetailAppel>(`/appels/${lu.id}`, { methode: 'PUT', corps }));
      setAvis({ texte });
      await relire();
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    }
  };
  const faire = async (quoi: 'clore' | 'analyser', action: (appel: DetailAppel) => Promise<string>) => {
    if (!lu) return;
    setGeste(quoi);
    try {
      setAvis({ texte: await action(lu) });
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    } finally {
      setGeste(null);
      await relire();
    }
  };
  const clore = () => faire('clore', async (a) => {
    // La durée facturée est perdue avec la page : celle de la transcription la remplace, sur chaque piste ouverte
    const secondes = Math.max(0, ...a.segments.map((s) => s.fin)) / 1000;
    await appeler(`/appels/${a.id}/fin`, { methode: 'POST', corps: { secondes: secondes * (a.mode === 'pc' ? 2 : 1), secondes_voix: secondes, analyser: a.segments.length > 0 } });
    return 'Appel clos.';
  });
  const analyser = () => faire('analyser', async (a) => {
    montrer(await appeler<DetailAppel>(`/appels/${a.id}/analyse`, { methode: 'POST' }));
    return 'Analyse rédigée.';
  });
  const supprimer = async () => {
    setOccupe(true);
    try {
      await appeler(`/appels/${id}`, { methode: 'DELETE' });
      supprime();
      setAvis({ texte: 'Appel effacé, avec sa transcription et son analyse.' });
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    } finally {
      setOccupe(false);
      setConfirmer(false);
      await relire();
    }
  };

  const voix = Object.keys(noms);
  const offres = vue?.offres ?? [];
  const ligne = vue?.appels.find((a) => a.id === lu?.id);
  const lues = lu?.analyse ? parties(lu.analyse) : null;
  const enDirect = lu !== null && direct.appel?.id === lu.id;

  return (
    <div className="appel-d">
      {analyseEnCours ? (
        <p className="vide-appel" role="status"><b>Analyse de la conversation…</b>Elle prend une minute au plus.</p>
      ) : erreur ? (
        <p className="vide-appel" role="alert"><b>Appel illisible.</b>{erreur}</p>
      ) : !lu ? (
        <p className="vide-appel"><b>Lecture de l’appel…</b></p>
      ) : (
        <>
          <div className="tete-appel">
            <input className="titre-appel" value={titre} placeholder="Titre de l'appel" aria-label="Titre de l'appel" onChange={(e) => setTitre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              onBlur={() => titre.trim() !== lu.titre && void modifier({ titre }, 'Titre enregistré.')} />
            <p className="meta-appel">
              {[quand(lu.debut), lu.mode === 'pc' ? 'sur PC' : 'au téléphone', ligne?.fin ? duree(ligne.duree_s) : 'en cours', lu.fin ? dollars(lu.cout) : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="champ">
            <span className="lib-offre">
              <label htmlFor={`${base}-offre`}>Offre concernée</label>
              {lu.offre_cle && <button type="button" className="lien-d" aria-haspopup="dialog" data-ouvre="fiche-offre" data-objet={lu.offre_cle} onClick={() => ouvrir('fiche-offre', lu.offre_cle)}>Voir la fiche</button>}
            </span>
            <select id={`${base}-offre`} className="saisie" value={lu.offre_cle} onChange={(e) => void modifier({ offre_cle: e.target.value }, 'Appel rattaché.')}>
              <option value="">— aucune offre —</option>
              {lu.offre_cle && !offres.some((o) => o.cle === lu.offre_cle) && (
                <option value={lu.offre_cle}>{ligne?.entreprise ? `${ligne.entreprise} — ${ligne.intitule}` : lu.offre || lu.offre_cle}</option>
              )}
              {offres.map((o) => <option key={o.cle} value={o.cle}>{libelleOffre(o)}</option>)}
            </select>
          </div>
          {voix.length > 0 && (
            <form className="voix-appel" aria-label="Noms des voix" onSubmit={(e) => { e.preventDefault(); void modifier({ locuteurs: noms }, 'Noms des voix enregistrés.'); }}>
              {voix.map((cle) => {
                const [piste, lettre] = cle.split(':');
                return (
                  <div key={cle} className="champ">
                    <label htmlFor={`${base}-voix-${cle}`}>{piste === 'appel' ? "Son de l'appel" : 'Micro'}{lettre ? ` · voix ${lettre}` : ''}</label>
                    <input id={`${base}-voix-${cle}`} className="saisie" value={noms[cle]} onChange={(e) => setNoms((n) => ({ ...n, [cle]: e.target.value }))} />
                  </div>
                );
              })}
              <button type="submit" className="action">Enregistrer les noms</button>
            </form>
          )}
          <div className="defile-appel">
            <h3 className="etiquette">Transcription</h3>
            {lu.segments.length ? (
              <ol className="transcription">
                {lu.segments.map((s) => (
                  <li key={`${s.piste}-${s.ordre}`}>
                    <time>{minutes(s.debut)}</time>
                    <b className={(lu.mode === 'pc' && s.piste === 'micro') || s.nom === 'Moi' ? 'v-moi' : 'v-autre'}>{s.nom}</b>{s.texte}
                  </li>
                ))}
              </ol>
            ) : <p className="texte-f">Rien n&apos;a été transcrit.</p>}
            <h3 className="etiquette">Analyse</h3>
            {lues ? (
              <dl className="analyse">{lues.map((p, i) => <Fragment key={i}><dt>{p.titre}</dt><dd>{p.corps}</dd></Fragment>)}</dl>
            ) : lu.analyse ? <p className="analyse-brute">{lu.analyse}</p> : <p className="texte-f">Pas encore d&apos;analyse.</p>}
          </div>
          {confirmer && (
            <Confirmer question="Supprimer l'appel ?" detail="Sa transcription et son analyse sont effacées." action="Supprimer"
              occupe={occupe} onAnnuler={() => setConfirmer(false)} onConfirmer={() => void supprimer()} />
          )}
          <div className="pied-appel">
            {!lu.fin && !enDirect && (
              <button type="button" className="action plein" disabled={geste !== null}
                title="L'appel s'est interrompu sans « Terminer » (onglet fermé, coupure) : il se clôt sur la durée de sa transcription, estimée à son dernier tour de parole."
                onClick={() => void clore()}>
                {geste === 'clore' ? 'Clôture…' : "Clore l'appel"}<span className="ico">{ICONES.coche}</span>
              </button>
            )}
            <button type="button" className="action" disabled={!lu.segments.length || geste !== null || enDirect} onClick={() => void analyser()}>
              <span className="ico">{ICONES.refaire}</span>{geste === 'analyser' ? 'Analyse en cours…' : lu.analyse ? "Refaire l'analyse" : 'Analyser'}
            </button>
            <button type="button" className="action rouge" aria-haspopup="dialog" disabled={enDirect} onClick={() => setConfirmer(true)}>
              <span className="ico">{ICONES.supprimer}</span>Supprimer l&apos;appel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Le panneau : les éléments (un appel, la fiche de son offre), puis Nouvel appel ou En direct, et les Réglages
function PanneauAppels({ admin, vue, version, setAvis, relire }: { admin: boolean; vue: Vue | null; version: number; setAvis: (a: Avis) => void; relire: () => Promise<void> }) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const ouverts = useVues().vues[0].objets;
  const direct = useDirect();
  const reglages = useOngletReglages(admin, onglet === 'reglages', fermer, setAvis);
  const nouvel = useOngletNouvel(vue, () => {
    ouvrir('direct');
    void relire();
  }, fermer);
  // L'appel terminé, son direct disparaît : le panneau se ferme et rend la place au détail
  useEffect(() => {
    if (onglet === 'direct' && !direct.appel) fermer();
  }, [onglet, direct.appel, fermer]);
  const elements: Elements = {
    appel: (n) => {
      const ligne = vue?.appels.find((a) => String(a.id) === n);
      // Effacé, l'appel ne se montre plus
      return vue && !ligne ? null : {
        cle: 'appel', titre: ligne ? `Appel · ${quand(ligne.debut)}` : 'Appel', label: `Appel · ${ligne?.titre || 'sans titre'}`,
        corps: <ContenuAppel id={Number(n)} vue={vue} version={version} setAvis={setAvis} relire={relire} supprime={fermer} />,
      };
    },
    'fiche-offre': (c) => ongletFicheOffre(c),
  };
  // Un élément ouvert : les onglets des actions ne restent que s'ils sont ouverts, leur bouton de la liste les rouvre
  const parGeste = Object.keys(elements).some((c) => ouverts[c] !== undefined);
  const onglets = [direct.appel ? ongletDirect() : nouvel, reglages].filter((o) => !parGeste || o.cle === onglet);
  return <Panneau elements={elements} onglets={onglets} />;
}

function useOngletNouvel(vue: Vue | null, demarre: () => void, fermer: () => void): Onglet {
  const [mode, setMode] = useState<Mode>('pc');
  const [offre, setOffre] = useState('');
  const [titre, setTitre] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const lancer = async (e: React.FormEvent) => {
    e.preventDefault();
    setOccupe(true);
    setErreur('');
    try {
      await demarrer({ mode, offre_cle: offre, titre: titre.trim() });
      setTitre('');
      demarre();
    } catch (err) {
      setErreur(message(err));
    } finally {
      setOccupe(false);
    }
  };
  return {
    cle: 'nouvel', titre: 'Nouvel appel',
    corps: (
      <form id="nouvel-appel" className="ruby-f" aria-label="Nouvel appel" onSubmit={lancer}>
        {erreur && <p className="avis-f erreur" role="alert">{erreur}</p>}
        <div className="champ"><span className="lib-champ" id="lieu-appel">Où se passe l&apos;appel</span>
          <div className="lieux-f" role="radiogroup" aria-labelledby="lieu-appel">
            <label className="choix lieu-f"><input type="radio" name="lieu-appel" className="cache" checked={mode === 'pc'} onChange={() => setMode('pc')} />
              <b>Sur le PC (Meet, Teams, Zoom…)</b><small>micro + son de l&apos;appel</small></label>
            <label className="choix lieu-f"><input type="radio" name="lieu-appel" className="cache" checked={mode === 'telephone'} onChange={() => setMode('telephone')} />
              <b>Téléphone en haut-parleur</b><small>micro seul</small></label>
          </div>
        </div>
        <div className="champ"><label htmlFor="nouvel-offre">Offre concernée</label>
          <select id="nouvel-offre" className="saisie" value={offre} onChange={(e) => setOffre(e.target.value)}>
            <option value="">— aucune offre —</option>
            {(vue?.offres ?? []).map((o) => <option key={o.cle} value={o.cle}>{libelleOffre(o)}</option>)}
          </select>
        </div>
        <div className="champ"><label htmlFor="nouvel-titre">Titre</label>
          <input id="nouvel-titre" className="saisie" placeholder="Premier échange RH" value={titre} onChange={(e) => setTitre(e.target.value)} />
        </div>
        <p className="aide-champ">Sur le PC, le navigateur demande quel onglet ou quel écran partager : choisissez celui de l&apos;appel et cochez « Partager l&apos;audio ». Un casque évite que le micro reprenne la voix de l&apos;interlocuteur.</p>
      </form>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={fermer}>Annuler</button>
        <button type="submit" form="nouvel-appel" className="action plein" disabled={occupe}>{occupe ? 'Ouverture…' : "Démarrer l'enregistrement"}<span className="ico">{ICONES.fleche}</span></button>
      </>
    ),
  };
}

function ongletDirect(): Onglet {
  return { cle: 'direct', titre: 'En direct', label: 'Appel en cours', corps: <EnDirect />, pied: <PiedDirect /> };
}

// La transcription qui arrive : les tours finis, puis la phrase en cours, estompée
function EnDirect() {
  const direct = useDirect();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const liste = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    liste.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [direct.tours.length, direct.partiels]);
  const appel = direct.appel;
  if (!appel) return null;
  const mode = appel.mode;
  return (
    <div className="ruby-f">
      <p className="live-tete"><span className="voyant-live" aria-hidden="true" /><span className="live-titre">{appel.titre || 'Appel'} — transcription en cours</span>
        <time aria-label="Durée de l'appel">{minutes(Math.max(0, maintenant - direct.debut))}</time></p>
      <p className="meta-f">{[mode === 'pc' ? "Sur le PC · micro et son de l'appel" : 'Téléphone en haut-parleur · micro seul, voix séparées', appel.offre].filter(Boolean).join(' · ')}</p>
      {/* Dite à voix haute, l'annonce entre dans la transcription avec la réponse : prévenu, l'interlocuteur qui ne s'y oppose pas
          est présumé d'accord (C. pén., art. 226-1) ; s'il refuse, on termine l'appel et on le supprime */}
      <p className="aide-champ">À dire en premier : « Je prends des notes avec un outil de transcription, cela vous convient ? » S&apos;il refuse, terminez l&apos;appel puis supprimez-le.</p>
      <ol className="tours-direct" ref={liste} aria-live="polite">
        {direct.tours.map((t) => (
          <li key={`${t.piste}-${t.ordre}`}><b className={mode === 'pc' && t.piste === 'micro' ? 'v-moi' : 'v-autre'}>{nomEnDirect(t.piste, t.locuteur, mode)}</b>{t.texte}</li>
        ))}
        {direct.partiels.map((p) => (
          <li key={`partiel-${p.piste}`} className="partiel"><b className={mode === 'pc' && p.piste === 'micro' ? 'v-moi' : 'v-autre'}>{mode === 'pc' && p.piste === 'micro' ? 'Moi' : '…'}</b>
            {p.texte}<span className="points" aria-hidden="true"><i /><i /><i /></span></li>
        ))}
        {!direct.tours.length && !direct.partiels.length && <li className="partiel">En attente de la première phrase…</li>}
      </ol>
    </div>
  );
}

function PiedDirect() {
  const direct = useDirect();
  return (
    <>
      <span className="aide-champ gauche">Seul le texte est gardé.</span>
      <button type="button" className="action rouge" disabled={direct.cloture} onClick={() => void terminer()}>
        <span className="ico">{ICONES.arreter}</span>{direct.cloture ? 'Clôture…' : "Terminer l'appel"}
      </button>
    </>
  );
}

// Réglages · Appels : la clé AssemblyAI et le modèle de transcription du compte ; le modèle de l'analyse, celui du serveur, pour l'admin
function useOngletReglages(admin: boolean, actif: boolean, fermer: () => void, setAvis: (a: Avis) => void): Onglet {
  // Les réglages lus restent d'une visite à l'autre : la saisie en repart aussitôt, puis ils se relisent à l'ouverture
  const [lus, setLus] = useState(() => repris<Parametres | null>('appels:reglages', null));
  const [cle, setCle] = useState('');
  const [parole, setParole] = useState(() => lus?.ruby_modele_parole ?? '');
  const [modele, setModele] = useState(() => lus?.ruby_modele ?? '');
  useGarder('appels', { reglages: lus });
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const prendre = (p: Parametres) => {
    setLus(p);
    setCle('');
    setParole(p.ruby_modele_parole);
    setModele(p.ruby_modele);
  };
  // Relus à chaque ouverture : un autre onglet a pu les changer
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    appeler<Parametres>('/parametres').then((p) => {
      if (!vivant) return;
      prendre(p);
      setErreur('');
    }).catch((e) => vivant && setErreur(message(e)));
    return () => {
      vivant = false;
    };
  }, [actif]);
  const changes = lus ? {
    ...(cle ? { ruby_cle: cle } : {}),
    ...(parole !== lus.ruby_modele_parole ? { ruby_modele_parole: parole } : {}),
    ...(admin && modele !== lus.ruby_modele ? { ruby_modele: modele } : {}),
  } : {};
  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Object.keys(changes).length) return;
    setOccupe(true);
    try {
      prendre(await appeler<Parametres>('/parametres', { methode: 'PUT', corps: changes }));
      setErreur('');
      setAvis({ texte: 'Réglages des appels enregistrés.' });
    } catch (err) {
      setErreur(message(err));
    } finally {
      setOccupe(false);
    }
  };
  const modeles = (lus?.modeles ?? []).map((m) => ({ nom: m.nom, texte: m.modele ? `${m.nom} · ${m.modele}` : m.nom }));
  if (modele && !modeles.some((m) => m.nom === modele)) modeles.push({ nom: modele, texte: `${modele} (absent du catalogue)` });
  return {
    cle: 'reglages', titre: 'Réglages', label: 'Réglages · Appels',
    corps: (
      <form id="reglages-appels" className="ruby-f" aria-label="Réglages · Appels" onSubmit={enregistrer}>
        {erreur && <p className="avis-f erreur" role="alert">{erreur}</p>}
        {!lus && !erreur && <p className="texte-f">Lecture des réglages…</p>}
        {lus && (
          <div className="section-f"><h3>RUBY</h3>
            <div className="champ"><label htmlFor="ruby-cle">Clé AssemblyAI</label>
              <input id="ruby-cle" className="saisie" type="password" autoComplete="off" placeholder={lus.ruby_cle ? 'enregistrée' : 'non renseignée'} value={cle} onChange={(e) => setCle(e.target.value)} />
              <p className="aide-champ">Sur assemblyai.com : 50 $ offerts à l&apos;inscription, soit environ 180 heures d&apos;appels en multilingual.</p>
            </div>
            <div className="champ"><label htmlFor="ruby-parole">Modèle de transcription</label>
              <select id="ruby-parole" className="saisie" value={parole} onChange={(e) => setParole(e.target.value)}>
                {MODELES_PAROLE.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <p className="aide-champ">Multilingual : 0,15 $/h, français, anglais, espagnol, allemand, italien, portugais. 3.6 Pro : 0,45 $/h, plus précis sur un haut-parleur de téléphone. Séparer les voix ajoute 0,12 $/h.</p>
            </div>
            {admin && (
              <div className="champ"><label htmlFor="ruby-modele">Modèle de l&apos;analyse<MarqueAdmin /></label>
                <select id="ruby-modele" className="saisie" value={modele} onChange={(e) => setModele(e.target.value)}>
                  <option value="">— celui des mails —</option>
                  {modeles.map((m) => <option key={m.nom} value={m.nom}>{m.texte}</option>)}
                </select>
                <p className="aide-champ">Celui qui lit la transcription et en tire le résumé, les questions, les engagements et ce qu&apos;il reste à faire. Vide : celui des mails.</p>
              </div>
            )}
          </div>
        )}
      </form>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={() => { if (lus) prendre(lus); fermer(); }}>Annuler</button>
        <button type="submit" form="reglages-appels" className="action plein" disabled={!Object.keys(changes).length || occupe}>Enregistrer<span className="ico">{ICONES.coche}</span></button>
      </>
    ),
  };
}
