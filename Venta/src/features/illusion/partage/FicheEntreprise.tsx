'use client';

import '../pages/collecte/fiche-entreprise.css';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { create } from 'zustand';
import { appeler, ErreurIllusion, lireCompte } from '../api';
import { usePanneau } from '../dock/Dock';
import { Confirmer, MarqueAdmin, type Onglet } from '../dock/Panneau';
import { estAdmin } from '../pages/liste';

// L'étape d'une fiche, telle qu'elle se lit : son nom et la couleur de son trait
export const ETATS: { code: string; libelle: string; classe: string }[] = [
  { code: 'COLLECTEE', libelle: 'Collecter', classe: '' },
  { code: 'TRAITEE', libelle: 'Parser', classe: 'f-par' },
  { code: 'AUDITEE', libelle: 'Audit', classe: 'f-aud' },
  { code: 'COMPLETEE', libelle: 'Compléter', classe: 'f-comp' },
  { code: 'ECARTEE', libelle: 'Écarter', classe: 'eca' },
];
export const libelleEtat = (code: string) => ETATS.find((e) => e.code === code)?.libelle ?? code;

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
export const CANAUX: { nom: string; icone: React.ReactNode }[] = [
  { nom: 'Mail', icone: <svg {...TRAIT}><rect x="3" y="5" width="18" height="14" /><path d="m3 7 9 6 9-6" /></svg> },
  { nom: 'Tél', icone: <svg {...TRAIT}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg> },
  { nom: 'Spontanée', icone: <svg {...TRAIT}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg> },
  { nom: 'Jobboard', icone: <svg {...TRAIT}><rect x="3" y="7" width="18" height="13" /><path d="M9 7V4h6v3M3 13h18" /></svg> },
];
const FLECHE = <span className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>;

export function Marques({ tags }: { tags: string[] }) {
  return (
    <span className="marques" aria-label={`Canaux : ${tags.length ? tags.join(', ') : 'aucun'}`}>
      {CANAUX.map((c) => (
        <i key={c.nom} className={tags.includes(c.nom) ? 'on' : undefined} title={`${c.nom} : ${tags.includes(c.nom) ? 'oui' : 'non'}`}>{c.icone}</i>
      ))}
    </span>
  );
}

export function Etape({ etat }: { etat: string }) {
  const e = ETATS.find((x) => x.code === etat);
  return <span className={`eo${e?.classe ? ' ' + e.classe : ''}`}>{e?.libelle ?? etat}</span>;
}

// Une date du serveur sans fuseau est en UTC, comme l'ancien dashboard la lisait
const enDate = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) || iso.length <= 10 ? iso : iso + 'Z');
export const dateCourte = (iso?: string | null) => (iso ? enDate(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—');
export const dateHeure = (iso?: string | null) =>
  iso ? `${dateCourte(iso)} ${enDate(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '—';
// Seules les adresses web s'ouvrent
export function lienSur(url?: string | null) {
  try {
    const u = new URL(url ?? '');
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export const sansProtocole = (url?: string | null) => (url ?? '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
export const messageDe = (e: unknown) => (e instanceof ErreurIllusion ? e.message : e instanceof Error ? e.message : String(e));

type Detail = {
  siren: string; nom: string; secteur: string | null; localisation: string | null; effectif: string | null; dirigeant: string | null;
  site: string | null; email: string | null; telephone: string | null; formulaire_url: string | null; offres_url: string | null;
  tags: string[]; etat: string; mx_valide: boolean | null; notes: string | null; audit_brut_le: string | null; audit_net_le: string | null;
};
type BlocObjet = { titre: string; detail: string; texte: string; lignes: string[]; sources: string[] };
type Section = { titre: string; type: string; valeur: string | string[] | BlocObjet[] | null; identite?: boolean };
type Bloc = { brique: string; lancee: boolean; ok: boolean | null; resume: string; sections: Section[]; commande: string };
type Historique = {
  etats: { date: string; etat_precedent: string | null; etat_nouveau: string; declencheur: string }[];
  evenements: { date: string; type: string; description: string }[];
};
type Offre = { cle: string; titre: string; lieu: string; contrat: string; publiee_le: string; url: string; apply_url: string };
type Donnees = { e: Detail; historique: Historique; blocs: Bloc[]; offres: Offre[]; jobboard: boolean };
type AuditEnBase = { quand: string; prealable: boolean; resume: string };

// Une question qui attend son accord : la page la pose dans la rangée d'outils de sa fenêtre principale si elle en a une, sinon la fiche la pose en tête
export type Question = { question: string; detail?: React.ReactNode; action: string; faire: (fermer: () => void) => Promise<void> };
// Un audit existe déjà : « Déjà audité » le dit et propose de relancer quand même ; `retour` est l'onglet d'où la question vient
export type Deja = AuditEnBase & { siren: string; nom: string; retour: string; lancer: () => Promise<void> };

type EtatFiche = {
  siren: string | null;
  donnees: Donnees | null;
  erreur: string;
  avis: { texte: string; erreur: boolean } | null;
  notes: string;
  question: Question | null;
  deja: Deja | null;
  // Pages qui posent les questions de la fiche dans leur rangée d'outils
  hotes: number;
  // Change à chaque geste qui modifie une fiche : les tableaux qui en montrent se relisent
  version: number;
};

export const useFicheEntreprise = create<EtatFiche>(() => ({
  siren: null, donnees: null, erreur: '', avis: null, notes: '', question: null, deja: null, hotes: 0, version: 0,
}));
const poser = useFicheEntreprise.setState;

let minuteurAvis: ReturnType<typeof setTimeout> | undefined;
function dire(texte: string, erreur = false) {
  poser({ avis: { texte, erreur } });
  clearTimeout(minuteurAvis);
  minuteurAvis = setTimeout(() => poser({ avis: null }), erreur ? 6000 : 3500);
}

async function charger(siren: string) {
  if (useFicheEntreprise.getState().siren !== siren) poser({ siren, donnees: null, erreur: '', question: null });
  try {
    const [e, historique, blocs, offres, parametres] = await Promise.all([
      appeler<Detail>(`/entreprises/${siren}`),
      appeler<Historique>(`/entreprises/${siren}/historique`),
      appeler<Bloc[]>(`/entreprises/${siren}/fiche`),
      appeler<Offre[]>(`/entreprises/${siren}/offres`),
      appeler<{ jobboards?: { siren?: string }[] }>('/parametres'),
    ]);
    if (useFicheEntreprise.getState().siren !== siren) return;
    poser({ donnees: { e, historique, blocs, offres, jobboard: (parametres.jobboards ?? []).some((j) => j.siren === siren) }, notes: e.notes ?? '', erreur: '' });
  } catch (erreur) {
    if (useFicheEntreprise.getState().siren === siren) poser({ erreur: messageDe(erreur) });
  }
}

// Un geste sur la fiche : son message, puis la fiche et les tableaux relus
async function geste(siren: string, faire: () => Promise<string>) {
  try {
    dire(await faire());
    poser((s) => ({ version: s.version + 1 }));
    await charger(siren);
  } catch (erreur) {
    dire(messageDe(erreur), true);
  }
}

const NOMS_PHASES: Record<string, string> = { parser: 'Le parser', audit: "L'analyse du brut", 'audit-complet': "L'audit complet" };

async function lancerPhase(siren: string, brique: string) {
  try {
    const r = await appeler<{ lancee: boolean }>(`/entreprises/${siren}/briques/${brique}`, { methode: 'POST' });
    dire(r.lancee ? `${NOMS_PHASES[brique]} lancé sur cette fiche — le résultat apparaît ici une fois terminé.` : `${NOMS_PHASES[brique]} déjà en cours.`, !r.lancee);
  } catch (erreur) {
    dire(messageDe(erreur), true);
  }
}

// Un audit coûte : s'il en existe déjà un, la question passe par « Déjà audité » avant de relancer
async function nouvelAudit(e: Detail, ouvrir: (cle: string) => void, dejaEnOnglet: boolean) {
  try {
    const vu = await appeler<{ base: AuditEnBase | null }>('/atelier/audit/fiche', { methode: 'POST', corps: { siren: e.siren, nom: e.nom, url: e.site ?? '' } });
    if (!vu.base) return lancerPhase(e.siren, 'audit-complet');
    poser({ deja: { ...vu.base, siren: e.siren, nom: e.nom, retour: 'fiche-entreprise', lancer: () => lancerPhase(e.siren, 'audit-complet') } });
    if (dejaEnOnglet) ouvrir('deja-audit');
  } catch (erreur) {
    dire(messageDe(erreur), true);
  }
}

async function demanderSuppression(e: Detail) {
  try {
    const c = await appeler<{ offres: number; candidatures: number; dossiers: number; transitions: number; mails: number }>(`/entreprises/${e.siren}/suppression/apercu`);
    const parts = ([[c.offres, 'offre(s)'], [c.candidatures, 'candidature(s)'], [c.dossiers, 'CV et lettre(s)'], [c.transitions, "ligne(s) d'historique qui te sont propres"]] as const)
      .filter(([n]) => n).map(([n, quoi]) => `${n} ${quoi}`);
    poser({ question: {
      question: `Supprimer ${e.nom} ?`,
      detail: `${parts.length ? `Partent avec elle : ${parts.join(', ')}.` : "Elle n'a rien produit à effacer."} La fiche commune, son audit et son journal restent.${c.mails ? ` ${c.mails} mail(s) restent dans la boîte, détachés.` : ''}`,
      action: 'Supprimer',
      faire: async (fermer) => {
        try {
          const r = await appeler<{ nom: string; offres: number; dossiers: number }>(`/entreprises/${e.siren}`, { methode: 'DELETE' });
          fermer();
          poser((s) => ({ version: s.version + 1, siren: null, donnees: null }));
          dire(`${r.nom} supprimée — ${r.offres} offre(s), ${r.dossiers} fichier(s) effacé(s).`);
        } catch (erreur) {
          dire(messageDe(erreur), true);
        }
      },
    } });
  } catch (erreur) {
    dire(messageDe(erreur), true);
  }
}

// Le compte connecté, lu une fois : la fiche ne montre ses gestes d'administration qu'au compte du serveur
let compteLu: Promise<boolean> | null = null;
function useAdmin() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    compteLu ??= lireCompte().then((c) => !!c?.admin).catch(() => false);
    let vivant = true;
    compteLu.then((a) => vivant && setAdmin(a));
    return () => {
      vivant = false;
    };
  }, []);
  return admin;
}

// Sur une page d'administration, les gestes d'administration vont au pied comme sur la planche Audit ; ailleurs, dans une section marquée ADMIN
function usePageAdmin() {
  return estAdmin(usePathname()?.split('/').filter(Boolean).pop() ?? '');
}

function TitreFiche() {
  const nom = useFicheEntreprise((s) => s.donnees?.e.nom);
  return <>{nom ? `Entreprise · ${nom}` : 'Entreprise'}</>;
}

// Les questions de la fiche, posées en tête quand aucune page ne les prend dans sa rangée d'outils
function QuestionEnTete() {
  const question = useFicheEntreprise((s) => s.question);
  const hotes = useFicheEntreprise((s) => s.hotes);
  const { fermer } = usePanneau();
  const [occupe, setOccupe] = useState(false);
  if (!question || hotes > 0) return null;
  return (
    <div className="question-f">
      <Confirmer question={question.question} detail={question.detail} action={question.action} occupe={occupe}
        onAnnuler={() => poser({ question: null })}
        onConfirmer={async () => {
          setOccupe(true);
          await question.faire(fermer);
          setOccupe(false);
          poser({ question: null });
        }} />
    </div>
  );
}

function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return <li><span className="lib-champ">{libelle}</span>{children}</li>;
}

function Lien({ url }: { url: string | null }) {
  const href = lienSur(url);
  if (!url) return <span className="d">—</span>;
  return href ? <a className="d lien" href={href} target="_blank" rel="noopener noreferrer" title={url}>{sansProtocole(url)}</a> : <span className="d">{url}</span>;
}

function SectionAudit({ section }: { section: Section }) {
  const v = section.valeur;
  return (
    <section>
      <h4>{section.titre}</h4>
      {typeof v === 'string' && <p>{v}</p>}
      {section.type === 'liste' && Array.isArray(v) && <p>{(v as string[]).join(' · ')}</p>}
      {section.type === 'blocs' && Array.isArray(v) && (v as BlocObjet[]).map((b, i) => (
        <p key={i}>
          {b.titre && <b>{b.titre}</b>}{b.detail && <small> {b.detail}</small>}{b.titre && (b.texte || b.lignes.length > 0) && ' — '}
          {b.texte}{b.lignes.length > 0 && <small> {b.lignes.join(' · ')}</small>}
          {b.sources.map((s, n) => lienSur(s) && <a key={s} className="lien-f" href={lienSur(s)} target="_blank" rel="noopener noreferrer"> source{b.sources.length > 1 ? ` ${n + 1}` : ''}</a>)}
        </p>
      ))}
    </section>
  );
}

const CHAMPS_CORRIGES: { cle: keyof Detail; libelle: string; exemple?: string }[] = [
  { cle: 'nom', libelle: 'Nom' }, { cle: 'secteur', libelle: 'Secteur' }, { cle: 'localisation', libelle: 'Localisation' },
  { cle: 'effectif', libelle: 'Effectif', exemple: '50 - 99' }, { cle: 'dirigeant', libelle: 'Dirigeant' },
  { cle: 'site', libelle: 'Site', exemple: 'https://…' }, { cle: 'email', libelle: 'Email' }, { cle: 'telephone', libelle: 'Téléphone' },
  { cle: 'formulaire_url', libelle: 'Formulaire de candidature', exemple: 'https://…' }, { cle: 'offres_url', libelle: 'Page « nos offres »', exemple: 'https://…' },
];
const saisiesDe = (e: Detail) => Object.fromEntries(CHAMPS_CORRIGES.map((c) => [c.cle, String(e[c.cle] ?? '')]));

function Corriger({ e }: { e: Detail }) {
  const [saisis, setSaisis] = useState(() => saisiesDe(e));
  useEffect(() => setSaisis(saisiesDe(e)), [e]);
  const enregistrer = () => {
    // Seul ce qui a changé part : le serveur laisse intact ce qu'il ne reçoit pas, et un champ vidé efface la valeur
    const change = Object.fromEntries(CHAMPS_CORRIGES.filter((c) => saisis[c.cle].trim() !== String(e[c.cle] ?? '')).map((c) => [c.cle, saisis[c.cle].trim()]));
    if (!Object.keys(change).length) return dire("Rien n'a changé.");
    geste(e.siren, async () => {
      await appeler(`/entreprises/${e.siren}`, { methode: 'PATCH', corps: change });
      return `Fiche corrigée : ${Object.keys(change).join(', ')}.`;
    });
  };
  return (
    <details className="section-f cmd">
      <summary className="lib-champ">Corriger la fiche</summary>
      <div className="grille-2">
        {CHAMPS_CORRIGES.map((c) => (
          <div key={c.cle} className="champ">
            <label htmlFor={`fe-${c.cle}`}>{c.libelle}</label>
            <input id={`fe-${c.cle}`} className="saisie" type="text" value={saisis[c.cle]} placeholder={c.exemple}
              onChange={(ev) => setSaisis((s) => ({ ...s, [c.cle]: ev.target.value }))}
              onKeyDown={(ev) => ev.key === 'Enter' && enregistrer()} />
          </div>
        ))}
      </div>
      <div className="geste-f"><button type="button" className="action" onClick={enregistrer}>Enregistrer la fiche</button></div>
    </details>
  );
}

// Les gestes que la fiche réserve au compte du serveur, « Nouvel audit » en dernier, plein
function GestesAdmin({ e, dejaEnOnglet }: { e: Detail; dejaEnOnglet: boolean }) {
  const { ouvrir } = usePanneau();
  return (
    <>
      <button type="button" className="action" title="Retour à zéro complet (historique conservé)"
        onClick={() => poser({ question: {
          question: `Remettre ${e.nom} à zéro ?`,
          detail: "Elle repart en Collecter : site, mail, téléphone et résultats des briques effacés ; l'historique est conservé.",
          action: 'Reset',
          faire: () => geste(e.siren, async () => {
            await appeler(`/entreprises/${e.siren}/reset`, { methode: 'POST' });
            return 'Fiche remise à zéro.';
          }),
        } })}>Reset</button>
      <button type="button" className="action" onClick={() => lancerPhase(e.siren, 'parser')}>Lancer le parser</button>
      {/* L'audit a deux temps : une fiche entre les deux complète le brut au lieu de tout refaire */}
      {e.audit_brut_le && !e.audit_net_le && (
        <button type="button" className="action" title="Analyse le brut DÉJÀ collecté, sans le recollecter." onClick={() => lancerPhase(e.siren, 'audit')}>Compléter l&apos;audit</button>
      )}
      <button type="button" className="action plein" title="Refait la collecte ET l'analyse : un brut neuf et sa mise en forme." onClick={() => nouvelAudit(e, ouvrir, dejaEnOnglet)}>Nouvel audit{FLECHE}</button>
    </>
  );
}

function CorpsFiche({ siren, ouvrirOffre, dejaEnOnglet }: { siren: string | null; ouvrirOffre?: (cle: string) => void; dejaEnOnglet: boolean }) {
  const { donnees, erreur, avis, notes, deja } = useFicheEntreprise();
  const admin = useAdmin();
  const pageAdmin = usePageAdmin();
  const { ouvrir } = usePanneau();
  useEffect(() => {
    if (siren) charger(siren);
  }, [siren]);

  if (!siren) return <p className="texte-f">Aucune entreprise choisie.</p>;
  if (!donnees || donnees.e.siren !== siren) return <div className="fiche-ent"><p className={`avis-f${erreur ? ' erreur' : ''}`} role="status">{erreur || 'Chargement de la fiche…'}</p></div>;
  const { e, blocs, offres, historique } = donnees;
  const parser = blocs.find((b) => b.brique === 'parser');
  const audit = blocs.find((b) => b.brique === 'audit');
  const section = (b: Bloc | undefined, titre: string) => (b?.lancee ? b.sections.find((s) => s.titre === titre) : undefined);
  const activite = section(audit, 'En une phrase')?.valeur as string | null | undefined;
  const autres = ((section(parser, 'Emails')?.valeur as string[] | undefined) ?? []).filter((m) => m !== e.email);
  const couleurs = ((section(parser, 'Couleurs')?.valeur as string[] | undefined) ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  // Un bureau, c'est un numéro, une ville et une adresse ; le siège Sirene n'est qu'un repli
  const lignes = (section(parser, 'Implantations')?.valeur as string[] | undefined) ?? [];
  const lieux = lignes.some((l) => l.startsWith('Siège')) || !e.localisation ? lignes : [`Siège : ${e.localisation}`, ...lignes];
  // « En une phrase » est déjà l'Activité : il ne se répète pas
  const sections = audit?.lancee ? audit.sections.filter((s) => !s.identite && (Array.isArray(s.valeur) ? s.valeur.length : s.valeur)) : [];
  const chronologie = [
    ...historique.etats.map((h) => ({ date: h.date, texte: `${h.etat_precedent ? libelleEtat(h.etat_precedent) : '—'} → ${libelleEtat(h.etat_nouveau)} (${h.declencheur})` })),
    ...historique.evenements.map((v) => ({ date: v.date, texte: v.description })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  const nb = <span className={`nb${offres.length ? '' : ' zero'}`}>{offres.length}</span>;

  return (
    <div className="fiche-ent">
      {avis && <p className={`avis-f${avis.erreur ? ' erreur' : ''}`} role="status">{avis.texte}</p>}
      <QuestionEnTete />
      {deja && !dejaEnOnglet && deja.siren === e.siren && <div className="question-f"><CorpsDeja /><div className="geste-f"><PiedDeja /></div></div>}
      <div className="f-meta">
        <Etape etat={e.etat} />
        <Marques tags={e.tags} />
        <span className="siren">{e.siren}</span>
        {(e.audit_net_le || e.audit_brut_le) && <span className="d">{e.audit_net_le ? `audit net du ${dateCourte(e.audit_net_le)}` : `audit brut du ${dateCourte(e.audit_brut_le)}`}</span>}
      </div>
      <div className="fiche-2">
        <ul className="liste-f">
          <Champ libelle="Dirigeant"><span className="d">{e.dirigeant ?? '—'}</span></Champ>
          <Champ libelle="Secteur"><span className="d">{e.secteur ?? '—'}</span></Champ>
          <Champ libelle="Activité"><span className="d">{activite ?? '—'}</span></Champ>
          <Champ libelle="Site"><Lien url={e.site} /></Champ>
          <Champ libelle="Email"><span className="d">{e.email ?? '—'}</span></Champ>
          <Champ libelle="MX valide"><span className="d">{e.mx_valide == null ? '—' : e.mx_valide ? 'oui' : 'non'}</span></Champ>
          {autres.length > 0 && <Champ libelle="Autres emails"><span className="d">{autres.join(' · ')}</span></Champ>}
          <Champ libelle="Formulaire"><Lien url={e.formulaire_url} /></Champ>
          <Champ libelle="Offres">
            <span className="d">{lienSur(e.offres_url) ? <a href={lienSur(e.offres_url)} target="_blank" rel="noopener noreferrer" title={`Page d'offres : ${e.offres_url}`}>{nb}</a> : nb}</span>
          </Champ>
          {(e.offres_url || e.site) && (
            <li>
              <label className="inter large" title="Le cycle des jobboards fouille cette page à son heure, avec les recherches des profils actifs, et ses offres rejoignent la file.">
                Récoltée avec les jobboards
                <input type="checkbox" checked={donnees.jobboard} onChange={(ev) => {
                  const suivi = ev.target.checked;
                  geste(e.siren, async () => {
                    const r = await appeler<{ url: string }>(`/entreprises/${e.siren}/jobboard?suivi=${suivi}`, { methode: 'POST' });
                    return suivi ? `${r.url} rejoint les jobboards : le cycle des jobboards la fouillera.` : 'Fiche retirée des jobboards.';
                  });
                }} />
              </label>
            </li>
          )}
          <Champ libelle="Implantations"><span className="d pile">{lieux.length ? lieux.map((l) => <span key={l}>{l}</span>) : '—'}</span></Champ>
          {couleurs.length > 0 && <Champ libelle="Couleurs"><span className="d"><span className="couleurs">{couleurs.map((c) => <i key={c} style={{ background: c }} title={c} />)}</span></span></Champ>}
        </ul>
        {(sections.length > 0 || audit?.ok === false) && (
          <div className="audit-f">
            {audit?.ok === false && <p className="note-f">Audit en échec — {audit.resume}</p>}
            {sections.map((s) => <SectionAudit key={s.titre} section={s} />)}
          </div>
        )}
      </div>
      {admin && parser?.commande && (
        <details className="section-f cmd"><summary className="lib-champ">Commande du parser</summary><code>{parser.commande}</code></details>
      )}
      {offres.length > 0 && (
        <div className="section-f">
          <h3>Offres<span className="compteur">{offres.length}</span></h3>
          <ul className="liste-f offres-f">
            {offres.map((o) => (
              <li key={o.cle} onClick={() => {
                if (!ouvrirOffre) return;
                // La page garde l'offre choisie, la fiche ouvre son onglet
                ouvrirOffre(o.cle);
                ouvrir('fiche-offre');
              }}>
                <span className="o-date">{o.publiee_le ? dateCourte(o.publiee_le) : '—'}</span>
                <span className="o-titre" title={o.titre}>{ouvrirOffre ? <a href={`#${o.cle}`} onClick={(ev) => ev.preventDefault()}>{o.titre}</a> : o.titre}</span>
                <span className="o-lieu">{[o.lieu, o.contrat].filter(Boolean).join(' · ')}</span>
                {lienSur(o.apply_url || o.url) ? <a className="lien-f" href={lienSur(o.apply_url || o.url)} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}>postuler</a> : <span />}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="section-f">
        <h3>Historique</h3>
        <ul className="liste-f">
          {chronologie.length ? chronologie.map((c, i) => <li key={i}><span className="lib-champ">{dateHeure(c.date)}</span><span className="d">{c.texte}</span></li>) : <li><span className="d">Aucun événement.</span></li>}
        </ul>
      </div>
      <div className="section-f">
        <h3>Notes</h3>
        <textarea className="saisie" aria-label="Notes" value={notes} onChange={(ev) => poser({ notes: ev.target.value })} />
        {pageAdmin && <div className="geste-f"><BoutonNotes siren={e.siren} /></div>}
      </div>
      {admin && <Corriger e={e} />}
      {admin && !pageAdmin && (
        <div className="section-f">
          <h3>Administration<MarqueAdmin /></h3>
          <div className="geste-f">
            <button type="button" className="action rouge" onClick={() => demanderSuppression(e)}>Supprimer</button>
            <GestesAdmin e={e} dejaEnOnglet={dejaEnOnglet} />
          </div>
        </div>
      )}
    </div>
  );
}

function BoutonNotes({ siren, plein }: { siren: string; plein?: boolean }) {
  const notes = useFicheEntreprise((s) => s.notes);
  const enregistrer = () => geste(siren, async () => {
    await appeler(`/entreprises/${siren}/notes`, { methode: 'POST', corps: { notes } });
    return 'Notes enregistrées.';
  });
  return <button type="button" className={`action${plein ? ' plein' : ''}`} onClick={enregistrer}>Enregistrer les notes{plein && FLECHE}</button>;
}

function PiedFiche({ siren, dejaEnOnglet }: { siren: string | null; dejaEnOnglet: boolean }) {
  const donnees = useFicheEntreprise((s) => s.donnees);
  const admin = useAdmin();
  const pageAdmin = usePageAdmin();
  if (!siren || !donnees || donnees.e.siren !== siren) return null;
  const { e } = donnees;
  const auPied = pageAdmin && admin;
  // Écarter ne regarde que ce compte ; le même bouton le défait, la fiche retrouvant l'état d'avant
  const ecarter = e.etat === 'ECARTEE'
    ? <button type="button" className={`action${auPied ? '' : ' gauche'}`} onClick={() => geste(siren, async () => {
        const r = await appeler<{ etat: string }>(`/entreprises/${siren}/integrer`, { methode: 'POST' });
        return `Réintégrée : retour en ${libelleEtat(r.etat)}.`;
      })}>Intégrer</button>
    : <button type="button" className={`action${auPied ? '' : ' gauche'}`} onClick={() => geste(siren, async () => {
        await appeler(`/entreprises/${siren}/etat`, { methode: 'POST', corps: { nouvel_etat: 'ECARTEE' } });
        return 'Fiche écartée.';
      })}>Écarter</button>;
  if (!auPied) return <div className="pied-fiche">{ecarter}<BoutonNotes siren={siren} plein /></div>;
  return (
    <div className="pied-fiche">
      <button type="button" className="action rouge gauche" title="Retire l'entreprise de tes fiches : ce qui n'existait que pour toi part avec elle" onClick={() => demanderSuppression(e)}>Supprimer</button>
      {ecarter}
      <GestesAdmin e={e} dejaEnOnglet={dejaEnOnglet} />
    </div>
  );
}

function CorpsDeja() {
  const deja = useFicheEntreprise((s) => s.deja);
  if (!deja) return <p className="texte-f">Aucun audit à relancer.</p>;
  return (
    <>
      <p className="texte-f"><b>{deja.nom}</b> porte déjà {deja.prealable ? 'une collecte brute' : 'une analyse complète'}, du {dateCourte(deja.quand)}.</p>
      <p className="note-f">{deja.resume || '—'}</p>
      <p className="texte-f">Relancer refait l&apos;analyse et la repaie. Lire celle qui existe ne coûte rien.</p>
    </>
  );
}

function PiedDeja({ voir }: { voir?: (siren: string) => void }) {
  const deja = useFicheEntreprise((s) => s.deja);
  const { ouvrir } = usePanneau();
  if (!deja) return null;
  const quitter = (cle: string) => {
    ouvrir(cle);
    poser({ deja: null });
  };
  return (
    <>
      <button type="button" className="action" onClick={() => quitter(deja.retour)}>Annuler</button>
      <button type="button" className="action" onClick={() => {
        voir?.(deja.siren);
        quitter('fiche-entreprise');
      }}>Voir l&apos;audit</button>
      <button type="button" className="action plein" onClick={async () => {
        await deja.lancer();
        quitter(deja.retour);
      }}>Lancer quand même{FLECHE}</button>
    </>
  );
}

// La fiche d'une entreprise, onglet du panneau de la page ; `dejaEnOnglet` : la page porte aussi l'onglet « Déjà audité »
export function ongletFicheEntreprise(siren: string | null, options: { ouvrirOffre?: (cle: string) => void; dejaEnOnglet?: boolean } = {}): Onglet {
  const dejaEnOnglet = !!options.dejaEnOnglet;
  return {
    cle: 'fiche-entreprise',
    titre: <TitreFiche />,
    label: 'Fiche entreprise',
    corps: <CorpsFiche siren={siren} ouvrirOffre={options.ouvrirOffre} dejaEnOnglet={dejaEnOnglet} />,
    pied: <PiedFiche siren={siren} dejaEnOnglet={dejaEnOnglet} />,
  };
}

// « Cette entreprise a déjà un audit » ; `voir` choisit la fiche dont l'audit existe, que l'onglet ouvre ensuite
export function ongletDejaAudite(voir: (siren: string) => void): Onglet {
  return { cle: 'deja-audit', titre: 'Déjà audité', label: 'Cette entreprise a déjà un audit', corps: <CorpsDeja />, pied: <PiedDeja voir={voir} /> };
}

// La page qui pose les questions de la fiche dans sa rangée d'outils s'annonce par ce crochet, et rend ce qu'il renvoie
export function useQuestionsFiche() {
  const question = useFicheEntreprise((s) => s.question);
  useEffect(() => {
    poser((s) => ({ hotes: s.hotes + 1 }));
    return () => poser((s) => ({ hotes: s.hotes - 1 }));
  }, []);
  return question;
}
