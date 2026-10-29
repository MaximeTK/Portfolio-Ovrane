'use client';

import './workflows.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { appeler, ErreurIllusion } from '../../api';
import { Activite } from '../../activite/Activite';
import { useSondage } from '../../activite/sondage';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, MarqueAdmin, Panneau } from '../../dock/Panneau';
import { nomProfil } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import {
  message, ongletComparaison, ongletIncomplet, ongletRejeu, ongletVerification, useOngletChamp, useOngletRejouer,
  type Champ, type DemandeRejeu, type EtatRejeu, type Incomplet, type Signalement, type Verification,
} from './panneaux';

// L'arbre d'un site tel que /workflows/site le rend : ses pages, leurs lignes de haut en bas, mes réponses par profil
type Valeur = { fiche?: string; avec?: string; format?: string; ia?: unknown; reponse?: unknown; fixe?: string; cv?: unknown; lettre?: unknown } | null;
type Voie = { lignes?: Ligne[]; suspecte?: number; cle?: string };
type Ligne = {
  id?: string; geste?: string; libelle?: string; requis?: boolean; section?: string; cible?: Record<string, unknown>; valeur?: Valeur;
  si?: string; facultatif?: boolean; ferme?: boolean; pour_chaque?: { liste: string; ordre: string }; vers?: string[];
  ouvre?: { lignes?: Ligne[]; si?: string }; voies?: Voie[];
};
type Carte = {
  site: string; candidatures: number; reponses: Record<string, { profil: string; valeur: unknown }[]>;
  arbres: { page: string; cle: string; candidatures: number; arbre: { lignes?: Ligne[] } }[];
};
type Avis = { texte: string; erreur?: boolean } | null;
type Retrait = { cle: string; aiguillage: string; voie: string };
type Contexte = { site: string; cle: string; reponses: Carte['reponses']; nomPage: (adresse: string) => string; retirer: (r: Retrait) => void };

// Le rejeu se relit chaque seconde tant qu'il tourne, comme dans l'ancien dashboard
const PAS_REJEU_MS = 1000;

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', 'aria-hidden': true } as const;
const ICONES = {
  loupe: <svg {...TRAIT}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>,
  chevron: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>,
  portee: <svg {...TRAIT} strokeWidth={2.4}><path d="m6 9 6 6 6-6" /></svg>,
  bouclier: <svg {...TRAIT} strokeLinejoin="miter"><path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>,
  jouer: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>,
};

// D'où une ligne tire sa valeur, et la cible qu'elle vise, dits comme l'ancien dashboard
function source(v: Valeur): string {
  if (v == null) return 'laissé vide';
  if (v.fiche) return `fiche : ${v.fiche}${v.avec ? ` + ${v.avec}` : ''}${v.format ? ` (${v.format})` : ''}`;
  if (v.ia) return "IA, propre à l'offre";
  if (v.reponse) return 'réponse du profil';
  if (v.fixe) return `« ${v.fixe} »`;
  if (v.cv) return "CV de l'offre";
  if (v.lettre) return "lettre de l'offre";
  return JSON.stringify(v);
}
const cible = (c: Record<string, unknown>) => Object.entries(c).map(([k, v]) => `${k}=${v && typeof v === 'object' ? source(v as Valeur) : String(v)}`).join(' ');

export default function PageWorkflows({ compte }: ProprietesPage) {
  const admin = compte.admin;
  const [recherche, setRecherche] = useState('');
  const [adresse, setAdresse] = useState('');
  const [carte, setCarte] = useState<Carte | null>(null);
  const [erreurCarte, setErreurCarte] = useState('');
  const [rang, setRang] = useState(0);
  const [rejeu, setRejeu] = useState<EtatRejeu>({ en_cours: false });
  const [pasLu, setPasLu] = useState<number | null>(null);
  const [signales, setSignales] = useState<Set<number>>(() => new Set());
  const [verif, setVerif] = useState<Verification | null>(null);
  const [erreurVerif, setErreurVerif] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [avis, setAvis] = useState<Avis>(null);
  const erreur = (e: unknown) => setAvis({ texte: message(e), erreur: true });

  // L'arbre d'un site ou de l'adresse d'une de ses offres ; `garder` reste sur la même page après une correction
  const afficher = useCallback(async (voulue: string, garder = false) => {
    const a = voulue.trim();
    if (!a) return;
    setRecherche(a);
    setAdresse(a);
    try {
      const lue = await appeler<Carte>(`/workflows/site?adresse=${encodeURIComponent(a)}`);
      setCarte(lue);
      setErreurCarte('');
      setRang((r) => (garder ? Math.min(r, Math.max(0, lue.arbres.length - 1)) : 0));
    } catch (e) {
      setCarte(null);
      setErreurCarte(message(e));
    }
  }, []);

  const lireVerif = useCallback(async () => {
    try {
      const [{ signalements }, { donnees }, { champs }] = await Promise.all([
        appeler<{ signalements: Signalement[] }>('/signalements'),
        appeler<{ donnees: Verification['donnees'] }>('/donnees-demandees'),
        appeler<{ champs: Verification['champs'] }>('/schema-profil'),
      ]);
      const connues = new Set(champs.map((c) => c.cle));
      setVerif({ signalements, donnees: donnees.filter((d) => !connues.has(d.cle)), champs });
      setErreurVerif('');
    } catch (e) {
      setErreurVerif(message(e));
    }
  }, []);

  // Un passage lancé avant d'avoir quitté la page se retrouve en y revenant, avec l'arbre de son site
  useEffect(() => {
    appeler<EtatRejeu>('/workflows/rejeu').then((e) => {
      setRejeu(e);
      if (e.url) void afficher(e.url);
    }).catch(() => {});
    if (admin) void lireVerif();
  }, [admin, afficher, lireVerif]);

  const lireRejeu = useCallback(async () => {
    try {
      setRejeu(await appeler<EtatRejeu>(pasLu === null ? '/workflows/rejeu' : `/workflows/rejeu?pas=${pasLu}`));
    } catch {
      // un relevé manqué se refait au suivant
    }
  }, [pasLu]);
  useSondage(lireRejeu, PAS_REJEU_MS, rejeu.en_cours, pasLu);
  useEffect(() => setSignales(new Set()), [rejeu.url]);

  // Une étape du journal à la fois ; revenue à la dernière, elle suit de nouveau le passage
  const lirePas = async (sens: number) => {
    const total = rejeu.pas_total ?? 1;
    const voulu = Math.max(0, Math.min(total - 1, (pasLu ?? total - 1) + sens));
    setPasLu(voulu === total - 1 ? null : voulu);
    try {
      setRejeu(await appeler<EtatRejeu>(`/workflows/rejeu?pas=${voulu}`));
    } catch (e) {
      erreur(e);
    }
  };
  const ordonner = async (ordre: 'suivant' | 'auto' | 'arreter') => {
    setOccupe(true);
    try {
      setRejeu(await appeler<EtatRejeu>('/workflows/rejeu/ordre', { methode: 'POST', corps: { ordre } }));
    } catch (e) {
      erreur(e);
    }
    setOccupe(false);
  };
  const conclure = async (geste: 'fusionner' | 'remplacer' | 'annuler') => {
    setOccupe(true);
    try {
      const e = await appeler<EtatRejeu>('/workflows/rejeu/conclure', { methode: 'POST', corps: { geste } });
      setRejeu(e);
      setAvis({ texte: { fusionner: 'Workflow refait fusionné à celui en base.', remplacer: 'Workflow refait mis à la place de celui en base.', annuler: 'Workflow refait annulé : celui en base ne bouge pas.' }[geste] });
      // Rangé dans la base, le workflow refait se relit ; annulé, rien n'a bougé
      if (geste !== 'annuler' && e.url) await afficher(e.url, true);
    } catch (e) {
      erreur(e);
    }
    setOccupe(false);
  };
  // Un signalement part en attente de vérification : rien ne change avant
  const signaler = async (n: number) => {
    const c = (rejeu.champs ?? [])[n];
    if (!c) return;
    try {
      await appeler('/signalements', { methode: 'POST', corps: { site: c.site ?? '', ligne: c.ligne ?? '', page: c.page ?? '', question: c.question ?? '', source: c.source ?? {} } });
      setSignales((s) => new Set(s).add(n));
      setAvis({ texte: 'Signalement envoyé : il sera vérifié avant toute correction.' });
      if (admin) void lireVerif();
    } catch (e) {
      erreur(e);
    }
  };
  const rejeter = async (s: Signalement) => {
    setOccupe(true);
    try {
      await appeler(`/signalements/${encodeURIComponent(s.cle)}/rejeter`, { methode: 'POST' });
      setAvis({ texte: 'Signalement rejeté : la ligne reste telle quelle.' });
      await lireVerif();
    } catch (e) {
      erreur(e);
    }
    setOccupe(false);
  };
  // Validé, le signalement pose un champ du profil de tous sur la ligne ; ce qu'on y avait répondu ne vaut plus
  const valider = async (s: Signalement, champ: Champ) => {
    const fait = await appeler<{ champ: { libelle: string }; reponses_caduques: number }>(`/signalements/${encodeURIComponent(s.cle)}/valider`, { methode: 'POST', corps: champ });
    setAvis({ texte: `La ligne pose désormais « ${fait.champ.libelle} » ; ${fait.reponses_caduques} réponse(s) caduque(s).` });
    await lireVerif();
    if (carte?.site === s.site) await afficher(carte.site, true);
  };

  const rejeuIci = !!rejeu.url && (!carte || rejeu.site === carte.site);
  return (
    <Dock id="workflows" principal="arbre" fenetres={{ arbre: { mini: [470, 260] } }} panneau={null}>
      <Activite />
      <FenetreArbre admin={admin} recherche={recherche} setRecherche={setRecherche} afficher={afficher} carte={carte} erreurCarte={erreurCarte}
        rang={rang} setRang={setRang} nbVerif={(verif?.signalements.length ?? 0) + (verif?.donnees.length ?? 0)} rejeuEnCours={rejeuIci && rejeu.en_cours}
        avis={avis} setAvis={setAvis} />
      <PanneauWorkflows admin={admin} adresse={adresse} carte={carte} afficher={afficher} rejeu={rejeu} setRejeu={setRejeu} rejeuIci={rejeuIci}
        setPasLu={setPasLu} occupe={occupe} signales={signales} lirePas={(s) => void lirePas(s)} ordonner={(o) => void ordonner(o)}
        signaler={(n) => void signaler(n)} conclure={conclure} verif={verif} erreurVerif={erreurVerif} rejeter={(s) => void rejeter(s)} valider={valider} />
    </Dock>
  );
}

type ProprietesArbre = {
  admin: boolean; recherche: string; setRecherche: (r: string) => void; afficher: (a: string, garder?: boolean) => Promise<void>;
  carte: Carte | null; erreurCarte: string; rang: number; setRang: (r: number) => void; nbVerif: number; rejeuEnCours: boolean;
  avis: Avis; setAvis: (a: Avis) => void;
};

// La fenêtre principale : la recherche d'un site, son résumé, la page choisie et son arbre, une ligne par geste
function FenetreArbre({ admin, recherche, setRecherche, afficher, carte, erreurCarte, rang, setRang, nbVerif, rejeuEnCours, avis, setAvis }: ProprietesArbre) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const [menu, setMenu] = useState(false);
  const [ouverte, setOuverte] = useState(false);
  const [retrait, setRetrait] = useState<Retrait | null>(null);
  const [occupe, setOccupe] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  // Échap ferme le menu, sinon la confirmation, sinon le panneau
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (menu) setMenu(false);
      else if (retrait) setRetrait(null);
      else fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [menu, retrait, fermer]);
  // Un avis se lit 3,5 s, une erreur 8 s
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis, setAvis]);

  const retirer = async () => {
    if (!retrait || !carte) return;
    setOccupe(true);
    try {
      await appeler('/workflows/voie/retirer', { methode: 'POST', corps: retrait });
      setAvis({ texte: "Voie retirée de l'arbre : si le site la remontre, l'IA la réapprendra." });
      setRetrait(null);
      await afficher(carte.site, true);
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    }
    setOccupe(false);
  };

  const page = carte?.arbres[rang];
  const ctx: Contexte | null = carte && page ? {
    site: carte.site, cle: page.cle, reponses: carte.reponses, retirer: setRetrait,
    // Un bouton qui change de page dit laquelle, par son rang dans le filtre
    nomPage: (a) => {
      const i = carte.arbres.findIndex((p) => p.page === a);
      return i >= 0 ? `page ${i + 1}` : a;
    },
  } : null;
  const n = carte?.arbres.length ?? 0;
  return (
    <Fenetre id="arbre" as="main" className="tableau workflows" aria-label="Workflows" titrePrise="Glisser pour détacher l'arbre du site">
      <div className="outils">
        <div className={`cherche${ouverte ? ' ouverte' : ''}`} role="search">
          <button type="button" className="loupe" aria-label="Chercher un site" onClick={() => { setOuverte(true); requestAnimationFrame(() => champ.current?.focus()); }}>{ICONES.loupe}</button>
          <input ref={champ} type="search" placeholder="smartrecruiters.com, ou l'adresse d'une offre" aria-label="Site ou adresse d'une offre" value={recherche}
            onChange={(e) => setRecherche(e.target.value)} onFocus={() => setOuverte(true)} onBlur={() => setOuverte(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') { void afficher(recherche); champ.current?.blur(); } }} />
        </div>
        {carte && <p className="resume"><b>{carte.site}</b><span>{n} page(s) · {carte.candidatures} candidature(s) apprises</span></p>}
        {carte && n > 0 && (
          <MenuPages carte={carte} rang={rang} ouvert={menu} basculer={() => setMenu(!menu)} fermer={() => setMenu(false)} choisir={(i) => { setRang(i); setMenu(false); }} />
        )}
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          {admin && (
            <button type="button" className={`action${onglet === 'verification' || onglet === 'champ' ? ' allume' : ''}`} title="Vérification" aria-haspopup="dialog"
              aria-expanded={onglet === 'verification'} onClick={() => ouvrir('verification')}>
              <span className="ico">{ICONES.bouclier}</span><span className="txt">Vérification</span>{nbVerif > 0 && <span className="compteur">{nbVerif}</span>}<MarqueAdmin />
            </button>
          )}
          <button type="button" className="action plein" aria-haspopup="dialog" aria-expanded={onglet === 'rejouer' || onglet === 'rejeu'} onClick={() => ouvrir(rejeuEnCours ? 'rejeu' : 'rejouer')}>
            Rejouer<span className="ico">{ICONES.jouer}</span>
          </button>
        </div>
      </div>
      {retrait && (
        <Confirmer question="Retirer cette voie ?" detail="Si le site la remontre, l'IA la réapprendra." action="Retirer" occupe={occupe}
          onAnnuler={() => setRetrait(null)} onConfirmer={() => void retirer()} />
      )}
      <div className="arbre">
        {page && ctx ? (
          <>
            <div className="arbre-tete" aria-hidden="true"><span>N°</span><span>Geste</span><span>Libellé · marques</span><span>Cible</span><span>Source de la valeur</span></div>
            <div className="arbre-defile"><Lignes lignes={page.arbre.lignes ?? []} ctx={ctx} label={`Arbre de la page ${rang + 1} : ${page.page}`} /></div>
          </>
        ) : (
          <p className="vide-wf">{erreurCarte ? <><b>Aucun workflow à montrer.</b> {erreurCarte}</>
            : carte ? 'Aucune page apprise pour ce site.' : "Cherchez un site, ou collez l'adresse d'une de ses offres : son arbre s'affiche ici, page par page."}</p>
        )}
      </div>
      {avis && <p className={`avis-wf${avis.erreur ? ' erreur' : ''}`} role={avis.erreur ? 'alert' : 'status'} onClick={() => setAvis(null)}>{avis.texte}</p>}
    </Fenetre>
  );
}

// Le filtre de page et son menu : chaque page du site, sa clé et ses candidatures ; un clic ailleurs le referme
function MenuPages({ carte, rang, ouvert, basculer, fermer, choisir }: {
  carte: Carte; rang: number; ouvert: boolean; basculer: () => void; fermer: () => void; choisir: (i: number) => void;
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
  const n = carte.arbres.length;
  return (
    <div ref={hote} className="menu-hote filtre-hote">
      <button type="button" className="filtre actif" aria-haspopup="listbox" aria-expanded={ouvert} aria-label={`Page : ${rang + 1} sur ${n}`} title={carte.arbres[rang]?.page} onClick={basculer}>
        <span><span className="lib">Page</span>{rang + 1} / {n}</span>{ICONES.chevron}
      </button>
      {ouvert && (
        <div className="menu verre" role="listbox" aria-label="Pages du site">
          <span className="verre-halos" aria-hidden="true" />
          {carte.arbres.map((a, i) => (
            <button key={a.cle} type="button" role="option" aria-selected={i === rang} className={`menu-option${i === rang ? ' actif' : ''}`} onClick={() => choisir(i)}>
              <span className="num">{i + 1}</span><span className="adr">{a.cle}</span><span className="compteur">{a.candidatures}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Les lignes d'une portée, de haut en bas ; chaque section du formulaire passe en titre au-dessus des siennes
function Lignes({ lignes, ctx, label }: { lignes: Ligne[]; ctx: Contexte; label?: string }) {
  const morceaux: React.ReactNode[] = [];
  let section = '';
  lignes.forEach((l, i) => {
    if ((l.section ?? '') !== section) {
      section = l.section ?? '';
      if (section) morceaux.push(<li key={`section-${i}`} className="sec">{section}</li>);
    }
    morceaux.push(<LigneArbre key={l.id ?? i} ligne={l} rang={i + 1} ctx={ctx} />);
  });
  return <ol className="arbre-l" aria-label={label}>{morceaux}</ol>;
}

// Une ligne : rang, geste, libellé et marques, cible, source ; ce qu'un clic ouvre et les voies d'un aiguillage se replient dessous
function LigneArbre({ ligne, rang, ctx }: { ligne: Ligne; rang: number; ctx: Contexte }) {
  const marques = [ligne.si && `si ${ligne.si}`, ligne.facultatif && 'facultatif', ligne.ferme && 'ferme',
    ligne.pour_chaque && `pour chaque ${ligne.pour_chaque.liste} · ${ligne.pour_chaque.ordre}`].filter(Boolean) as string[];
  const reponses = (ctx.reponses[`arbre:${ligne.id}`] ?? []).map((r) => `${nomProfil(r.profil)} « ${String(r.valeur ?? '')} »`).join('\n');
  const vise = ligne.cible ? cible(ligne.cible) : '';
  return (
    <li>
      <div className="l" title={ligne.id}>
        <span className="rg">{rang}</span>
        <span className="ge">{ligne.geste ?? ''}</span>
        <span className="lb"><b>{ligne.libelle}{ligne.requis && <em>*</em>}</b>
          {marques.map((m) => <span key={m} className="mq">{m}</span>)}
          {!!ligne.vers?.length && <span className="mq vers">→ {ligne.vers.map(ctx.nomPage).join(' ou ')}</span>}
        </span>
        <span className="ci">{vise || '—'}</span>
        <span className="so" title={reponses ? `Réponses rangées :\n${reponses}` : undefined}>{'valeur' in ligne ? source(ligne.valeur ?? null) : <i>—</i>}</span>
      </div>
      {(ligne.ouvre || !!ligne.voies?.length) && (
        <div className="sous">
          {ligne.ouvre && (
            <details className="portee" open>
              <summary>{ICONES.portee}ouvre {(ligne.ouvre.lignes ?? []).length} ligne(s){ligne.ouvre.si ? ` si « ${ligne.ouvre.si} »` : ''}</summary>
              <Lignes lignes={ligne.ouvre.lignes ?? []} ctx={ctx} />
            </details>
          )}
          {(ligne.voies ?? []).map((v, n) => (
            <details key={v.cle ?? n} className="portee" open={!!v.lignes?.length}>
              <summary>{ICONES.portee}voie {n + 1}{v.lignes?.length ? ` · ${v.lignes.length} ligne(s)` : ' · rien à faire'}, prise si l&apos;écran la montre
                {!!v.suspecte && (
                  <> · <span className="morte">peut-être morte : {v.suspecte} dossiers de suite sans elle</span>
                    <button type="button" className="retirer" aria-haspopup="dialog" aria-label={`Retirer la voie ${n + 1}`}
                      onClick={(e) => { e.preventDefault(); ctx.retirer({ cle: `${ctx.site}|${ctx.cle}`, aiguillage: ligne.id ?? '', voie: v.cle ?? '' }); }}>Retirer</button>
                  </>
                )}
              </summary>
              {!!v.lignes?.length && <Lignes lignes={v.lignes} ctx={ctx} />}
            </details>
          ))}
        </div>
      )}
    </li>
  );
}

type ProprietesPanneau = {
  admin: boolean; adresse: string; carte: Carte | null; afficher: (a: string, garder?: boolean) => Promise<void>;
  rejeu: EtatRejeu; setRejeu: (e: EtatRejeu) => void; rejeuIci: boolean; setPasLu: (p: number | null) => void; occupe: boolean; signales: Set<number>;
  lirePas: (sens: number) => void; ordonner: (o: 'suivant' | 'auto' | 'arreter') => void; signaler: (n: number) => void;
  conclure: (g: 'fusionner' | 'remplacer' | 'annuler') => Promise<void>; verif: Verification | null; erreurVerif: string;
  rejeter: (s: Signalement) => void; valider: (s: Signalement, champ: Champ) => Promise<void>;
};

// Le panneau : Rejouer, le Rejeu en cours ou fini, sa Comparaison, la Vérification de l'admin et les fenêtres d'un geste, en onglets
function PanneauWorkflows({ admin, adresse, carte, afficher, rejeu, setRejeu, rejeuIci, setPasLu, occupe, signales, lirePas, ordonner, signaler, conclure, verif, erreurVerif, rejeter, valider }: ProprietesPanneau) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const [incomplet, setIncomplet] = useState<Incomplet | null>(null);
  const [cible, setCible] = useState<Signalement | null>(null);

  // Lancé, le passage s'ouvre dans son onglet ; un profil aux champs obligatoires vides ouvre « Profil incomplet »
  const lancer = async (d: DemandeRejeu) => {
    try {
      const e = await appeler<EtatRejeu>('/workflows/rejeu', { methode: 'POST', corps: d });
      setPasLu(null);
      setRejeu(e);
      if (e.site && e.site !== carte?.site) await afficher(e.url ?? d.url);
      ouvrir('rejeu');
    } catch (e) {
      const donnees = e instanceof ErreurIllusion ? e.donnees as { message?: string; profils_incomplets?: Incomplet['profils'] } | undefined : undefined;
      if (!donnees?.profils_incomplets) throw e;
      setIncomplet({ message: donnees.message ?? message(e), profils: donnees.profils_incomplets });
      ouvrir('profil-incomplet');
    }
  };
  const rejouer = useOngletRejouer({ actif: onglet === 'rejouer', adresse, site: carte?.site ?? '', lancer });
  const champ = useOngletChamp({
    cible, champs: verif?.champs ?? [],
    valider: async (s, c) => {
      await valider(s, c);
      setCible(null);
      ouvrir('verification');
    },
    annuler: () => {
      setCible(null);
      ouvrir('verification');
    },
  });
  // Un workflow refait qui attend d'être rangé montre aussitôt sa comparaison
  const attend = rejeuIci && !!rejeu.comparaison;
  const avant = useRef(attend);
  useEffect(() => {
    if (attend && !avant.current && onglet === 'rejeu') ouvrir('comparaison');
    avant.current = attend;
  }, [attend, onglet, ouvrir]);

  const onglets = [
    ...(onglet === 'rejouer' ? [rejouer] : []),
    ...(rejeuIci ? [ongletRejeu({ rejeu, occupe, signales, lirePas, ordonner, signaler })] : []),
    ...(attend ? [ongletComparaison(rejeu, occupe, (g) => void conclure(g).then(() => ouvrir('rejeu')))] : []),
    ...(admin ? [ongletVerification({ verif, erreur: erreurVerif, occupe, valider: (s) => { setCible(s); ouvrir('champ'); }, rejeter, fermer })] : []),
    ...(admin && onglet === 'champ' && cible ? [champ] : []),
    ...(onglet === 'profil-incomplet' && incomplet ? [ongletIncomplet(incomplet, () => ouvrir('rejouer'))] : []),
  ];
  return <Panneau onglets={onglets} />;
}
