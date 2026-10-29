'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { Confirmer } from '../../dock/Panneau';

// Ce que les pages Offres et Veille lisent d'Illusion
export type Passage = { source: string; statut?: number; vues?: number; lues?: number; erreur?: string; sans_objet?: boolean };
export type Source = { nom: string; active?: boolean; prete?: boolean; manquantes?: string[]; bloquee?: string };
export type Cycle = { date?: string; ok?: boolean; erreur?: string; journal?: string; sources?: Source[]; passages?: Passage[]; dernieres_offres?: Record<string, string> };
export type EtatVeille = {
  en_cours: boolean; etape: string; rotation_armee: boolean; rotation_minutes: number; tri_en_cours: boolean;
  prochain_dans: number | null; cycle: Cycle; stock: { offres: number };
};
export type Plateforme = { nom: string; actif: boolean };
export type ProfilVeille = { nom: string; langue: string; actif: boolean; plateformes: Plateforme[]; depuis_jours: number; par_source: number; max_fiches: number; titre_exact: boolean };
export type ProfilRecherche = { nom: string; actif: boolean; langue: string; mots_cles: string[]; mots_bannis: string[]; departements: string[]; profils_candidature: string[] };
export type Jobboard = { url: string; nom: string; actif: boolean; veille: boolean; siren: string };
export type Parametres = {
  departements: string[]; profils_recherche: ProfilRecherche[]; profils_veille: ProfilVeille[]; jobboards: Jobboard[];
  jobboards_heure: string; jobboards_periode_heures: number; veille_periode_minutes: number; veille_timeout_secondes: number;
  veille_socle_avant: string; veille_tri_modele: string; veille_ats_par_cycle: number; modeles: { nom: string; modele?: string }[];
  [cle: string]: unknown;
};
export type ReponseParametres = Parametres & { rejeu_bannis?: { ecartees?: number } };

// Les plateformes de la brique Veille, dans l'ordre de l'ancien dashboard
export const SOURCES: Record<string, string> = {
  france_travail: 'France Travail', apec: 'APEC', free_work: 'Free-Work', wttj: 'Welcome to the Jungle', hellowork: 'HelloWork',
  linkedin: 'LinkedIn', adzuna: 'Adzuna', jooble: 'Jooble', careerjet: 'Careerjet', indeed: 'Indeed', ats: 'Boards employeurs',
};
export const libelleSource = (s: string) => SOURCES[s] ?? s;

// Les langues proposées ; un code déjà posé hors de cette liste reste proposé tel quel
export const LANGUES: Record<string, string> = { fr: 'Français', en: 'Anglais', de: 'Allemand', es: 'Espagnol', it: 'Italien', pt: 'Portugais', nl: 'Néerlandais' };

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const liste = (texte: string) => texte.split(',').map((v) => v.trim()).filter(Boolean);
export const nomFiche = (chemin: string) => String(chemin).split(/[\\/]/).pop() ?? '';
export const sansJson = (nom: string) => nom.replace(/\.json$/i, '');

// « 2026-10-28 » → « 28/10 »
export function jourMois(iso: string) {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[2]}/${m[1]}` : '—';
}

// Une date d'Illusion, sans fuseau elle est en UTC
export function dateDe(texte: string) {
  const iso = texte.trim().replace(' ', 'T');
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
}
export const heure = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
export const ICONES = {
  etiquettes: <svg {...TRAIT}><path d="M3 3h8l10 10-8 8L3 11z" /><path d="M7.5 7.5h.01" /></svg>,
  vider: <svg {...TRAIT}><path d="M4 6h16M6 6l1 14h10l1-14M9 10l6 6M15 10l-6 6" /></svg>,
  recherche: <svg {...TRAIT}><path d="M3 5h10M3 10h6M3 15h4" /><circle cx="15" cy="14" r="4" /><path d="m21 20-3.2-3.2" /></svg>,
  plus: <svg {...TRAIT} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
  fleche: <svg {...TRAIT} strokeWidth={2.6}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  reglages: <svg {...TRAIT}><polygon points="22.3,10.2 22.3,13.8 19.4,13.8 18.5,15.9 20.6,18.0 18.0,20.6 15.9,18.5 13.8,19.4 13.8,22.3 10.2,22.3 10.2,19.4 8.1,18.5 6.0,20.6 3.4,18.0 5.5,15.9 4.6,13.8 1.7,13.8 1.7,10.2 4.6,10.2 5.5,8.1 3.4,6.0 6.0,3.4 8.1,5.5 10.2,4.6 10.2,1.7 13.8,1.7 13.8,4.6 15.9,5.5 18.0,3.4 20.6,6.0 18.5,8.1 19.4,10.2" /><circle cx="12" cy="12" r="3" /></svg>,
  arret: <svg {...TRAIT}><path d="M7 7h10v10H7z" fill="currentColor" /></svg>,
  marche: <svg {...TRAIT}><path d="M8 5v14l11-7z" fill="currentColor" /></svg>,
  veilles: <svg {...TRAIT}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>,
  croix: <svg {...TRAIT} strokeWidth={2.4}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  chevron: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>,
};

// Relit `lire` toutes les `ms` tant que l'onglet du navigateur est visible, et aussitôt qu'il le redevient
export function useSondage(lire: () => void, ms: number) {
  const fn = useRef(lire);
  useEffect(() => {
    fn.current = lire;
  });
  useEffect(() => {
    let minuteur = 0;
    const armer = () => {
      window.clearInterval(minuteur);
      if (document.visibilityState === 'visible') minuteur = window.setInterval(() => fn.current(), ms);
    };
    const changer = () => {
      if (document.visibilityState === 'visible') fn.current();
      armer();
    };
    armer();
    document.addEventListener('visibilitychange', changer);
    return () => {
      window.clearInterval(minuteur);
      document.removeEventListener('visibilitychange', changer);
    };
  }, [ms]);
}

// Les notifications de l'ancien dashboard : 3,5 s, une erreur un peu plus
export function useAvis() {
  const [avis, setAvis] = useState<{ texte: string; erreur: boolean; n: number } | null>(null);
  const dire = useCallback((texte: string, erreur = false) => setAvis((a) => ({ texte, erreur, n: (a?.n ?? 0) + 1 })), []);
  useEffect(() => {
    if (!avis) return;
    const t = window.setTimeout(() => setAvis(null), avis.erreur ? 6000 : 3500);
    return () => window.clearTimeout(t);
  }, [avis]);
  const vue = avis ? <p key={avis.n} className={`avis${avis.erreur ? ' erreur' : ''}`} role={avis.erreur ? 'alert' : 'status'}>{avis.texte}</p> : null;
  return { dire, vue };
}

// L'état de la veille du compte, relu toutes les 5 s comme le bandeau de l'ancien dashboard ; une panne se dit une fois
export function useEtatVeille(dire: (t: string, e?: boolean) => void) {
  const [etat, setEtat] = useState<EtatVeille | null>(null);
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
  useEffect(() => {
    lire();
  }, [lire]);
  useSondage(lire, 5000);
  return [etat, lire] as const;
}

// Les gestes ADMIN sur tout le stock : rejouer les étiquettes et vider les offres
export function useGestesStock(etat: EtatVeille | null, relire: () => void, dire: (t: string, e?: boolean) => void, apresVider: () => void) {
  const [confirmer, setConfirmer] = useState(false);
  const [occupe, setOccupe] = useState(false);
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

  const vider = async () => {
    setOccupe(true);
    try {
      const r = await appeler<{ supprimees: number }>('/offres/vider', { methode: 'POST' });
      dire(`${r.supprimees} offre(s) supprimée(s).`);
      setConfirmer(false);
      apresVider();
    } catch (e) {
      dire(message(e), true);
    }
    setOccupe(false);
    relire();
  };

  const barre = confirmer ? (
    <Confirmer
      question="Vider les offres ?"
      admin
      occupe={occupe}
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

// Pagination sans cadres : « auto » tient la hauteur de la fenêtre, puis 25 ou 50 ; les trois premières et dernières pages, un « … » où taper la page voulue
export type Taille = 'auto' | 25 | 50;
export function Pagination({ page, pages, taille, auto, surPage, surTaille }: {
  page: number; pages: number; taille: Taille; auto: number; surPage: (n: number) => void; surTaille: (t: Taille) => void;
}) {
  const [aller, setAller] = useState('');
  const vues = pages <= 7 ? Array.from({ length: pages }, (_, i) => i + 1) : [1, 2, 3, ...(page > 3 && page < pages - 2 ? [page] : []), pages - 2, pages - 1, pages];
  const bouton = (n: number) => (
    <button key={n} type="button" className={`pl${n === page ? ' actif' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => surPage(n)}>{n}</button>
  );
  return (
    <div className="pagination">
      <select aria-label="Lignes par page" value={String(taille)} onChange={(e) => surTaille(e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as 25 | 50))}>
        <option value="auto">auto ({auto})</option>
        <option value="25">25</option>
        <option value="50">50</option>
      </select>
      <nav className="pages" aria-label="Pages">
        <button type="button" className="pl" disabled={page <= 1} aria-label="Page précédente" onClick={() => surPage(page - 1)}>‹</button>
        {vues.slice(0, pages <= 7 ? pages : vues.length - 3).map(bouton)}
        {pages > 7 && (
          <input
            type="text" className="aller" inputMode="numeric" placeholder="…" size={3} aria-label="Aller à la page" value={aller}
            onChange={(e) => setAller(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !aller) return;
              surPage(Math.min(pages, Math.max(1, Number(aller))));
              setAller('');
            }}
          />
        )}
        {pages > 7 && vues.slice(-3).map(bouton)}
        <button type="button" className="pl" disabled={page >= pages} aria-label="Page suivante" onClick={() => surPage(page + 1)}>›</button>
      </nav>
    </div>
  );
}

// Menu d'un filtre en texte : une colonne de choix, le choix courant allumé ; un clic ailleurs ou Échap le referme
export type Choix = { cle: string; libelle: string; n?: number };
export function MenuFiltre({ lib, valeur, actif, choix, courant, choisir }: {
  lib: string; valeur: string; actif: boolean; choix: Choix[]; courant: string; choisir: (cle: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const hote = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!hote.current?.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Avant la page : Échap ferme le menu, pas le panneau
      e.preventDefault();
      setOuvert(false);
    };
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', echap, true);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      document.removeEventListener('keydown', echap, true);
    };
  }, [ouvert]);
  return (
    <div ref={hote} className="menu-hote menu-filtre">
      <button type="button" className={`filtre${actif ? ' actif' : ''}`} aria-haspopup="listbox" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        <span><span className="lib">{lib}</span>{valeur}</span>
        {ICONES.chevron}
      </button>
      {ouvert && (
        <div className="menu verre" role="listbox" aria-label={lib}>
          <span className="verre-halos" aria-hidden="true" />
          {choix.map((c) => (
            <button
              key={c.cle} type="button" role="option" aria-selected={c.cle === courant}
              className={`menu-option${c.cle === courant ? ' actif' : ''}`}
              onClick={() => {
                choisir(c.cle);
                setOuvert(false);
              }}
            >
              {c.libelle}{c.n !== undefined && <span className="compteur">{c.n}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Profils de veille : une carte par langue, dans l'ordre où le cycle les mène ; elles se déplacent par leur poignée ⠿
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
    plateformes: [...new Set([...Object.keys(SOURCES), ...posees.keys()])].map((nom) => ({ nom, actif: !!posees.get(nom) })),
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
  const [cartes, setCartes] = useState<CarteVeille[]>([]);
  const [retrait, setRetrait] = useState<number | null>(null);
  const [glisse, setGlisse] = useState<number | null>(null);
  const liste = useRef<HTMLDivElement>(null);
  const reprendre = useCallback(() => setCartes((parametres?.profils_veille ?? []).map((v) => carteVeille(v, true))), [parametres]);
  useEffect(() => reprendre(), [reprendre]);

  const enregistrees = JSON.stringify((parametres?.profils_veille ?? []).map((v) => lireVeille(carteVeille(v, true))));
  const change = JSON.stringify(cartes.map(lireVeille)) !== enregistrees;
  const modifier = (id: number, champs: Partial<CarteVeille>) => setCartes((cs) => cs.map((c) => (c.id === id ? { ...c, ...champs } : c)));
  const deplacer = (id: number, vers: number) => setCartes((cs) => {
    const de = cs.findIndex((c) => c.id === id);
    if (de < 0 || vers < 0 || vers >= cs.length || de === vers) return cs;
    const copie = [...cs];
    copie.splice(vers, 0, ...copie.splice(de, 1));
    return copie;
  });
  const sauver = async () => {
    if (await enregistrer({ profils_veille: cartes.map(lireVeille) })) setRetrait(null);
  };

  // La carte suit la main : survolée à mi-hauteur d'une autre, elle prend sa place
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
    <div ref={liste} className="cartes" onKeyDown={(e) => {
      if (e.key === 'Enter' && (e.target as HTMLElement).matches('input:not([type=checkbox])') && change) sauver();
    }}>
      {cartes.map((c, rang) => (
        <article key={c.id} data-carte className={`carte-f${glisse === c.id ? ' en-vol' : ''}`} aria-label={`Veille ${c.nom || 'nouvelle'}`}>
          <div className="grille-2">
            <div className="champ"><label htmlFor={`pv${c.id}-nom`}>Nom</label><input id={`pv${c.id}-nom`} className="saisie" value={c.nom} placeholder="Veille FR" onChange={(e) => modifier(c.id, { nom: e.target.value })} /></div>
            <div className="champ"><label htmlFor={`pv${c.id}-langue`} title="La veille mène les profils de recherche actifs de cette langue.">Langue</label><ChoixLangue id={`pv${c.id}-langue`} valeur={c.langue} changer={(langue) => modifier(c.id, { langue })} /></div>
          </div>
          <div className="champ">
            <span className="lib-champ" title="Aucune cochée : toutes celles dont les clés sont posées.">Plateformes</span>
            <span className="puces">
              {c.plateformes.map((p) => (
                <label key={p.nom} className="choix puce-p">
                  <input type="checkbox" className="cache" checked={p.actif} onChange={(e) => modifier(c.id, { plateformes: c.plateformes.map((q) => (q.nom === p.nom ? { ...q, actif: e.target.checked } : q)) })} />
                  {libelleSource(p.nom)}
                </label>
              ))}
            </span>
          </div>
          {NOMBRES_VEILLE.map((n) => (
            <label key={n.cle} className="reglage" title={n.aide}>{n.libelle}<input className="saisie" type="number" min={0} value={c[n.cle]} onChange={(e) => modifier(c.id, { [n.cle]: e.target.value })} /></label>
          ))}
          <label className="inter" title="Ne garder que les intitulés qui contiennent la recherche.">Intitulé exact<input type="checkbox" checked={c.titre_exact} onChange={(e) => modifier(c.id, { titre_exact: e.target.checked })} /></label>
          <label className="inter">Active<input type="checkbox" checked={c.actif} onChange={(e) => modifier(c.id, { actif: e.target.checked })} /></label>
          {retrait === c.id ? (
            <Confirmer
              question="Retirer cette veille ?" admin action="Retirer"
              detail="Effet à l'enregistrement."
              onAnnuler={() => setRetrait(null)}
              onConfirmer={() => {
                setCartes((cs) => cs.filter((x) => x.id !== c.id));
                setRetrait(null);
              }}
            />
          ) : (
            <div className="carte-pied">
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
              <button type="button" className="lien-d" title={c.enregistree ? `${c.nom || 'Cette veille'} ne sera plus menée : les profils de recherche de sa langue ne tourneront plus, sauf sous une autre veille de la même langue.` : undefined}
                onClick={() => (c.enregistree ? setRetrait(c.id) : setCartes((cs) => cs.filter((x) => x.id !== c.id)))}>Retirer</button>
            </div>
          )}
        </article>
      ))}
      {!cartes.length && <p className="texte-f">Aucune veille : sans veille active, rien ne part.</p>}
    </div>
  );
  const pied = (
    <>
      <button type="button" className="action gauche" onClick={() => setCartes((cs) => [...cs, carteVeille({ langue: 'en', actif: true }, false)])}><span className="ico">{ICONES.plus}</span>Nouvelle veille</button>
      <button type="button" className="action" disabled={!change} onClick={reprendre}>Annuler</button>
      <button type="button" className="action plein" disabled={!change} onClick={sauver}>Enregistrer<span className="ico">{ICONES.fleche}</span></button>
    </>
  );
  return { corps, pied };
}

// Enregistre des réglages et dit ce que les termes bannis rejoués ont sorti de la file, comme l'ancien dashboard
export async function enregistrerReglages(modifs: Partial<Parametres>, dire: (t: string, e?: boolean) => void): Promise<ReponseParametres | null> {
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
