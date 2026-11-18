'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { appeler, televerser } from '../../api';
import { repris, useGarder } from '../../stockage';
import { useSondage } from '../../activite/sondage';
import { Confirmer } from '../../dock/Panneau';

import { MenuFiltre as Filtre } from '../../elements/Menu';
import { Action } from '../../elements/Action';
import type { Dire } from '../../elements/Avis';
import { Champ, Interrupteur, ChampSaisie } from '../../elements/Champ';
import { ICONES } from '../../elements/icones';
import { LANGUES, PLATEFORMES, libelleSource, message } from '../../elements/format';
import { useGeste } from '../commun';

// Ce que les pages Offres et Veille lisent d'Illusion
export type Passage = { source: string; statut?: number; vues?: number; lues?: number; erreur?: string; sans_objet?: boolean };
export type Source = { nom: string; active?: boolean; prete?: boolean; manquantes?: string[]; bloquee?: string };
export type Cycle = { date?: string; ok?: boolean; erreur?: string; journal?: string; sources?: Source[]; passages?: Passage[]; dernieres_offres?: Record<string, string> };
type EtatVeille = {
  en_cours: boolean; etape: string; rotation_armee: boolean; rotation_minutes: number; tri_en_cours: boolean;
  prochain_dans: number | null; cycle: Cycle; stock: { offres: number };
};
export type Plateforme = { nom: string; actif: boolean };
type ProfilVeille = { nom: string; langue: string; actif: boolean; plateformes: Plateforme[]; depuis_jours: number; par_source: number; max_fiches: number; titre_exact: boolean };
export type ProfilRecherche = { nom: string; actif: boolean; langue: string; mots_cles: string[]; mots_bannis: string[]; departements: string[]; profils_candidature: string[] };
export type Jobboard = { url: string; nom: string; actif: boolean; veille: boolean; siren: string; utilisateurs?: string[]; illusion?: boolean };
export type Parametres = {
  departements: string[]; profils_recherche: ProfilRecherche[]; profils_veille: ProfilVeille[]; jobboards: Jobboard[];
  jobboards_heure: string; jobboards_periode_heures: number; veille_periode_minutes: number; veille_timeout_secondes: number;
  veille_socle_avant: string; veille_tri_modele: string; veille_ats_par_cycle: number; modeles: { nom: string; modele?: string }[];
  [cle: string]: unknown;
};
type ReponseParametres = Parametres & { rejeu_bannis?: { ecartees?: number } };

// État de la veille du compte relu toutes les 5 s ; une panne se dit une fois
export function useEtatVeille(dire: Dire) {
  // Gardé d'une visite à l'autre (Offres et Veille), relu en arrière-plan
  const [etat, setEtat] = useState(() => repris<EtatVeille | null>('veille:etat', null));
  useGarder('veille', { etat });
  const enPanne = useRef(false);
  const lire = useCallback(async () => {
    try {
      setEtat(await appeler<EtatVeille>('/veille?taille=10&page=1'));
      enPanne.current = false;
    } catch (e) {
      if (!enPanne.current) dire(message(e), true);
      enPanne.current = true;
    }
  }, [dire]);
  useSondage(lire, 5000);
  return [etat, lire] as const;
}

// Gestes ADMIN sur tout le stock : rejouer les étiquettes et vider les offres
export function useGestesStock(etat: EtatVeille | null, relire: () => void, dire: Dire, apresVider: () => void) {
  const [confirmer, setConfirmer] = useState(false);
  const { geste } = useGeste((t) => dire(t, true));
  const plusTard = () => window.setTimeout(relire, 1500);

  const etiquettes = async () => {
    try {
      if (etat?.tri_en_cours) {
        await appeler('/briques/tri/arreter', { methode: 'POST' });
        dire('Arrêt demandé — le paquet en cours se termine.');
      } else {
        const r = await appeler<{ lancee: boolean; soeur?: string }>('/veille/tri', { methode: 'POST' });
        dire(r.lancee ? 'Tri IA relancé sur tout le stock, paquet par paquet.' : r.soeur ? `Impossible maintenant : ${r.soeur} tourne.` : 'Le tri tourne déjà.', !r.lancee);
      }
    } catch (e) {
      dire(message(e), true);
    }
    relire();
    plusTard();
  };

  const vider = () => geste(async () => {
    const r = await appeler<{ supprimees: number }>('/offres/vider', { methode: 'POST' });
    dire(`${r.supprimees} offre(s) supprimée(s).`);
    setConfirmer(false);
    apresVider();
  }, () => {
    relire();
  });

  const barre = confirmer ? (
    <Confirmer
      question="Vider les offres ?"
      admin
      detail={`Les ${etat?.stock.offres ?? 0} offres du stock partent, celles de la file comme les écartées ; les fiches entreprises restent.`}
      action="Vider"
      onConfirmer={vider}
      onAnnuler={() => setConfirmer(false)}
    />
  ) : null;

  const titreTri = etat?.tri_en_cours
    ? 'Arrête le tri en cours : le paquet commencé se termine.'
    : "Rejuge par le modèle les intitulés de tout le stock (hors offres déjà traitées et ajoutées à la main), paquet par paquet jusqu'au bout : les hors métier passent en « Tri par IA ». Puis chaque offre gardée, envoyées comprises, est rangée dans les métiers de son profil de recherche.";
  return { etiquettes, libelleTri: etat?.tri_en_cours ? 'Arrêter les étiquettes' : 'Rejouer les étiquettes', titreTri, ouvrirVider: () => setConfirmer(true), confirmer, fermerVider: () => setConfirmer(false), barre };
}

// « auto » tient la hauteur, puis 25 ou 50
export type Taille = 'auto' | 25 | 50;

// Menu d'un filtre : choix courant allumé ; clic ailleurs ou Échap le ferme
export type Choix = { cle: string; libelle: string; n?: number };
export function MenuFiltre(p: { lib: string; valeur: string; actif: boolean; choix: Choix[]; courant: string; choisir: (cle: string) => void }) {
  return <Filtre {...p} classeHote="menu-filtre" />;
}

// Réglages gardés d'une visite à l'autre, relus à l'arrivée
export function useParametresVeille(section: string, dire: Dire, apres?: () => void) {
  const [parametres, setParametres] = useState(() => repris<Parametres | null>(`${section}:parametres`, null));
  useGarder(section, { parametres });
  useEffect(() => {
    appeler<Parametres>('/parametres').then(setParametres, (e) => dire(message(e), true));
  }, [dire]);
  const enregistrer = useCallback(async (modifs: Partial<Parametres>) => {
    const r = await enregistrerReglages(modifs, dire);
    if (!r) return false;
    setParametres(r);
    apres?.();
    return true;
  }, [dire, apres]);
  return { parametres, enregistrer };
}

// Entrée dans une saisie que `selecteur` vise lance le geste
export const surEntree = (agir: () => unknown, selecteur: string) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && (e.target as HTMLElement).matches(selecteur)) agir();
};

// L'éditeur de cartes : ce qui est lu, ce qui a changé, le retrait à confirmer
export function useCartes<S, C extends { id: number }>({ source, carte, lire, sauver }: {
  source: S[] | undefined; carte: (s: S, enregistree: boolean) => C; lire: (c: C) => S; sauver: (lus: S[]) => Promise<boolean>;
}) {
  const [cartes, setCartes] = useState<C[]>(() => (source ?? []).map((s) => carte(s, true)));
  const [retrait, setRetrait] = useState<number | null>(null);
  const reprendre = useCallback(() => setCartes((source ?? []).map((s) => carte(s, true))), [source, carte]);
  useEffect(() => reprendre(), [reprendre]);
  return {
    cartes, setCartes, retrait, setRetrait, reprendre,
    change: JSON.stringify(cartes.map(lire)) !== JSON.stringify((source ?? []).map((s) => lire(carte(s, true)))),
    modifier: (id: number, champs: Partial<C>) => setCartes((cs) => cs.map((c) => (c.id === id ? { ...c, ...champs } : c))),
    retirer: (id: number) => setCartes((cs) => cs.filter((c) => c.id !== id)),
    sauver: async () => {
      if (await sauver(cartes.map(lire))) setRetrait(null);
    },
  };
}

// Le pied d'une carte : retirer une carte enregistrée se confirme d'abord
export function RetraitCarte({ cartes, id, enregistree, question, admin, titre, avant, children }: {
  cartes: { retrait: number | null; setRetrait: (id: number | null) => void; retirer: (id: number) => void };
  id: number; enregistree: boolean; question: string; admin?: boolean; titre: string; avant?: React.ReactNode; children?: React.ReactNode;
}) {
  const { retrait, setRetrait, retirer } = cartes;
  if (retrait === id) {
    return (
      <Confirmer
        question={question} admin={admin} action="Retirer"
        detail="Effet à l'enregistrement."
        onAnnuler={() => setRetrait(null)}
        onConfirmer={() => {
          retirer(id);
          setRetrait(null);
        }}
      />
    );
  }
  return (
    <div className="carte-pied">
      {avant}
      <button type="button" className="lien-d" title={enregistree ? titre : undefined} onClick={() => (enregistree ? setRetrait(id) : retirer(id))}>Retirer</button>
      {children}
    </div>
  );
}

// Le pied de l'éditeur : ajouter à gauche, annuler et enregistrer à droite
export function PiedCartes({ libelle, ajouter, change, reprendre, sauver }: { libelle: string; ajouter: () => void; change: boolean; reprendre: () => void; sauver: () => void }) {
  return (
    <>
      <Action className="gauche" icone={ICONES.plus_pages} onClick={ajouter}>{libelle}</Action>
      <Action disabled={!change} onClick={reprendre}>Annuler</Action>
      <Action plein iconeApres={ICONES.fleche_pages} disabled={!change} onClick={sauver}>Enregistrer</Action>
    </>
  );
}

// Profils de veille : une carte par langue, dans l'ordre du cycle, déplaçable
const NOMBRES_VEILLE = [
  { cle: 'depuis_jours', libelle: 'Fenêtre (jours)', defaut: 1, aide: 'Ne retenir que les offres publiées depuis N jours. 0 : sans limite.' },
  { cle: 'par_source', libelle: 'Résultats par intitulé', defaut: 300, aide: 'Offres demandées à chaque plateforme, par intitulé cherché ; chacune a son propre plafond.' },
  { cle: 'max_fiches', libelle: 'Fiches ouvertes', defaut: 12, aide: 'Fiches ouvertes par cycle sur un site sans API : seules les nouvelles coûtent une requête.' },
] as const;
type CleNombre = (typeof NOMBRES_VEILLE)[number]['cle'];
type CarteVeille = { id: number; enregistree: boolean; nom: string; langue: string; actif: boolean; titre_exact: boolean; plateformes: Plateforme[] } & Record<CleNombre, string>;

let numero = 0;
const carteVeille = (v: Partial<ProfilVeille>, enregistree: boolean): CarteVeille => {
  const posees = new Map((v.plateformes ?? []).map((p) => [p.nom, p.actif]));
  return {
    id: ++numero, enregistree, nom: v.nom ?? '', langue: v.langue || 'fr', actif: v.actif !== false, titre_exact: !!v.titre_exact,
    plateformes: [...new Set([...Object.keys(PLATEFORMES), ...posees.keys()])].map((nom) => ({ nom, actif: !!posees.get(nom) })),
    depuis_jours: String(v.depuis_jours ?? 1), par_source: String(v.par_source ?? 300), max_fiches: String(v.max_fiches ?? 12),
  };
};
const lireVeille = (c: CarteVeille): ProfilVeille => ({
  nom: c.nom.trim(), langue: c.langue, actif: c.actif, titre_exact: c.titre_exact, plateformes: c.plateformes,
  ...(Object.fromEntries(NOMBRES_VEILLE.map((n) => {
    const v = parseInt(c[n.cle], 10);
    return [n.cle, Number.isNaN(v) ? n.defaut : v];
  })) as Record<CleNombre, number>),
});

export function ChoixLangue({ id, valeur, changer, label }: { id: string; valeur: string; changer: (v: string) => void; label?: string }) {
  const codes = valeur in LANGUES ? LANGUES : { ...LANGUES, [valeur]: valeur };
  return (
    <select id={id} className="saisie" value={valeur} aria-label={label} onChange={(e) => changer(e.target.value)}>
      {Object.entries(codes).map(([code, nom]) => <option key={code} value={code}>{nom} ({code})</option>)}
    </select>
  );
}

// L'éditeur des profils de veille, corps et pied d'un onglet du panneau
export function useProfilsVeille(parametres: Parametres | null, enregistrer: (m: Partial<Parametres>) => Promise<boolean>) {
  const editeur = useCartes({ source: parametres?.profils_veille, carte: carteVeille, lire: lireVeille, sauver: (lus) => enregistrer({ profils_veille: lus }) });
  const { cartes, setCartes, reprendre, change, modifier, sauver } = editeur;
  const [glisse, setGlisse] = useState<number | null>(null);
  const liste = useRef<HTMLDivElement>(null);
  const deplacer = (id: number, vers: number) => setCartes((cs) => {
    const de = cs.findIndex((c) => c.id === id);
    if (de < 0 || vers < 0 || vers >= cs.length || de === vers) return cs;
    const copie = [...cs];
    copie.splice(vers, 0, ...copie.splice(de, 1));
    return copie;
  });

  // La carte suit la main : survolée à mi-hauteur d'une autre, elle la remplace
  useEffect(() => {
    if (glisse === null) return;
    const bouger = (e: PointerEvent) => {
      const autres = [...(liste.current?.querySelectorAll<HTMLElement>('[data-carte]') ?? [])];
      const vers = autres.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return e.clientY >= r.top && e.clientY <= r.bottom;
      });
      if (vers >= 0) deplacer(glisse, vers);
    };
    const lacher = () => setGlisse(null);
    window.addEventListener('pointermove', bouger);
    window.addEventListener('pointerup', lacher);
    return () => {
      window.removeEventListener('pointermove', bouger);
      window.removeEventListener('pointerup', lacher);
    };
  }, [glisse]);

  const corps = (
    <div ref={liste} className="cartes" onKeyDown={surEntree(() => change && sauver(), 'input:not([type=checkbox])')}>
      {cartes.map((c, rang) => (
        <article key={c.id} data-carte className={`carte-f${glisse === c.id ? ' en-vol' : ''}`} aria-label={`Veille ${c.nom || 'nouvelle'}`}>
          <div className="grille-2">
            <ChampSaisie id={`pv${c.id}-nom`} libelle="Nom" value={c.nom} placeholder="Veille FR" onChange={(e) => modifier(c.id, { nom: e.target.value })} />
            <Champ pour={`pv${c.id}-langue`} titre="La veille mène les profils de recherche actifs de cette langue." libelle="Langue"><ChoixLangue id={`pv${c.id}-langue`} valeur={c.langue} changer={(langue) => modifier(c.id, { langue })} /></Champ>
          </div>
          <Champ titre="Aucune cochée : toutes celles dont les clés sont posées." groupe libelle="Plateformes">
            <span className="puces">
              {c.plateformes.map((p) => (
                <label key={p.nom} className="choix puce-p">
                  <input type="checkbox" className="cache" checked={p.actif} onChange={(e) => modifier(c.id, { plateformes: c.plateformes.map((q) => (q.nom === p.nom ? { ...q, actif: e.target.checked } : q)) })} />
                  {libelleSource(p.nom)}
                </label>
              ))}
            </span>
          </Champ>
          {NOMBRES_VEILLE.map((n) => (
            <label key={n.cle} className="reglage" title={n.aide}>{n.libelle}<input className="saisie" type="number" min={0} value={c[n.cle]} onChange={(e) => modifier(c.id, { [n.cle]: e.target.value })} /></label>
          ))}
          <Interrupteur libelle="Intitulé exact" title="Ne garder que les intitulés qui contiennent la recherche." checked={c.titre_exact} onChange={(e) => modifier(c.id, { titre_exact: e.target.checked })} />
          <Interrupteur libelle="Active" checked={c.actif} onChange={(e) => modifier(c.id, { actif: e.target.checked })} />
          <RetraitCarte
            cartes={editeur} id={c.id} enregistree={c.enregistree} question="Retirer cette veille ?" admin
            titre={`${c.nom || 'Cette veille'} ne sera plus menée : les profils de recherche de sa langue ne tourneront plus, sauf sous une autre veille de la même langue.`}
            avant={
              <span
                className="poignee-carte" role="button" tabIndex={0} title="Glisser pour changer l'ordre des veilles"
                aria-label={`Déplacer la veille ${c.nom} (flèches haut et bas)`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setGlisse(c.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    deplacer(c.id, rang + (e.key === 'ArrowUp' ? -1 : 1));
                  }
                }}
              >⠿</span>
            }
          />
        </article>
      ))}
      {!cartes.length && <p className="texte-f">Aucune veille : sans veille active, rien ne part.</p>}
    </div>
  );
  const pied = <PiedCartes libelle="Nouvelle veille" ajouter={() => setCartes((cs) => [...cs, carteVeille({ langue: 'en', actif: true }, false)])} change={change} reprendre={reprendre} sauver={sauver} />;
  return { corps, pied };
}

// Un lien web sans espace suffit à mettre une offre en file
export const urlOffreValide = (url: string) => /^https?:\/\/\S+$/i.test(url.trim());

type OffreAjoutee = { neuve: boolean; entreprise_siren: string | null };
// Met l'offre en file, avec le CV imposé s'il y en a un
export async function posterOffre(saisie: { url: string; entreprise: string; titre: string; profil: string }, cv: File | null) {
  return appeler<OffreAjoutee>('/offres', { methode: 'POST', corps: { ...saisie, url: saisie.url.trim(), ...(cv ? { cv: await televerser(cv) } : {}) } });
}

// L'avis d'un ajout ; déjà en base, le texte `deja`, en erreur
export const avisAjout = (r: OffreAjoutee, deja: string): [string, boolean] =>
  (r.neuve ? [`Offre ajoutée à la file${r.entreprise_siren ? ' et rattachée à sa fiche' : ''}.`, false] : [deja, true]);

// Enregistre les réglages et dit ce que les termes bannis rejoués ont sorti
async function enregistrerReglages(modifs: Partial<Parametres>, dire: Dire): Promise<ReponseParametres | null> {
  try {
    const r = await appeler<ReponseParametres>('/parametres', { methode: 'PUT', corps: modifs });
    const sorties = r.rejeu_bannis?.ecartees;
    dire(sorties ? `Réglages enregistrés — mots bannis rejoués : ${sorties} offre(s) sortie(s) de la file, de retour au cycle qui suit la levée du terme.` : 'Réglages enregistrés — les lots les reprennent aussitôt.');
    return r;
  } catch (e) {
    dire(`Enregistrement refusé : ${message(e)}`, true);
    return null;
  }
}
