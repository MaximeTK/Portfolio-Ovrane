'use client';

import '../pages/candidatures/fiche-offre.css';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { appeler, telecharger, televerser } from '../api';
import type { Onglet } from '../dock/Panneau';

// Ce que /offres/{cle}/dossier rend : l'offre, sa candidature, son courrier et ce qui pend à elle
type Offre = {
  cle: string; titre: string; entreprise_brute: string; entreprise_siren: string | null; site_entreprise: string | null;
  lieu: string; dept: string; contrat: string; source: string; url: string; apply_url: string; publiee_le: string;
  rattachement: string; vue_le: string; etape: string; langue: string; metiers: string[];
};
type Envoi = {
  id: number; statut: string; date: string; profil_candidature: string; profil_recherche: string; cv: string; lettre_txt: string;
  lettre_pdf: string; competences_manquantes: string[]; competences_ajoutees: string[]; competences_implicites: string[];
  competences_retenues: string[]; gestes: number; aboutis: number; fin: string; motif: string; preparation: string;
};
type Suivi = { cle: string; couleur: string; libelle: string; jours: number; relances: number; origine: string };
type Courrier = { message_id: string; sens: string; recu_le: string; expediteur: string; sujet: string; tags: string[] };
type Saisie = { question?: string; valeur?: string; source?: { sorte?: string; donnee?: string }; signalement?: string; site?: string; ligne?: string; page?: string };
type Attribution = { modifiable: boolean; profil_recherche: string; profil_cv: string; cv_auto: boolean; choix: { recherche: string; cvs: string[] }[] };
type Mesures = {
  origine: { source: string; vue_sur: string[]; detectee_le: string | null };
  mesures: { site?: string; reglage?: string; duree_s?: number; tours?: number; jade?: number; gestes?: number; rejoues?: number; conversation?: number | null; remplis?: number; remplis_ia?: number; cv_s?: number; lettre_s?: number };
  couts: { poste: string; modeles: string[]; appels: number; cout: number }[];
  cout_total: number;
  appels: { debut: string; duree_s: number; analyse: boolean }[];
};
type Dossier = {
  offre: Offre; candidature: Envoi | null; suivi: Suivi | null; mails: Courrier[]; saisies: Saisie[]; attribution: Attribution | null;
  mesures: Mesures | null; contacts: { profil_url: string; nom: string; titre: string }[]; annonce: string; annonce_a_relire: boolean;
};
type Avis = { texte: string; erreur?: boolean } | null;
export type DemandeAjout = { cle: string; competence: string; profil: string };

// Les étapes d'une offre, sous leur nom et leur trait de couleur
export const ETAPES: Record<string, { nom: string; classe: string }> = {
  A_POSTULER: { nom: 'À postuler', classe: '' }, A_LA_MAIN: { nom: 'À faire à la main', classe: 'main' }, SOCLE: { nom: 'Socle', classe: '' },
  ENVOYEE: { nom: 'Envoyée', classe: 'env' }, INADAPTEE: { nom: 'Inadaptée', classe: 'inad' }, ECHEC: { nom: 'Échec', classe: 'ech' },
  ECARTEE: { nom: 'Écartée', classe: 'eca' },
};
const SOURCES: Record<string, string> = {
  france_travail: 'France Travail', apec: 'APEC', free_work: 'Free-Work', wttj: 'Welcome to the Jungle', hellowork: 'HelloWork',
  linkedin: 'LinkedIn', adzuna: 'Adzuna', jooble: 'Jooble', careerjet: 'Careerjet', indeed: 'Indeed', ats: 'Boards employeurs',
  manuelle: 'Ajoutée à la main', constructeur: 'Constructeur',
};
export const libelleSource = (s: string) => SOURCES[s] ?? (s || '—');
// « data/developpeur-python.json » → « developpeur-python »
export const nomProfil = (chemin: string) => (String(chemin || '').split(/[\\/]/).pop() ?? '').replace(/\.json$/i, '');
// « 2026-10-28 » → « 28/10 »
export const jourMois = (iso: string) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[2]}/${m[1]}` : '—';
};
// Une date d'Illusion sans fuseau est en UTC
export const dateUtc = (texte: string) => new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(texte) ? texte : `${texte}Z`);
const jourHeure = (texte: string | null) => {
  if (!texte) return '—';
  const d = dateUtc(texte);
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};
const RAISONS: Record<string, string> = {
  rattachee: 'rattachée à une fiche', creee: "fiche créée depuis l'offre", inconnue: 'employeur introuvable dans Sirene',
  a_identifier: 'employeur pas encore recherché', intermediaire: 'pas un employeur', hors_cible: 'hors cible',
};
const MOTIFS: Record<string, string> = {
  offre_fermee: 'offre retirée', hors_profil: 'hors profil', captcha: 'vérification humaine', compte: 'compte / connexion',
  depot: 'pièce refusée', page_sourde: 'page muette', boucle: 'tourne en rond', plafond_tours: 'plafond de tours', brique: 'brique muette', autre: 'autre',
};
const SAISIES: Record<string, string> = {
  exacte: 'de la fiche', deduite: 'déduite', inventee: 'inventée', offre: "propre à l'offre", cv: "CV de l'offre", lettre: "lettre de l'offre",
  fixe: 'case', coffre: 'coffre', modele: "écrite par l'IA", non_declaree: 'non déclarée',
};
const POSTES: Record<string, string> = {
  navigation: 'Candidature (navigation)', jade: 'JADE (jugement)', lettre: 'Lettre', reponse: 'Réponses aux mails', relance: 'Relances',
  preparation: "Préparation d'entretien", appel: "Analyse d'appel", transcription: 'Transcription des appels', cv_spontane: 'Choix du CV spontané',
};
const POSITIVES = ['proposition', 'rendez_vous', 'prise_information'];
const sur = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : undefined);
const hote = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};
const court = (u: string) => {
  try {
    const chemin = new URL(u).pathname.replace(/\/$/, '');
    return hote(u) + (chemin.length <= 24 ? chemin : '');
  } catch {
    return u;
  }
};
const duree = (s?: number) => (!s ? '—' : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`);
const dollars = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: v > 0 && v < 0.01 ? 4 : 2 })} $`;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Une offre a changé dans une fiche : les pages qui la listent se relisent
export const OFFRE_CHANGEE = 'illusion:offre-changee';
const prevenirPages = (cle: string) => window.dispatchEvent(new CustomEvent(OFFRE_CHANGEE, { detail: cle }));

// Les dossiers lus, partagés par le titre, le corps et le pied de la fiche
const dossiers = new Map<string, { dossier?: Dossier; erreur?: string }>();
const abonnes = new Set<() => void>();
const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};
async function charger(cle: string) {
  try {
    dossiers.set(cle, { dossier: await appeler<Dossier>(`/offres/${encodeURIComponent(cle)}/dossier`) });
  } catch (e) {
    dossiers.set(cle, { ...dossiers.get(cle), erreur: message(e) });
  }
  abonnes.forEach((f) => f());
}
const useDossier = (cle: string | null) => useSyncExternalStore(abonner, () => (cle ? dossiers.get(cle) : undefined), () => undefined);

// Le titre de l'onglet : « Fiche · ALTEN » une fois le dossier lu
function TitreFiche({ cle }: { cle: string | null }) {
  const nom = useDossier(cle)?.dossier?.offre.entreprise_brute;
  return <>{nom ? `Fiche · ${nom}` : 'Fiche'}</>;
}

// Contrat de la fiche d'une offre, partagée par les pages qui en montrent : l'onglet `fiche-offre` à mettre dans leur Panneau ; sans `ajouterAuProfil`, le « + » d'une compétence ouvre son ajout dans la fiche
export function ongletFicheOffre(
  cle: string | null,
  options: { ouvrirEntreprise?: (siren: string) => void; ajouterAuProfil?: (demande: DemandeAjout) => void } = {},
): Onglet {
  return {
    cle: 'fiche-offre',
    titre: <TitreFiche cle={cle} />,
    label: 'Fiche offre',
    corps: cle ? <CorpsFiche cle={cle} ajouterAuProfil={options.ajouterAuProfil} /> : <p className="texte-f">Aucune offre choisie.</p>,
    pied: cle ? <PiedFiche cle={cle} ouvrirEntreprise={options.ouvrirEntreprise} /> : undefined,
  };
}

function PiedFiche({ cle, ouvrirEntreprise }: { cle: string; ouvrirEntreprise?: (siren: string) => void }) {
  const d = useDossier(cle)?.dossier;
  if (!d) return null;
  const o = d.offre, lien = sur(o.apply_url || o.url);
  // « Postuler » n'a plus de sens sur une offre déjà déposée : ne reste qu'à revoir l'annonce
  const deposee = d.candidature && d.candidature.statut !== 'PRETE';
  return (
    <>
      {o.entreprise_siren && ouvrirEntreprise && (
        <button type="button" className="action gauche" aria-haspopup="dialog" onClick={() => ouvrirEntreprise(o.entreprise_siren!)}>Voir la fiche entreprise</button>
      )}
      {lien && (
        <a className="action plein" href={lien} target="_blank" rel="noopener noreferrer">
          {deposee ? "Page de l'offre" : 'Postuler'}
          <span className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
        </a>
      )}
    </>
  );
}

function Bloc({ titre, compte, children }: { titre: string; compte?: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="bloc-f">
      <summary>
        {titre}
        {compte !== undefined && <span className="compteur">{compte}</span>}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div>{children}</div>
    </details>
  );
}

type Agir = (nom: string, geste: () => Promise<string>) => Promise<void>;

function CorpsFiche({ cle, ajouterAuProfil }: { cle: string; ajouterAuProfil?: (demande: DemandeAjout) => void }) {
  const lu = useDossier(cle);
  const [avis, setAvis] = useState<Avis>(null);
  const [occupe, setOccupe] = useState('');
  const [ajout, setAjout] = useState<DemandeAjout | null>(null);
  // Chaque offre ouverte relit son dossier : une autre page a pu le changer
  useEffect(() => {
    void charger(cle);
  }, [cle]);

  if (!lu?.dossier) return <p className="texte-f" role={lu?.erreur ? 'alert' : undefined}>{lu?.erreur ?? 'Lecture du dossier…'}</p>;
  const d = lu.dossier, o = d.offre, envoi = d.candidature;
  if (ajout?.cle === cle) return <AjoutCompetence demande={ajout} fini={(texte) => { setAjout(null); setAvis(texte ? { texte } : null); }} />;

  // Un geste sur l'offre : son message, puis le dossier et les listes relus
  const agir: Agir = async (nom, geste) => {
    setOccupe(nom);
    try {
      setAvis({ texte: await geste() });
      prevenirPages(cle);
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    } finally {
      setOccupe('');
      await charger(cle);
    }
  };
  const poster = (chemin: string, corps?: unknown) => appeler<Record<string, unknown>>(chemin, { methode: 'POST', corps });
  const tags = new Set(d.mails.flatMap((m) => m.tags));
  const reponse = POSITIVES.some((t) => tags.has(t)) ? { nom: 'Réponse positive', classe: 't-envoi' }
    : tags.has('refus') ? { nom: 'Refus', classe: 'refus' } : tags.size ? { nom: 'Réponse reçue', classe: 't-rep' } : null;
  const etape = ETAPES[o.etape] ?? { nom: o.etape, classe: '' };
  const demander = (competence: string) => {
    const demande = { cle, competence, profil: (envoi?.profil_candidature ?? '').split(/[\\/]/).pop() ?? '' };
    if (ajouterAuProfil) ajouterAuProfil(demande);
    else setAjout(demande);
  };

  return (
    <div className="fiche-offre">
      {avis && <p className={`avis-fiche${avis.erreur ? ' erreur' : ''}`} role={avis.erreur ? 'alert' : 'status'}>{avis.texte}</p>}
      <div className="f-tete">
        <h3>{o.titre || 'Offre sans intitulé'}</h3>
        <p className="f-meta">
          <span>{libelleSource(o.source)}</span>
          <span className={`eo ${etape.classe}`}>{etape.nom}</span>
          {reponse && <span className={reponse.classe}>{reponse.nom}</span>}
          <span>{RAISONS[o.rattachement] ?? o.rattachement}</span>
          {(o.etape === 'A_POSTULER' || o.etape === 'SOCLE') && (
            <button type="button" className="lien-d" disabled={!!occupe} title="Sort l'offre de la file sans y postuler. Elle n'y reviendra pas."
              onClick={() => agir('ecarter', async () => (await poster(`/candidatures/${encodeURIComponent(cle)}/ignorer`), 'Offre écartée de la file.'))}>Écarter</button>
          )}
          {envoi?.statut === 'A_LA_MAIN' && (
            <button type="button" className="lien-d" disabled={!!occupe} title="Une fois la vérification humaine faite et la candidature envoyée par vous, l'offre passe en « Envoyée »."
              onClick={() => agir('finie', async () => (await poster(`/candidatures/${encodeURIComponent(cle)}/finie`), 'Candidature comptée envoyée.'))}>Marquer envoyée</button>
          )}
          {envoi && ['ECHEC', 'INADAPTEE', 'IGNOREE'].includes(envoi.statut) && (
            <button type="button" className="lien-d" disabled={!!occupe} title="Efface cette ligne : l'offre repart dans la file et sera rejouée."
              onClick={() => agir('rendre', async () => (await poster(`/candidatures/${encodeURIComponent(cle)}/rendre`), 'Offre rendue à la file : elle sera rejouée au prochain lot.'))}>Rendre à la file</button>
          )}
        </p>
      </div>
      <div className="section-f">
        <div className="grille-fiche">
          <div><span className="lib-champ">Entreprise</span><span>{o.entreprise_brute || '—'}{o.entreprise_siren && <> <small>SIREN {o.entreprise_siren.replace(/(\d{3})(?=\d)/g, '$1 ')}</small></>}</span></div>
          <div><span className="lib-champ">Site de l&apos;entreprise</span>{sur(o.site_entreprise) ? <a className="lien" href={sur(o.site_entreprise)} target="_blank" rel="noopener noreferrer">{hote(o.site_entreprise!)}</a> : <span>—</span>}</div>
          <div><span className="lib-champ">Publiée le</span><span>{jourMois(o.publiee_le)}</span></div>
          <div><span className="lib-champ">Lieu</span><span>{o.lieu || '—'}{o.dept && ` (${o.dept})`}</span></div>
          <div><span className="lib-champ">Contrat</span><span>{o.contrat || '—'}</span></div>
          <div><span className="lib-champ">Langue</span><span>{o.langue.toUpperCase() || '—'}</span></div>
          <div><span className="lib-champ">Métiers</span><span>{o.metiers.join(', ') || '—'}</span></div>
          <div><span className="lib-champ">Candidater</span>{sur(o.apply_url) ? <a className="lien" href={sur(o.apply_url)} target="_blank" rel="noopener noreferrer">{court(o.apply_url)}</a> : <span>—</span>}</div>
          <div><span className="lib-champ">Annonce</span>{sur(o.url) ? <a className="lien" href={sur(o.url)} target="_blank" rel="noopener noreferrer">{hote(o.url)}</a> : <span>—</span>}</div>
          <div><span className="lib-champ">Vue par la veille</span><span>{jourHeure(o.vue_le)}</span></div>
          <div className="cle-offre"><span className="lib-champ">Clé de dédoublonnage</span><span className="mono">{o.cle}</span></div>
        </div>
      </div>
      {d.attribution?.modifiable && <Profils cle={cle} attribution={d.attribution} agir={agir} />}
      {envoi && (
        <div className="section-f">
          <h3>Candidature</h3>
          <dl className="def">
            <dt className="lib-champ">{envoi.statut === 'POSTULEE' ? 'Envoyée le' : 'Tentée le'}</dt><dd>{jourHeure(envoi.date)}</dd>
            {d.suivi && (
              <>
                <dt className="lib-champ">Suivi</dt>
                <dd><span className={`carre s-${d.suivi.couleur}`} /><b>{d.suivi.libelle}</b>{' '}
                  <span className="d">· {d.suivi.jours === 0 ? "aujourd'hui" : d.suivi.jours === 1 ? 'depuis hier' : `depuis ${d.suivi.jours} jours`}{d.suivi.relances ? ` · ${d.suivi.relances} relance(s)` : ''}</span></dd>
              </>
            )}
            <dt className="lib-champ">Profil employé</dt><dd>{nomProfil(envoi.profil_candidature) || '—'}</dd>
            <dt className="lib-champ">Profil de recherche</dt><dd>{envoi.profil_recherche || '—'}</dd>
            <dt className="lib-champ">Gestes</dt><dd>{envoi.aboutis} aboutis sur {envoi.gestes}</dd>
            {(envoi.motif || (envoi.statut !== 'POSTULEE' && envoi.fin)) && (
              <><dt className="lib-champ">Motif</dt><dd>{MOTIFS[envoi.motif] ?? envoi.motif}{envoi.fin && <span className="d"> {envoi.fin}</span>}</dd></>
            )}
            <dt className="lib-champ">CV déposé</dt>
            <dd><Piece envoi={envoi} nature="cv" nom={envoi.cv} occupe={occupe === 'cv'} agir={agir} /></dd>
            <dt className="lib-champ">Lettre</dt>
            <dd><Piece envoi={envoi} nature="lettre" nom={envoi.lettre_pdf || envoi.lettre_txt} occupe={occupe === 'lettre'} agir={agir} /></dd>
            <dt className="lib-champ">Compétences retenues</dt>
            <dd>{envoi.competences_retenues.length ? <span className="puces">{envoi.competences_retenues.map((c) => <span key={c} className="puce">{c}</span>)}</span> : '—'}</dd>
            <dt className="lib-champ">Compétences manquantes</dt>
            <dd>{envoi.competences_manquantes.length ? (
              <span className="puces">
                {envoi.competences_manquantes.map((c) => envoi.competences_ajoutees.includes(c) ? (
                  <span key={c} className="puce ajoutee" title="Manquante sur cette candidature-là, ajoutée au profil depuis : les suivantes la trouveront.">{c} ✓</span>
                ) : (
                  <span key={c} className="puce manque">{c}<button type="button" aria-haspopup="dialog" title={`Ajouter « ${c} » au profil`} aria-label={`Ajouter « ${c} » au profil`} onClick={() => demander(c)}>+</button></span>
                ))}
              </span>
            ) : '—'}</dd>
            {envoi.competences_implicites.length > 0 && (
              <><dt className="lib-champ">Sous-entendues</dt><dd><span className="puces">{envoi.competences_implicites.map((c) => <span key={c} className="puce implicite">{c}</span>)}</span></dd></>
            )}
          </dl>
        </div>
      )}
      {d.saisies.length > 0 && (
        <Bloc titre="Ce qui a été saisi" compte={d.saisies.length}>
          <ul className="liste-f saisies-f">
            {d.saisies.map((s, n) => (
              <li key={n}>
                <span className="q">{s.question || '—'}</span>
                <span className="v">{s.valeur || '—'}</span>
                <span className="d">{SAISIES[s.source?.sorte ?? ''] ?? s.source?.sorte}{s.source?.donnee && ` · ${s.source.donnee}`}</span>
                {s.signalement === 'valide' ? <span className="refus">signalée fausse</span>
                  : s.signalement === 'en_attente' ? <span className="d">signalée, en attente</span>
                    : s.ligne && !['cv', 'lettre', 'coffre'].includes(s.source?.sorte ?? '') && (
                      <button type="button" className="lien-d" disabled={!!occupe} onClick={() => agir('signaler', async () => {
                        await poster('/signalements', { site: s.site, ligne: s.ligne, page: s.page ?? '', question: s.question ?? '', source: s.source ?? {} });
                        return 'Signalement envoyé : il sera vérifié avant toute correction.';
                      })}>Signaler</button>
                    )}
              </li>
            ))}
          </ul>
        </Bloc>
      )}
      {d.mesures && <BlocMesures m={d.mesures} />}
      <Bloc titre="Contacts LinkedIn" compte={d.contacts.length || undefined}>
        {d.contacts.length ? (
          <ul className="liste-f">{d.contacts.map((c) => (
            <li key={c.profil_url}>{sur(c.profil_url) ? <a className="lien" href={sur(c.profil_url)} target="_blank" rel="noopener noreferrer">{c.nom}</a> : c.nom}<span className="d">{c.titre}</span></li>
          ))}</ul>
        ) : <p className="texte-f">LAPIS cherche chez l&apos;employeur les personnes aux postes réglés pour LAPIS ; personne n&apos;est contacté.</p>}
        <button type="button" className="action" disabled={occupe === 'lapis'} onClick={() => agir('lapis', async () => {
          const r = await poster('/lapis/contacts', { offre_cle: cle });
          return r.lancee ? 'LAPIS cherche des contacts chez cet employeur : ils apparaîtront ici.' : 'Une passe de LAPIS tourne déjà.';
        })}>Chercher des contacts</button>
      </Bloc>
      {envoi?.statut === 'POSTULEE' && (
        <Bloc titre="Préparation de l'entretien">
          {envoi.preparation ? <Preparation texte={envoi.preparation} candidature={envoi.id} setAvis={setAvis} />
            : <p className="texte-f">Aucun rendez-vous proposé pour l&apos;instant : la préparation se rédige quand un mail en propose un.</p>}
          <button type="button" className="action" disabled={occupe === 'preparer'} onClick={() => agir('preparer', async () => {
            await poster(`/candidatures/${envoi.id}/preparation`);
            return "Préparation de l'entretien rédigée.";
          })}>{occupe === 'preparer' ? 'Rédaction en cours…' : envoi.preparation ? 'Refaire la préparation' : 'Préparer'}</button>
        </Bloc>
      )}
      {d.mails.length > 0 && (
        <Bloc titre="Courrier" compte={d.mails.length}>
          <ul className="liste-f">
            {d.mails.map((m) => (
              <li key={m.message_id}>
                <span className="sujet">{m.sens === 'sortant' ? '↗ ' : ''}{m.sujet || '(sans objet)'}</span>
                <span className="d">{m.expediteur.replace(/^.*<(.+)>.*$/, '$1')} · {jourMois(dateUtc(m.recu_le).toISOString())}</span>
                <button type="button" className="lien-d" disabled={!!occupe} title="Sort tout ce fil de l'offre ; ni la relève ni « Rattacher » ne l'y remettront."
                  onClick={() => agir('detacher', async () => {
                    const r = await poster('/mails/fil/offre', { message_id: m.message_id, offre_cle: '' });
                    return `${r.mails} mail(s) du fil détaché(s) de l'offre.`;
                  })}>Détacher</button>
              </li>
            ))}
          </ul>
        </Bloc>
      )}
      <Bloc titre="L'annonce">
        {d.annonce ? (
          <>
            {d.annonce_a_relire && <p className="texte-f d">Relevée avant que l&apos;annonce ne se lise entière : ce texte peut être coupé, il se relira à la prochaine lecture de l&apos;offre.</p>}
            <p className="texte-f annonce-f">{d.annonce}</p>
          </>
        ) : <p className="texte-f">Le texte n&apos;a pas été relevé sur cette offre : les plateformes le retirent. L&apos;annonce en lien fait foi.</p>}
      </Bloc>
    </div>
  );
}

// Le profil de recherche et le profil de CV : deux listes tant que rien n'est envoyé ; un choix part dès qu'il est fait
function Profils({ cle, attribution, agir }: { cle: string; attribution: Attribution; agir: Agir }) {
  const cvs = attribution.choix.find((c) => c.recherche === attribution.profil_recherche)?.cvs ?? [];
  const choisi = attribution.cv_auto ? '' : attribution.profil_cv;
  const tous = choisi && !cvs.includes(choisi) ? [choisi, ...cvs] : cvs;
  const changer = (champ: 'profil_recherche' | 'profil_cv', valeur: string) => agir('profils', async () => {
    const r = await appeler<{ note?: string }>(`/offres/${encodeURIComponent(cle)}/attribution`, { methode: 'PUT', corps: { [champ]: valeur } });
    return r.note ? `Profils enregistrés : ${r.note}.` : 'Profils enregistrés : la prochaine candidature les prendra.';
  });
  return (
    <div className="section-f">
      <h3>Profils</h3>
      <div className="grille-2">
        <div className="champ">
          <label htmlFor={`recherche-${cle}`}>Profil de recherche</label>
          <select id={`recherche-${cle}`} className="saisie" value={attribution.profil_recherche} onChange={(e) => changer('profil_recherche', e.target.value)}>
            {attribution.choix.map((c) => <option key={c.recherche} value={c.recherche}>{c.recherche || '— aucun —'}</option>)}
          </select>
        </div>
        <div className="champ">
          <label htmlFor={`cv-${cle}`}>Profil de CV</label>
          <select id={`cv-${cle}`} className="saisie" value={choisi} title="« Automatique » : la rotation du profil de recherche choisit, celui qui a le moins servi."
            onChange={(e) => changer('profil_cv', e.target.value)}>
            <option value="">{attribution.cv_auto && attribution.profil_cv ? `Automatique · ${nomProfil(attribution.profil_cv)}` : 'Automatique'}</option>
            {tous.map((c) => <option key={c} value={c}>{nomProfil(c)}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// Une pièce du dossier : elle se télécharge, et se remplace par un fichier du poste, téléversé
function Piece({ envoi, nature, nom, occupe, agir }: { envoi: Envoi; nature: 'cv' | 'lettre'; nom: string; occupe: boolean; agir: Agir }) {
  const choix = useRef<HTMLInputElement>(null);
  const remplacer = (fichier: File) => agir(nature, async () => {
    const lu = await televerser(fichier);
    await appeler(`/candidatures/${envoi.id}/piece`, { methode: 'POST', corps: { nature, ...lu } });
    return `${nature === 'cv' ? 'CV remplacé' : 'Lettre remplacée'} par ${lu.nom}.`;
  });
  return (
    <>
      {nom ? (
        <button type="button" className="lien" onClick={() => agir(nature, async () => (await telecharger(`/productions/${envoi.id}/${nature}`), `${nom} téléchargé.`))}>{nom}</button>
      ) : <span className="d">{nature === 'cv' ? '—' : 'non jointe'}</span>}{' '}
      <button type="button" className="lien-d" disabled={occupe} title="Envoyer un autre fichier de votre poste : il entre dans la base, l'ancien en part."
        onClick={() => choix.current?.click()}>{nom ? 'Changer' : 'Choisir'}</button>
      <input ref={choix} type="file" hidden accept={nature === 'cv' ? '.pdf' : '.pdf,.txt'} aria-label={nature === 'cv' ? 'CV à déposer' : 'Lettre à déposer'}
        onChange={(e) => {
          const fichier = e.target.files?.[0];
          e.target.value = '';
          if (fichier) void remplacer(fichier);
        }} />
    </>
  );
}

function BlocMesures({ m }: { m: Mesures }) {
  const x = m.mesures;
  return (
    <Bloc titre="Mesures" compte={m.couts.length || m.appels.length ? dollars(m.cout_total) : undefined}>
      <dl className="def">
        <dt className="lib-champ">Jobboard d&apos;origine</dt>
        <dd>{libelleSource(m.origine.source)}{m.origine.vue_sur.length > 0 && <span className="d"> vue aussi sur {m.origine.vue_sur.map(libelleSource).join(', ')}</span>}</dd>
        <dt className="lib-champ">Détectée le</dt><dd>{jourHeure(m.origine.detectee_le)}</dd>
        {x.site && (
          <>
            <dt className="lib-champ">Candidature</dt><dd>{duree(x.duree_s)} sur {x.site} <span className="d">workflow : {x.reglage || '—'}</span></dd>
            <dt className="lib-champ">Modèle</dt><dd>{x.tours} tour(s), JADE {x.jade} appel(s)</dd>
            <dt className="lib-champ">Gestes</dt><dd>{x.gestes}, dont {x.rejoues} rejoué(s) sans l&apos;IA{x.conversation != null && <span className="d"> {x.conversation} % conversés</span>}</dd>
            <dt className="lib-champ">Infos utilisées</dt><dd>{x.remplis} champ(s) remplis, dont {x.remplis_ia} par l&apos;IA</dd>
            <dt className="lib-champ">Fabrication</dt><dd>CV {x.cv_s ? `${Math.round(x.cv_s)} s` : '—'}, lettre {x.lettre_s ? `${Math.round(x.lettre_s)} s` : '—'}</dd>
          </>
        )}
      </dl>
      {m.couts.length > 0 && (
        <ul className="liste-f">{m.couts.map((p) => (
          <li key={p.poste}>{POSTES[p.poste] ?? p.poste}<span className="d">{p.appels} appel(s) · {dollars(p.cout)}</span></li>
        ))}</ul>
      )}
      {m.appels.length > 0 && <p className="texte-f">Appels : {m.appels.map((a) => `${jourHeure(a.debut)} (${duree(a.duree_s)}${a.analyse ? ', analysé' : ''})`).join(', ')}.</p>}
    </Bloc>
  );
}

// Le diagramme d'une préparation en arbre : un onglet par interlocuteur, chaque question se coche d'un clic et s'enregistre aussitôt
type Noeud = { id: string; question: string; theme?: string; probabilite?: string; reponse?: string; detail?: string; etat?: string; relances?: Noeud[] };
type Arbre = { entretiens: { type: string; questions: Noeud[] }[]; imprevues?: Noeud[]; a_tenir?: string[]; a_poser?: string[] };
const ETAT_SUIVANT: Record<string, string> = { '': 'parcouru', parcouru: 'non', non: '' };
const MARQUES: Record<string, string> = { '': '○', parcouru: '✓', non: '✗' };
const PROBABILITES: Record<string, string> = { haute: 'très probable', moyenne: 'probable', basse: 'possible' };

function lireArbre(texte: string): Arbre | null {
  try {
    const lu = JSON.parse(texte);
    return Array.isArray(lu?.entretiens) ? lu : null;
  } catch {
    return null;
  }
}

function Preparation({ texte, candidature, setAvis }: { texte: string; candidature: number; setAvis: (a: Avis) => void }) {
  const [vue, setVue] = useState(0);
  const [etats, setEtats] = useState<Record<string, string>>({});
  const arbre = lireArbre(texte);
  if (!arbre) return <p className="texte-f annonce-f">{texte}</p>;
  const vues = [...arbre.entretiens.map((e) => ({ titre: e.type, questions: e.questions ?? [] })),
    ...(arbre.imprevues?.length ? [{ titre: 'Posées sans être prévues', questions: arbre.imprevues }] : [])];
  const etat = (n: Noeud) => etats[n.id] ?? n.etat ?? '';
  const compte = (qs: Noeud[]) => {
    const tous = qs.flatMap((q) => [q, ...(q.relances ?? [])]);
    return `${tous.filter((n) => etat(n) === 'parcouru').length}/${tous.length}`;
  };
  const cocher = async (n: Noeud) => {
    const suivant = ETAT_SUIVANT[etat(n)] ?? '';
    try {
      await appeler(`/candidatures/${candidature}/preparation/${encodeURIComponent(n.id)}`, { methode: 'PUT', corps: { etat: suivant } });
      setEtats((e) => ({ ...e, [n.id]: suivant }));
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    }
  };
  const ligne = (n: Noeud, relance = false): React.ReactNode => (
    <li key={n.id} className={relance ? 'relance-q' : undefined}>
      <button type="button" className={`noeud-q etat-${etat(n) || 'afaire'}`} title="Cliquer pour cocher : ○ à faire, ✓ parcourue, ✗ non parcourue" onClick={() => void cocher(n)}>
        <span className="marque-q">{MARQUES[etat(n)]}</span>
        <span>{(n.theme || n.probabilite) && <small>{[n.theme, PROBABILITES[n.probabilite ?? '']].filter(Boolean).join(' · ')}</small>}{n.question}</span>
      </button>
      {(n.reponse || n.detail) && <details className="reponse-q"><summary>{n.reponse || 'Réponse préparée'}</summary><p>{n.detail}</p></details>}
      {!relance && (n.relances ?? []).length > 0 && <ul>{(n.relances ?? []).map((r) => ligne(r, true))}</ul>}
    </li>
  );
  return (
    <div className="preparation-f">
      <div className="onglets-q" role="tablist" aria-label="Interlocuteurs">
        {vues.map((v, i) => (
          <button key={v.titre} type="button" role="tab" aria-selected={i === vue} className={`filtre${i === vue ? ' actif' : ''}`} onClick={() => setVue(i)}>
            {v.titre} <span className="compteur">{compte(v.questions)}</span>
          </button>
        ))}
      </div>
      <ul className="questions-q">{(vues[vue]?.questions ?? []).map((q) => ligne(q))}</ul>
      {!!arbre.a_tenir?.length && <><p className="lib-champ">À tenir</p><ul className="liste-q">{arbre.a_tenir.map((x) => <li key={x}>{x}</li>)}</ul></>}
      {!!arbre.a_poser?.length && <><p className="lib-champ">Questions à poser</p><ul className="liste-q">{arbre.a_poser.map((x) => <li key={x}>{x}</li>)}</ul></>}
    </div>
  );
}

// « Ajouter « X » au profil » : la rubrique du profil où la ranger, ou une rubrique neuve ; Entrée l'ajoute, `fini` reçoit le message de réussite
function AjoutCompetence({ demande, fini }: { demande: DemandeAjout; fini: (texte?: string) => void }) {
  const [rubriques, setRubriques] = useState<string[] | null>(null);
  const [rubrique, setRubrique] = useState('');
  const [neuve, setNeuve] = useState('');
  const [avis, setAvis] = useState<Avis>(null);
  const [occupe, setOccupe] = useState(false);
  useEffect(() => {
    let vivant = true;
    appeler<{ contenu: string }>(`/profils-candidature/${encodeURIComponent(demande.profil)}`)
      .then((r) => {
        const lues = JSON.parse(r.contenu)?.competences;
        if (vivant) setRubriques(lues && !Array.isArray(lues) && typeof lues === 'object' ? Object.keys(lues) : []);
      })
      .catch((e) => {
        if (vivant) {
          setRubriques([]);
          setAvis({ texte: message(e), erreur: true });
        }
      });
    return () => {
      vivant = false;
    };
  }, [demande.profil]);
  const ajouter = async (e: React.FormEvent) => {
    e.preventDefault();
    const choisie = neuve.trim() || rubrique;
    if (!choisie) return setAvis({ texte: 'Dites dans quelle rubrique la ranger.', erreur: true });
    setOccupe(true);
    try {
      const r = await appeler<{ ajoutee: boolean; competence: string; rubrique: string }>(
        `/profils-candidature/${encodeURIComponent(demande.profil)}/competences`, { methode: 'POST', corps: { competence: demande.competence, rubrique: choisie } });
      await charger(demande.cle);
      prevenirPages(demande.cle);
      fini(r.ajoutee ? `« ${r.competence} » rangée dans ${r.rubrique}.` : `« ${r.competence} » était déjà dans le profil.`);
    } catch (err) {
      setAvis({ texte: message(err), erreur: true });
      setOccupe(false);
    }
  };
  return (
    <form className="ajout-competence" onSubmit={ajouter} aria-label={`Ajouter « ${demande.competence} » au profil`}>
      <h3 className="titre-ajout">Ajouter « {demande.competence} » au profil</h3>
      <p className="texte-f">Dans <span className="mono">{nomProfil(demande.profil)}</span>. Écrite noir sur blanc, elle sera reconnue sur les prochaines annonces qui la demandent, et imprimée sur le CV quand elles la demandent.</p>
      {avis && <p className={`avis-fiche${avis.erreur ? ' erreur' : ''}`} role={avis.erreur ? 'alert' : 'status'}>{avis.texte}</p>}
      <div className="champ">
        <label htmlFor="ajout-rubrique">Rubrique</label>
        <select id="ajout-rubrique" className="saisie" value={rubrique} onChange={(e) => setRubrique(e.target.value)} disabled={rubriques === null}>
          <option value="">{rubriques === null ? 'Lecture du profil…' : '— laquelle ?'}</option>
          {(rubriques ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="champ">
        <label htmlFor="ajout-neuve">Ou une rubrique neuve</label>
        <input id="ajout-neuve" className="saisie" maxLength={80} placeholder="IA, DevOps, Données…" value={neuve} onChange={(e) => setNeuve(e.target.value)} />
        <span className="aide-champ">Remplie, elle l&apos;emporte sur la rubrique choisie.</span>
      </div>
      <div className="actions-ajout">
        <button type="button" className="action" onClick={() => fini()}>Annuler</button>
        <button type="submit" className="action plein" disabled={occupe}>Ajouter<span className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></span></button>
      </div>
    </form>
  );
}

// L'onglet « Ajouter « X » au profil », pour une page qui l'ouvre à côté de la fiche plutôt que dedans
export function ongletAjoutCompetence(demande: DemandeAjout | null, fini: (texte?: string) => void): Onglet {
  return {
    cle: 'ajout-competence',
    titre: 'Ajouter au profil',
    label: demande ? `Ajouter « ${demande.competence} » au profil` : 'Ajouter au profil',
    corps: demande ? <AjoutCompetence key={`${demande.cle}-${demande.competence}`} demande={demande} fini={fini} /> : <p className="texte-f">Aucune compétence choisie.</p>,
  };
}
