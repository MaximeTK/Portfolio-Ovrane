'use client';

import './workflows.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { appeler, ErreurIllusion } from '../../api';
import { repris, useGarder } from '../../stockage';

import { useSondage } from '../../activite/sondage';
import { Fenetre, usePanneau, useVues } from '../../dock/Dock';
import { Confirmer, MarqueAdmin, Panneau } from '../../dock/Panneau';
import { envoyerSignalement } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import {
  ongletChamp, ongletComparaison, ongletIncomplet, ongletRejeu, ongletVerification, useOngletRejouer,
  type Champ, type DemandeRejeu, type EtatRejeu, type Incomplet, type Signalement, type Verification,
} from './panneaux';
import { useEchap, useGeste } from '../commun';
import { MenuTenu, OptionMenu } from '../../elements/Menu';
import { Action } from '../../elements/Action';
import { ICONES } from '../../elements/icones';
import { useAvis, type Dire } from '../../elements/Avis';
import { message, nomProfil } from '../../elements/format';
import { PageDock } from '../../activite/PageDock';

// Arbre d'un site comme /workflows/site le rend, réponses par profil.
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
type Retrait = { cle: string; aiguillage: string; voie: string };
type Contexte = { site: string; cle: string; reponses: Carte['reponses']; nomPage: (adresse: string) => string; retirer: (r: Retrait) => void };

// Le rejeu est relu chaque seconde tant qu'il tourne.
const PAS_REJEU_MS = 1000;



// D'où une ligne tire sa valeur et la cible qu'elle vise.
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
  // Lecture et choix gardés d'une visite à l'autre, relus derrière.
  const [recherche, setRecherche] = useState(() => repris('workflows:recherche', ''));
  const [adresse, setAdresse] = useState(() => repris('workflows:adresse', ''));
  const [carte, setCarte] = useState(() => repris<Carte | null>('workflows:carte', null));
  const [erreurCarte, setErreurCarte] = useState('');
  const [rang, setRang] = useState(() => repris('workflows:rang', 0));
  const [rejeu, setRejeu] = useState(() => repris<EtatRejeu>('workflows:rejeu', { en_cours: false }));
  const [pasLu, setPasLu] = useState(() => repris<number | null>('workflows:pasLu', null));
  const [signales, setSignales] = useState(() => repris('workflows:signales', new Set<number>()));
  const [verif, setVerif] = useState(() => repris<Verification | null>('workflows:verif', null));
  useGarder('workflows', { recherche, adresse, carte, rang, rejeu, pasLu, signales, verif });
  const [erreurVerif, setErreurVerif] = useState('');
  const { dire, vue: avis } = useAvis('avis-wf', true);
  const { occupe, geste: agir } = useGeste((t) => dire(t, true));
  const erreur = (e: unknown) => dire(message(e), true);

  // Arbre d'un site ou d'une offre ; `garder` reste sur la page.
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

  // Au retour, l'arbre et l'étape gardés se relisent ; sinon l'arbre du passage.
  const depart = useRef({ adresse, pas: pasLu });
  useEffect(() => {
    const { adresse: gardee, pas } = depart.current;
    if (gardee) void afficher(gardee, true);
    appeler<EtatRejeu>(pas === null ? '/workflows/rejeu' : `/workflows/rejeu?pas=${pas}`).then((e) => {
      setRejeu(e);
      if (e.url && !gardee) void afficher(e.url);
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
  // Un autre passage efface les signalements marqués ; ceux du gardé restent.
  const urlSignales = useRef(rejeu.url);
  useEffect(() => {
    if (urlSignales.current !== rejeu.url) setSignales(new Set());
    urlSignales.current = rejeu.url;
  }, [rejeu.url]);

  // Une étape du journal à la fois ; revenue à la dernière, elle suit le passage.
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
  const ordonner = (ordre: 'suivant' | 'auto' | 'arreter') => agir(async () => {
    setRejeu(await appeler<EtatRejeu>('/workflows/rejeu/ordre', { methode: 'POST', corps: { ordre } }));
  });
  const conclure = (geste: 'fusionner' | 'remplacer' | 'annuler') => agir(async () => {
    const e = await appeler<EtatRejeu>('/workflows/rejeu/conclure', { methode: 'POST', corps: { geste } });
    setRejeu(e);
    dire({ fusionner: 'Workflow refait fusionné à celui en base.', remplacer: 'Workflow refait mis à la place de celui en base.', annuler: 'Workflow refait annulé : celui en base ne bouge pas.' }[geste]);
    // Rangé dans la base, le workflow refait se relit ; annulé, rien n'a bougé
    if (geste !== 'annuler' && e.url) await afficher(e.url, true);
  });
  // Un signalement part en attente de vérification : rien ne change avant
  const signaler = async (n: number) => {
    const c = (rejeu.champs ?? [])[n];
    if (!c) return;
    try {
      const texte = await envoyerSignalement(c);
      setSignales((s) => new Set(s).add(n));
      dire(texte);
      if (admin) void lireVerif();
    } catch (e) {
      erreur(e);
    }
  };
  const rejeter = (s: Signalement) => agir(async () => {
    await appeler(`/signalements/${encodeURIComponent(s.cle)}/rejeter`, { methode: 'POST' });
    dire('Signalement rejeté : la ligne reste telle quelle.');
    await lireVerif();
  });
  // Un signalement validé pose un champ du profil de tous ; la réponse tombe.
  const valider = async (s: Signalement, champ: Champ) => {
    const fait = await appeler<{ champ: { libelle: string }; reponses_caduques: number }>(`/signalements/${encodeURIComponent(s.cle)}/valider`, { methode: 'POST', corps: champ });
    dire(`La ligne pose désormais « ${fait.champ.libelle} » ; ${fait.reponses_caduques} réponse(s) caduque(s).`);
    await lireVerif();
    if (carte?.site === s.site) await afficher(carte.site, true);
  };

  const rejeuIci = !!rejeu.url && (!carte || rejeu.site === carte.site);
  return (
    <PageDock id="workflows" principal="arbre" fenetres={{ arbre: { mini: [470, 260] } }} panneau={null}>
      <FenetreArbre admin={admin} recherche={recherche} setRecherche={setRecherche} afficher={afficher} carte={carte} erreurCarte={erreurCarte}
        rang={rang} setRang={setRang} nbVerif={(verif?.signalements.length ?? 0) + (verif?.donnees.length ?? 0)} rejeuEnCours={rejeuIci && rejeu.en_cours}
        avis={avis} dire={dire} />
      <PanneauWorkflows admin={admin} adresse={adresse} carte={carte} afficher={afficher} rejeu={rejeu} setRejeu={setRejeu} rejeuIci={rejeuIci}
        setPasLu={setPasLu} occupe={occupe} signales={signales} lirePas={(s) => void lirePas(s)} ordonner={(o) => void ordonner(o)}
        signaler={(n) => void signaler(n)} conclure={conclure} verif={verif} erreurVerif={erreurVerif} rejeter={(s) => void rejeter(s)} valider={valider} />
    </PageDock>
  );
}

type ProprietesArbre = {
  admin: boolean; recherche: string; setRecherche: (r: string) => void; afficher: (a: string, garder?: boolean) => Promise<void>;
  carte: Carte | null; erreurCarte: string; rang: number; setRang: (r: number) => void; nbVerif: number; rejeuEnCours: boolean;
  avis: React.ReactNode; dire: Dire;
};

// Fenêtre principale : recherche, résumé, page choisie et arbre.
function FenetreArbre({ admin, recherche, setRecherche, afficher, carte, erreurCarte, rang, setRang, nbVerif, rejeuEnCours, avis, dire }: ProprietesArbre) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const [menu, setMenu] = useState(false);
  const [ouverte, setOuverte] = useState(false);
  const [retrait, setRetrait] = useState<Retrait | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  // Échap ferme le menu, sinon la confirmation, sinon le panneau
  useEchap(() => {
    if (menu) setMenu(false);
    else if (retrait) setRetrait(null);
    else fermer();
  });

  const retirer = async () => {
    if (!retrait || !carte) return;
    try {
      await appeler('/workflows/voie/retirer', { methode: 'POST', corps: retrait });
      dire("Voie retirée de l'arbre : si le site la remontre, l'IA la réapprendra.");
      setRetrait(null);
      await afficher(carte.site, true);
    } catch (e) {
      dire(message(e), true);
    }
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
            <Action allume={onglet === 'verification' || onglet === 'champ'} icone={ICONES.bouclier} title="Vérification" aria-haspopup="dialog" aria-expanded={onglet === 'verification'} onClick={() => ouvrir('verification')}><span className="txt">Vérification</span>{nbVerif > 0 && <span className="compteur">{nbVerif}</span>}<MarqueAdmin />
            </Action>
          )}
          <Action plein iconeApres={ICONES.jouer} aria-haspopup="dialog" aria-expanded={onglet === 'rejouer' || onglet === 'rejeu'} onClick={() => ouvrir(rejeuEnCours ? 'rejeu' : 'rejouer')}>
            Rejouer
          </Action>
        </div>
      </div>
      {retrait && (
        <Confirmer question="Retirer cette voie ?" detail="Si le site la remontre, l'IA la réapprendra." action="Retirer"
          onAnnuler={() => setRetrait(null)} onConfirmer={retirer} />
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
      {avis}
    </Fenetre>
  );
}

// Filtre de page : pages, clés et candidatures ; un clic ailleurs le ferme.
function MenuPages({ carte, rang, ouvert, basculer, fermer, choisir }: {
  carte: Carte; rang: number; ouvert: boolean; basculer: () => void; fermer: () => void; choisir: (i: number) => void;
}) {
  const n = carte.arbres.length;
  return (
    <MenuTenu ouvert={ouvert} basculer={basculer} fermer={fermer} classeHote="filtre-hote" actif lib="Page" valeur={`${rang + 1} / ${n}`} titre="Pages du site" icone={ICONES.chevron}
      aria-label={`Page : ${rang + 1} sur ${n}`} title={carte.arbres[rang]?.page}>
      {carte.arbres.map((a, i) => (
        <OptionMenu key={a.cle} actif={i === rang} onClick={() => choisir(i)}>
          <span className="num">{i + 1}</span><span className="adr">{a.cle}</span><span className="compteur">{a.candidatures}</span>
        </OptionMenu>
      ))}
    </MenuTenu>
  );
}

// Lignes d'une portée ; chaque section du formulaire passe en titre.
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

// Ligne : rang, geste, libellé, marques, cible, source ; le reste se replie.
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

// Panneau en onglets : Rejouer, Rejeu, Comparaison, Vérification, gestes.
function PanneauWorkflows({ admin, adresse, carte, afficher, rejeu, setRejeu, rejeuIci, setPasLu, occupe, signales, lirePas, ordonner, signaler, conclure, verif, erreurVerif, rejeter, valider }: ProprietesPanneau) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const { focus } = useVues();
  const [incomplet, setIncomplet] = useState<Incomplet | null>(null);

  // Lancé, le passage a son onglet ; un profil incomplet ouvre son avis.
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
  // Validé ou abandonné, le champ rend la main : retour à la Vérification.
  const rendre = () => (focus === 'panneau' ? ouvrir('verification') : fermer());
  // Un signalement par sa clé ; traité, il le dit sans fermer le panneau.
  const elements = {
    champ: (cle: string) => {
      const s = verif?.signalements.find((x) => x.cle === cle);
      return s ? ongletChamp(s, { champs: verif?.champs ?? [], valider: async (x, c) => { await valider(x, c); rendre(); }, annuler: rendre })
        : { cle: 'champ', titre: 'Champ du profil', admin: true, corps: <p className="texte-f">{verif ? 'Ce signalement est traité.' : 'Lecture des signalements…'}</p> };
    },
  };
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
    ...(admin ? [ongletVerification({ verif, erreur: erreurVerif, occupe, valider: (s) => ouvrir('champ', s.cle), rejeter, fermer })] : []),
    ...(onglet === 'profil-incomplet' && incomplet ? [ongletIncomplet(incomplet, () => ouvrir('rejouer'))] : []),
  ];
  return <Panneau elements={elements} onglets={onglets} />;
}
