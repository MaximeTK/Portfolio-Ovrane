'use client';

import '../offres/offres.css';
import './veille.css';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Activite } from '../../activite/Activite';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { AuPied, MarqueAdmin, Panneau, type Onglet } from '../../dock/Panneau';
import type { ProprietesPage } from '../liste';
import {
  ICONES, SOURCES, dateDe, enregistrerReglages, heure, jourMois, libelleSource, message, useAvis, useEtatVeille, useGestesStock, useProfilsVeille,
  type Cycle, type Jobboard, type Parametres,
} from '../offres/commun';

// Les clés de chaque plateforme, une fois pour toutes les veilles ; les boards employeurs se règlent en nombre
type Champ = { cle: string; libelle: string; nombre?: boolean };
const CLES: Record<string, Champ[]> = {
  france_travail: [{ cle: 'veille_ft_id', libelle: 'Identifiant' }, { cle: 'veille_ft_secret', libelle: 'Secret' }],
  adzuna: [{ cle: 'veille_adzuna_id', libelle: 'app_id' }, { cle: 'veille_adzuna_key', libelle: 'app_key' }],
  jooble: [{ cle: 'veille_jooble_key', libelle: "Clé d'API" }],
  ats: [{ cle: 'veille_ats_par_cycle', libelle: 'Boards par cycle', nombre: true }],
};
const AIDE_ATS = "Un appel rend tout le board d'une entreprise, et un board inchangé répond 304 : le coût se compte en entreprises, pas en offres. 0 : source éteinte.";

// Le voyant d'une source : ce que le dernier cycle en a obtenu
function voyant(nom: string, cycle: Cycle): [string, string] {
  const source = cycle.sources?.find((s) => s.nom === nom);
  const passage = cycle.passages?.find((p) => p.source === nom);
  if (!source && !passage) return ['muette', 'jamais interrogée'];
  if (source?.active === false) return ['muette', 'désactivée'];
  if (source?.prete === false) return ['jaune', `clés manquantes : ${(source.manquantes ?? []).join(', ')}`];
  if (source?.bloquee) return ['jaune', source.bloquee];
  if (!passage) return ['rouge', 'aucune réponse au dernier cycle'];
  // Rien à faire n'est pas rien obtenu : les boards employeurs se nourrissent des pages « nos offres » que le parser trouve
  if (passage.sans_objet) return ['muette', passage.erreur || 'rien à interroger'];
  if (passage.erreur) return ['jaune', passage.erreur];
  if (!passage.statut) return ['rouge', 'aucune réponse au dernier cycle'];
  if (passage.statut >= 400) return ['jaune', `réponse HTTP ${passage.statut}`];
  if (!passage.vues) {
    const derniere = cycle.dernieres_offres?.[nom];
    return ['violette', derniere ? `aucune offre depuis le ${jourMois(derniere)}` : 'a répondu, aucune offre encore vue'];
  }
  const lues = passage.lues ?? 0;
  return ['verte', `HTTP ${passage.statut} · ${lues} retenue${lues > 1 ? 's' : ''}`];
}

function etatCles(nom: string, p: Parametres | null) {
  const champs = CLES[nom] ?? [];
  if (!champs.length) return 'sans clé';
  if (champs[0].nombre) return `${p?.veille_ats_par_cycle ?? 0} boards par cycle`;
  const posees = champs.filter((c) => p?.[c.cle] === true);
  if (posees.length === champs.length) return champs.length > 1 ? 'clés enregistrées' : 'clé enregistrée';
  if (!posees.length) return champs.length > 1 ? 'clés non renseignées' : 'clé non renseignée';
  return `${posees.map((c) => c.libelle).join(', ')} seule`;
}

export default function PageVeille(_: ProprietesPage) {
  return (
    <Dock id="veille" principal="veille" panneau="plateforme">
      <Activite />
      <Veille />
    </Dock>
  );
}

function Veille() {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const { dire, vue: avis } = useAvis();
  const [etat, relire] = useEtatVeille(dire);
  const gestes = useGestesStock(etat, relire, dire, () => {});
  // Les réglages lus restent d'une visite à l'autre, comme l'état de la veille (gardé par son crochet)
  const [parametres, setParametres] = useState(() => repris<Parametres | null>('veille:parametres', null));
  useGarder('veille', { parametres });
  // L'onglet « Nouveau jobboard », de « Ajouter un jobboard » jusqu'à l'ajout
  const [ajoutJb, setAjoutJb] = useState(false);

  // Le panneau s'ouvre sur France Travail : le dock ne pose que la sorte
  useEffect(() => {
    if (onglet === 'plateforme' && objet === null) ouvrir('plateforme', 'france_travail');
  }, [onglet, objet, ouvrir]);

  useEffect(() => {
    appeler<Parametres>('/parametres').then(setParametres, (e) => dire(message(e), true));
  }, [dire]);
  const enregistrer = useCallback(async (modifs: Partial<Parametres>) => {
    const r = await enregistrerReglages(modifs, dire);
    if (r) setParametres(r);
    return !!r;
  }, [dire]);
  const veilles = useProfilsVeille(parametres, enregistrer);
  const reglages = useReglages(parametres, enregistrer);

  const { confirmer, fermerVider } = gestes;
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || (e.target as Element | null)?.closest?.('.confirmer')) return;
      if (confirmer) fermerVider();
      else if (onglet) fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [confirmer, fermerVider, onglet, fermer]);

  const basculer = async () => {
    const armee = etat?.rotation_armee;
    try {
      await appeler(armee ? '/veille/arreter' : '/veille/cycle', { methode: 'POST' });
      dire(armee ? 'Veille arrêtée — la passe en cours est interrompue.' : `Veille démarrée : une passe part, puis une toutes les ${etat?.rotation_minutes ?? 15} min.`);
    } catch (e) {
      dire(message(e), true);
    }
    relire();
    window.setTimeout(relire, 1500);
  };
  const recolter = async () => {
    try {
      const r = await appeler<{ lancee: boolean; occupee_par?: string }>('/briques/jobboards/lancer', { methode: 'POST' });
      dire(r.lancee ? 'Récolte des jobboards lancée : le journal la suit.' : `Récolte refusée : ${r.occupee_par || 'jobboards'} tourne déjà.`, !r.lancee);
    } catch (e) {
      dire(message(e), true);
    }
  };
  const basculerJobboard = (rang: number, actif: boolean) => enregistrer({ jobboards: (parametres?.jobboards ?? []).map((j, i) => (i === rang ? { ...j, actif } : j)) });

  const cycle = etat?.cycle ?? {};
  const date = cycle.date ? dateDe(cycle.date) : null;
  const retenues = (cycle.passages ?? []).reduce((n, p) => n + (p.lues ?? 0), 0);
  const prochain = etat?.prochain_dans != null ? heure(new Date(Date.now() + etat.prochain_dans * 1000)) : '';
  const enCours = !!etat?.en_cours;
  const ecoute = enCours || !!etat?.rotation_armee;
  const jobboards = parametres?.jobboards ?? [];

  // Les formulaires posent leurs boutons dans le pied : le pied rendu est vide
  const onglets: Onglet[] = [
    { cle: 'reglages', titre: 'Réglages', label: 'Réglages · Veille', corps: reglages.corps, pied: reglages.pied },
    ...(ajoutJb ? [{ cle: 'ajout-jobboard', titre: 'Nouveau jobboard', label: 'Nouveau jobboard',
      corps: <EditionJobboard origine={null} liste={jobboards} enregistrer={enregistrer} ajoute={() => setAjoutJb(false)} />, pied: true }] : []),
    { cle: 'veilles', titre: 'Veilles', label: 'Profils de veille', corps: veilles.corps, pied: veilles.pied },
  ];
  // Une plateforme par son nom, un jobboard par son adresse ; chaque fenêtre a sa saisie
  const elements = {
    plateforme: (nom: string): Onglet => ({
      cle: 'plateforme', titre: libelleSource(nom), label: `Plateforme · ${libelleSource(nom)}`,
      corps: <Plateforme nom={nom} parametres={parametres} cycle={cycle} enregistrer={enregistrer} />, pied: !!CLES[nom]?.length,
    }),
    jobboard: (url: string): Onglet => {
      const j = jobboards.find((x) => x.url === url);
      if (!j) return { cle: 'jobboard', titre: 'Jobboard', corps: <p className="texte-f">{parametres ? `${url} n'est plus dans la liste.` : 'Lecture des jobboards…'}</p> };
      const titre = `Jobboard · ${j.nom || j.url.replace(/^https?:\/\/(www\.)?/i, '')}`;
      return { cle: 'jobboard', titre, label: titre, corps: <EditionJobboard origine={j} liste={jobboards} enregistrer={enregistrer} />, pied: true };
    },
  };

  return (
    <>
      <Fenetre id="veille" as="div" className="tableau" aria-label="Veille" titrePrise="Glisser pour détacher la veille">
        <div className="outils">
          <span className="filtre etat-v">
            <span>
              <span className="lib">Veille</span>
              <span className={`onde${ecoute ? ' on' : ''}`}>
                <span className={`barres${enCours ? ' vivant' : ''}`} aria-hidden="true"><i /><i /><i /><i /></span>
                {enCours ? `en cours${etat?.etape ? ` · ${etat.etape}` : ''}` : ecoute ? 'en écoute' : "à l'arrêt"}
              </span>
            </span>
            {etat && (
              <span className="d">
                {etat.rotation_minutes ? `toutes les ${etat.rotation_minutes} min` : 'à la demande'}{prochain && <span className="prochain"> · prochain cycle {prochain}</span>}
              </span>
            )}
          </span>
          <span className="espace" />
          <div className="actions" role="group" aria-label="Actions">
            <button type="button" className="action repli-2" title={gestes.titreTri} onClick={gestes.etiquettes}>
              <span className="ico">{ICONES.etiquettes}</span><span className="txt">{gestes.libelleTri}</span>
            </button>
            <button type="button" className="action alerte repli-2" title="Efface le stock d'offres. Les fiches entreprises restent." aria-haspopup="dialog" aria-expanded={confirmer} onClick={gestes.ouvrirVider}>
              <span className="ico">{ICONES.vider}</span><span className="txt">Vider les offres</span>
            </button>
            <button type="button" className={`action repli-1${onglet === 'veilles' ? ' allume' : ''}`} title="Profils de veille" aria-haspopup="dialog" aria-expanded={onglet === 'veilles'} onClick={() => ouvrir('veilles')}>
              <span className="ico">{ICONES.veilles}</span><span className="txt">Profils de veille</span>
            </button>
            <button type="button" className={`action repli-1${onglet === 'reglages' ? ' allume' : ''}`} title="Réglages" aria-haspopup="dialog" aria-expanded={onglet === 'reglages'} onClick={() => ouvrir('reglages')}>
              <span className="ico">{ICONES.reglages}</span><span className="txt">Réglages</span>
            </button>
            <button type="button" className="action plein" title="Démarrer / Arrêter la veille" disabled={!etat} onClick={basculer}>
              <span className="txt">{etat?.rotation_armee ? 'Arrêter la veille' : 'Démarrer la veille'}</span><span className="ico">{etat?.rotation_armee ? ICONES.arret : ICONES.marche}</span>
            </button>
          </div>
        </div>
        {gestes.barre}
        <div className="veille-corps">
          {cycle.ok === false && (
            <div className="bandeau-echec" role="status">
              <p><b>Dernier cycle en échec</b> : {cycle.erreur || 'sans motif'}{date && <span className="d"> · {heure(date)}</span>}</p>
              {cycle.journal && (
                <details className="sortie">
                  <summary>Sortie de la brique{ICONES.chevron}</summary>
                  <pre>{cycle.journal}</pre>
                </details>
              )}
            </div>
          )}
          <section className="bloc-v" aria-label="Plateformes">
            <div className="bloc-tete">
              <h3 className="etiquette">Plateformes</h3>
              <span className="compteur">{Object.keys(SOURCES).length} sources{date ? ` · dernier cycle ${heure(date)} · ${retenues} offres` : ' · aucun cycle encore'}</span>
            </div>
            <div className="grille-pf">
              {Object.keys(SOURCES).map((nom) => {
                const [teinte, motif] = voyant(nom, cycle);
                const passage = cycle.passages?.find((p) => p.source === nom);
                const muet = teinte === 'muette' || motif.startsWith('clés manquantes');
                return (
                  <button
                    key={nom} type="button" aria-haspopup="dialog" aria-expanded={onglet === 'plateforme' && objet === nom} data-ouvre="plateforme" data-objet={nom}
                    className={`choix carte-pf${onglet === 'plateforme' && objet === nom ? ' actif' : ''}`}
                    onClick={() => ouvrir('plateforme', nom)}
                  >
                    <span className="pf-tete"><i className={`voyant v-${teinte}`} title={motif} /><span className="pf-nom">{libelleSource(nom)}</span><b className="pf-nb">{muet ? '—' : passage?.lues ?? 0}</b></span>
                    <span className="pf-motif">{motif}</span>
                    <span className="pf-cles">{etatCles(nom, parametres)}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="bloc-v" aria-label="Jobboards fouillés">
            <div className="bloc-tete">
              <h3 className="etiquette">Jobboards fouillés</h3>
              <div className="actions">
                <button type="button" className={`action${onglet === 'ajout-jobboard' ? ' allume' : ''}`} aria-haspopup="dialog" onClick={() => {
                  setAjoutJb(true);
                  ouvrir('ajout-jobboard');
                }}><span className="ico">{ICONES.plus}</span>Ajouter un jobboard</button>
                <button type="button" className="action" title="Fouille maintenant les jobboards enregistrés, avec les recherches des profils actifs." onClick={recolter}><span className="ico">{ICONES.fleche}</span>Récolter maintenant</button>
              </div>
            </div>
            <ul className="jobboards-l">
              {jobboards.map((j, i) => (
                <li
                  key={`${j.url}-${i}`} className={`${j.actif ? '' : 'eteint'}${onglet === 'jobboard' && objet === j.url ? ' actif' : ''}`} tabIndex={0}
                  aria-label={`Jobboard ${j.nom || j.url} : ouvrir`} data-ouvre="jobboard" data-objet={j.url}
                  onClick={() => ouvrir('jobboard', j.url)}
                  onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && ouvrir('jobboard', j.url)}
                >
                  <b>{j.nom || 'Sans nom'}{j.siren && <span className="tag-f">fiche</span>}</b>
                  <span className="d" title={j.url}>{j.url.replace(/^https?:\/\/(www\.)?/i, '')}</span>
                  <span>{j.veille ? 'pendant la veille' : 'cycle des jobboards'}</span>
                  <label className="inter" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={j.actif} aria-label={`Récolter ${j.nom || j.url}`} onChange={(e) => basculerJobboard(i, e.target.checked)} />
                  </label>
                </li>
              ))}
              {!jobboards.length && <li className="vide">Aucun jobboard : ajoutez-en un, ou suivez la page d&apos;offres d&apos;une fiche.</li>}
            </ul>
          </section>
        </div>
        {avis}
      </Fenetre>
      <Panneau elements={elements} onglets={onglets} />
    </>
  );
}

// Une plateforme : son voyant, ses clés (jamais réaffichées : « enregistrée » ou « non renseignée ») ou son nombre de boards
function Plateforme({ nom, parametres, cycle, enregistrer }: { nom: string; parametres: Parametres | null; cycle: Cycle; enregistrer: (m: Partial<Parametres>) => Promise<boolean> }) {
  const id = useId();
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [effaces, setEffaces] = useState<string[]>([]);
  useEffect(() => {
    setSaisies({});
    setEffaces([]);
  }, [parametres]);
  const champs = CLES[nom] ?? [];
  const [teinte, motif] = voyant(nom, cycle);
  const modifs: Partial<Parametres> = Object.fromEntries(champs.flatMap((c): [string, string | number][] => {
    if (c.nombre) return saisies[c.cle] !== undefined && saisies[c.cle] !== String(parametres?.[c.cle] ?? '') ? [[c.cle, parseInt(saisies[c.cle], 10) || 0]] : [];
    return saisies[c.cle] ? [[c.cle, saisies[c.cle]]] : effaces.includes(c.cle) ? [[c.cle, '']] : [];
  }));
  const change = Object.keys(modifs).length > 0;
  const sauver = () => change && enregistrer(modifs);
  const secret = champs.length > 1 ? 'Clés' : 'Clé';
  return (
    <div onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).matches('input') && sauver()}>
      <div className="voyant-l"><i className={`voyant v-${teinte}`} /><span>{motif}</span>{cycle.date && <span className="d">dernier cycle {heure(dateDe(cycle.date))}</span>}</div>
      {champs.length ? (
        <div className="section-f">
          <div className={champs.length > 1 ? 'grille-2' : undefined}>
            {champs.map((c) => {
              const enregistree = parametres?.[c.cle] === true;
              const efface = effaces.includes(c.cle);
              return (
                <div key={c.cle} className="champ">
                  <label htmlFor={`${id}-${c.cle}`}>{c.libelle}</label>
                  {c.nombre ? (
                    <input id={`${id}-${c.cle}`} className="saisie" type="number" min={0} value={saisies[c.cle] ?? String(parametres?.[c.cle] ?? '')} onChange={(e) => setSaisies((s) => ({ ...s, [c.cle]: e.target.value }))} />
                  ) : (
                    <span className="secret">
                      <input
                        id={`${id}-${c.cle}`} className="saisie" type="password" autoComplete="new-password" value={saisies[c.cle] ?? ''}
                        placeholder={efface ? "effacée à l'enregistrement" : enregistree ? 'enregistrée' : 'non renseignée'}
                        title={enregistree ? 'Enregistrée au coffre : tapez une valeur pour la remplacer.' : undefined}
                        onChange={(e) => setSaisies((s) => ({ ...s, [c.cle]: e.target.value }))}
                      />
                      {enregistree && !efface && !saisies[c.cle] && (
                        <button type="button" className="lien-d" title="Retire ce secret du coffre à l'enregistrement." onClick={() => setEffaces((x) => [...x, c.cle])}>Effacer</button>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="aide-champ">{champs[0].nombre ? AIDE_ATS : `${secret} de l'API ${libelleSource(nom)}, une fois pour toutes les veilles ; sans ${champs.length > 1 ? 'elles' : 'elle'}, la source ne tourne pas.`}</p>
        </div>
      ) : (
        <p className="texte-f">{libelleSource(nom)} se lit sans clé : chaque profil de veille dit s&apos;il l&apos;interroge.</p>
      )}
      <AuPied><button type="button" className="action plein" disabled={!change} onClick={sauver}>Enregistrer<span className="ico">{ICONES.fleche}</span></button></AuPied>
    </div>
  );
}

// Réglages globaux de la veille et du cycle des jobboards
type Form = { departements: string[]; veille_periode_minutes: string; veille_timeout_secondes: string; veille_socle_avant: string; veille_tri_modele: string; jobboards_heure: string; jobboards_periode_heures: string };
const NOMBRES = ['veille_periode_minutes', 'veille_timeout_secondes', 'jobboards_periode_heures'] as const;
const formDe = (p: Parametres | null): Form => ({
  departements: p?.departements ?? [], veille_periode_minutes: String(p?.veille_periode_minutes ?? ''), veille_timeout_secondes: String(p?.veille_timeout_secondes ?? ''),
  veille_socle_avant: p?.veille_socle_avant ?? '', veille_tri_modele: p?.veille_tri_modele ?? '', jobboards_heure: p?.jobboards_heure ?? '',
  jobboards_periode_heures: String(p?.jobboards_periode_heures ?? ''),
});
const lireForm = (f: Form): Partial<Parametres> => ({
  departements: f.departements, veille_socle_avant: f.veille_socle_avant, veille_tri_modele: f.veille_tri_modele, jobboards_heure: f.jobboards_heure,
  ...Object.fromEntries(NOMBRES.map((n) => [n, parseInt(f[n], 10) || 0])),
});

function useReglages(parametres: Parametres | null, enregistrer: (m: Partial<Parametres>) => Promise<boolean>) {
  const [form, setForm] = useState<Form>(() => formDe(parametres));
  const reprendre = useCallback(() => setForm(formDe(parametres)), [parametres]);
  useEffect(() => reprendre(), [reprendre]);
  const change = JSON.stringify(lireForm(form)) !== JSON.stringify(lireForm(formDe(parametres)));
  const sauver = () => change && enregistrer(lireForm(form));
  const champ = (c: keyof Omit<Form, 'departements'>) => ({ value: form[c], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [c]: e.target.value })) });
  const modeles = parametres?.modeles ?? [];
  const cycle = parseInt(form.jobboards_periode_heures, 10) || 0;
  const corps = (
    <div onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).matches('input:not([type=search])') && sauver()}>
      <div className="section-f">
        <div className="champ">
          <label htmlFor="ve-dep" title="Ceux des profils de recherche qui n'en donnent pas ; vide : toute la France.">Départements</label>
          <Catalogue id="ve-dep" codes={form.departements} changer={(departements) => setForm((f) => ({ ...f, departements }))} />
        </div>
        <div className="grille-2 bas">
          <div className="champ"><label htmlFor="ve-rot" title="Un cycle toutes les N minutes tant que le serveur tourne : il mène chaque veille active, l'une après l'autre. 0 : uniquement à la demande.">Rotation automatique (min)</label><input id="ve-rot" className="saisie" type="number" min={0} {...champ('veille_periode_minutes')} /></div>
          <div className="champ"><label htmlFor="ve-to">Timeout (s)</label><input id="ve-to" className="saisie" type="number" min={60} {...champ('veille_timeout_secondes')} /></div>
          <div className="champ"><label htmlFor="ve-socle" title="Une offre publiée avant cette date entre en base et reste consultable, mais ne va jamais dans la file. Vide : tout ce qui arrive est postulable.">Écouter à partir du</label><input id="ve-socle" className="saisie" type="date" {...champ('veille_socle_avant')} /></div>
          <div className="champ">
            <label htmlFor="ve-mod" title="Il pose en coulisse la famille de métier de chaque recherche et de chaque offre de la liste globale, puis juge si un intitulé correspond à une recherche.">Étiquettes — modèle<MarqueAdmin /></label>
            <select id="ve-mod" className="saisie" {...champ('veille_tri_modele')}>
              <option value="">Aucun</option>
              {modeles.map((m) => <option key={m.nom} value={m.nom}>{m.nom}{m.modele ? ` · ${m.modele}` : ''}</option>)}
              {form.veille_tri_modele && !modeles.some((m) => m.nom === form.veille_tri_modele) && <option value={form.veille_tri_modele}>{form.veille_tri_modele}</option>}
            </select>
          </div>
        </div>
      </div>
      <div className="section-f">
        <h3>Jobboards</h3>
        <div className="grille-2 bas">
          <div className="champ"><label htmlFor="ve-h">Départ du cycle des jobboards</label><input id="ve-h" className="saisie" type="time" {...champ('jobboards_heure')} /></div>
          <div className="champ"><label htmlFor="ve-cy">Cycle (heures)</label><input id="ve-cy" className="saisie" type="number" min={0} {...champ('jobboards_periode_heures')} /></div>
        </div>
        <p className="aide-champ">{cycle ? `À l'heure locale du PC : le cycle part à ${form.jobboards_heure || '—'} puis toutes les ${cycle} h, écoute armée.` : 'Cycle coupé : seulement par « Récolter maintenant ».'}</p>
      </div>
    </div>
  );
  const pied = (
    <>
      <button type="button" className="action gauche" disabled={!change} onClick={reprendre}>Annuler</button>
      <button type="button" className="action plein" disabled={!change} onClick={sauver}>Enregistrer<span className="ico">{ICONES.fleche}</span></button>
    </>
  );
  return { corps, pied };
}

// Sélecteur de catalogue : les départements choisis en puces, la recherche dans le même champ
function Catalogue({ id, codes, changer }: { id: string; codes: string[]; changer: (codes: string[]) => void }) {
  type Entree = { code: string; libelle: string };
  const [libelles, setLibelles] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [trouves, setTrouves] = useState<Entree[]>([]);
  const manquants = codes.filter((c) => !(c in libelles)).join(',');
  useEffect(() => {
    if (!manquants) return;
    appeler<Entree[]>(`/catalogues/departements?codes=${encodeURIComponent(manquants)}`)
      .then((l) => setLibelles((x) => ({ ...x, ...Object.fromEntries(manquants.split(',').map((c) => [c, ''])), ...Object.fromEntries(l.map((e) => [e.code, e.libelle])) })))
      .catch(() => setLibelles((x) => ({ ...x, ...Object.fromEntries(manquants.split(',').map((c) => [c, ''])) })));
  }, [manquants]);
  const minuteur = useRef(0);
  useEffect(() => {
    window.clearTimeout(minuteur.current);
    if (!q.trim()) {
      setTrouves([]);
      return;
    }
    minuteur.current = window.setTimeout(() => {
      appeler<Entree[]>(`/catalogues/departements?q=${encodeURIComponent(q)}&limite=8`).then(setTrouves, () => setTrouves([]));
    }, 200);
  }, [q]);
  const prendre = (e: Entree) => {
    setLibelles((x) => ({ ...x, [e.code]: e.libelle }));
    if (!codes.includes(e.code)) changer([...codes, e.code]);
    setQ('');
  };
  return (
    <div className="catalogue-hote">
      <div className="catalogue">
        {codes.map((c) => (
          <span key={c} className="puce"><b>{c}</b>{libelles[c]}<button type="button" aria-label={`Retirer ${libelles[c] || c}`} onClick={() => changer(codes.filter((x) => x !== c))}>{ICONES.croix}</button></span>
        ))}
        <input
          id={id} type="search" role="combobox" placeholder="Ajouter…" autoComplete="off" value={q} aria-autocomplete="list" aria-expanded={trouves.length > 0} aria-controls={`${id}-liste`}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && trouves[0]) {
              e.preventDefault();
              prendre(trouves[0]);
            } else if (e.key === 'Escape' && q) {
              e.preventDefault();
              setQ('');
            }
          }}
        />
      </div>
      {trouves.length > 0 && (
        <div id={`${id}-liste`} className="menu verre" role="listbox" aria-label="Départements trouvés">
          <span className="verre-halos" aria-hidden="true" />
          {trouves.map((e) => (
            <button key={e.code} type="button" role="option" aria-selected={codes.includes(e.code)} className={`menu-option${codes.includes(e.code) ? ' actif' : ''}`} onClick={() => prendre(e)}>
              <b>{e.code}</b>{e.libelle}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const VIERGE: Jobboard = { url: '', nom: '', actif: true, veille: false, siren: '' };

// Un jobboard à ajouter (`origine` nulle) ou à modifier : son adresse, son nom, s'il passe pendant la veille ou par son cycle, s'il est récolté
function EditionJobboard({ origine, liste, enregistrer, ajoute }: { origine: Jobboard | null; liste: Jobboard[]; enregistrer: (m: Partial<Parametres>) => Promise<boolean>; ajoute?: () => void }) {
  const { ouvrir, fermer } = usePanneau();
  const id = useId();
  const cle = JSON.stringify(origine ?? VIERGE);
  const [form, setForm] = useState<Jobboard>(() => JSON.parse(cle));
  useEffect(() => setForm(JSON.parse(cle)), [cle]);
  const rang = origine ? liste.indexOf(origine) : -1;
  const change = JSON.stringify(form) !== cle;
  const sauver = async () => {
    if (!change || !form.url.trim()) return;
    const propre = { ...form, url: form.url.trim(), nom: form.nom.trim() };
    if (!(await enregistrer({ jobboards: origine ? liste.map((j, i) => (i === rang ? propre : j)) : [...liste, propre] }))) return;
    ajoute?.();
    // Le jobboard se suit par son adresse : neuf ou réadressé, sa fenêtre passe à la nouvelle
    if (propre.url !== origine?.url) ouvrir('jobboard', propre.url);
  };
  const retirer = async () => {
    if (await enregistrer({ jobboards: liste.filter((_, i) => i !== rang) })) fermer();
  };
  return (
    <div className="section-f" onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).matches('input:not([type=checkbox])') && sauver()}>
      <div className="champ"><label htmlFor={`${id}-url`}>URL</label><input id={`${id}-url`} className="saisie" type="url" placeholder="https://…/offres" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} /></div>
      <div className="champ"><label htmlFor={`${id}-nom`}>Nom</label><input id={`${id}-nom`} className="saisie" placeholder={form.siren ? 'fiche' : 'Nom'} value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} /></div>
      <label className="inter" title="Coché : récolté à chaque cycle de veille (un jobboard comme JobTeaser). Décoché : par le cycle des jobboards, à son heure (la page carrières d'un employeur).">Pendant la veille<input type="checkbox" checked={form.veille} onChange={(e) => setForm((f) => ({ ...f, veille: e.target.checked }))} /></label>
      <label className="inter" title="Décoché, le jobboard reste dans la liste sans être fouillé.">Récolté<input type="checkbox" checked={form.actif} onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))} /></label>
      <p className="aide-champ">Chaque recherche des profils actifs y est menée, navigateur piloté ; la première récolte apprend la recette du site avec le modèle, les suivantes la rejouent sans lui.</p>
      <AuPied>
          {origine && <button type="button" className="action rouge gauche" onClick={retirer}><span className="ico">{ICONES.vider}</span>Retirer</button>}
          <button type="button" className="action plein" disabled={!change || !form.url.trim()} onClick={sauver}>Enregistrer<span className="ico">{ICONES.fleche}</span></button>
      </AuPied>
    </div>
  );
}
