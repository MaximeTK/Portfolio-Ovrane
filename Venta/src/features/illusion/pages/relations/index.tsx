'use client';

import './relations.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { appeler } from '../../api';
import { Activite } from '../../activite/Activite';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, Panneau, type Onglet } from '../../dock/Panneau';
import type { ProprietesPage } from '../liste';

// Ce que /relations rend pour le nuage, et /relations/{numero} pour la fiche
type Personne = { numero: number; nom: string; etiquettes?: string[]; entreprise?: string; poste?: string; echanges: number };
type Donnees = { personnes: Personne[]; liens: { de: number; vers: number; nature: string }[] };
type Echange = { numero: number; genre: string; date: string; titre: string; contenu: string };
type Fiche = {
  numero: number; nom: string; etiquettes: string[]; entreprise: string; poste: string; contexte: string; emails: string[]; telephones: string[];
  linkedin: string; notes: string; resume: string; sujets: string[]; faits: { texte: string; genre?: string; date?: string }[];
  liens: { numero: number; nature: string; nom: string }[]; echanges: Echange[];
};
type AppelCourt = { id: number; titre: string; debut: string };
type Avis = { texte: string; erreur?: boolean } | null;
type Vue = { x: number; y: number; l: number; h: number };

// Une couleur par étiquette, dans l'ordre des grappes ; au-delà, elles se répètent
const TEINTES = [265, 150, 25, 200, 330, 85, 0, 115, 230, 300];
const LARGEUR = 1150;
const HAUTEUR = 620;
const SANS = 'sans étiquette';
const CHAMPS = [
  ['nom', 'Nom'], ['etiquettes', 'Étiquettes', 'liste'], ['entreprise', 'Entreprise'], ['poste', 'Poste'],
  ['contexte', 'Comment vous vous connaissez', 'long'], ['emails', 'E-mails', 'liste'], ['telephones', 'Téléphones', 'liste'],
  ['linkedin', 'LinkedIn'], ['notes', 'Notes personnelles', 'long'],
] as const;
type Cle = (typeof CHAMPS)[number][0];
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
// Une date d'Illusion, en UTC sans fuseau écrit
const utc = (t: string) => new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(t) ? t : `${t}Z`);
const jour = (iso?: string) => (iso ? utc(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '');
const quand = (iso: string) => utc(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const groupe = (p: Personne) => p.etiquettes?.[0] || SANS;
const cote = (p: Personne) => 9 + Math.min(7.2, Math.sqrt(p.echanges || 0) * 4.2);

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
const ICONES = {
  loupe: <svg {...TRAIT}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>,
  televerser: <svg {...TRAIT}><path d="M12 15V3M7 8l5-5 5 5M4 15v6h16v-6" /></svg>,
  lapis: <svg {...TRAIT}><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.5 3-6 7-6" /><circle cx="17" cy="16" r="3" /><path d="m21 20-1.8-1.8" /></svg>,
  plus: <svg {...TRAIT} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
  coche: <svg {...TRAIT} strokeWidth={2.6}><path d="M5 12l5 5L20 7" /></svg>,
  supprimer: <svg {...TRAIT}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
};

// Le nuage : une grappe par première étiquette, chaque personne posée en spirale de tournesol autour de son centre
function disposer(personnes: Personne[]) {
  const groupes = new Map<string, Personne[]>();
  for (const p of personnes) groupes.set(groupe(p), [...(groupes.get(groupe(p)) ?? []), p]);
  const ordre = [...groupes.entries()].sort((a, b) => b[1].length - a[1].length);
  const angle = Math.PI * (3 - Math.sqrt(5));
  const pas = Math.max(14, Math.min(34, 300 / Math.sqrt(personnes.length || 1)));
  const positions = new Map<number, { x: number; y: number }>();
  ordre.forEach(([, membres], rang) => {
    // Les grappes elles-mêmes s'enroulent en spirale autour du centre, la plus grosse au milieu
    const rayon = rang ? 120 + 95 * Math.sqrt(rang) : 0;
    const cx = LARGEUR / 2 + rayon * Math.cos(rang * angle * 2);
    const cy = HAUTEUR / 2 + rayon * 0.62 * Math.sin(rang * angle * 2);
    membres.forEach((p, i) => {
      const r = pas * Math.sqrt(i);
      positions.set(p.numero, { x: cx + r * Math.cos(i * angle), y: cy + r * Math.sin(i * angle) });
    });
  });
  return { positions, groupes: ordre.map(([g, m]) => ({ nom: g, nombre: m.length, teinte: TEINTES[ordre.findIndex(([n]) => n === g) % TEINTES.length] })) };
}

export default function PageRelations(_: ProprietesPage) {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState('');
  const [numero, setNumero] = useState<number | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [avis, setAvis] = useState<Avis>(null);
  const relire = useCallback(async () => {
    try {
      setDonnees(await appeler<Donnees>('/relations'));
      setErreur('');
    } catch (e) {
      setErreur(message(e));
    }
  }, []);
  // Lues à l'arrivée et après chaque geste, comme dans l'ancien dashboard
  useEffect(() => {
    void relire();
  }, [relire]);

  return (
    <Dock id="relations" principal="nuage" panneau={null} fenetres={{ nuage: { mini: [470, 260], pref: [620, 400], flot: [760, 520] } }}>
      <Activite />
      <Nuage donnees={donnees} erreur={erreur} numero={numero} setNumero={setNumero} confirmer={confirmer} setConfirmer={setConfirmer}
        avis={avis} setAvis={setAvis} relire={relire} />
      <PanneauRelations donnees={donnees} numero={numero} setNumero={setNumero} setConfirmer={setConfirmer} setAvis={setAvis} relire={relire} />
    </Dock>
  );
}

type ProprietesNuage = {
  donnees: Donnees | null; erreur: string; numero: number | null; setNumero: (n: number | null) => void; confirmer: boolean; setConfirmer: (b: boolean) => void;
  avis: Avis; setAvis: (a: Avis) => void; relire: () => Promise<void>;
};

function Nuage({ donnees, erreur, numero, setNumero, confirmer, setConfirmer, avis, setAvis, relire }: ProprietesNuage) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const [recherche, setRecherche] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [vue, setVue] = useState<Vue | null>(null);
  const [cadre, setCadre] = useState({ w: LARGEUR, h: HAUTEUR });
  const [glisse, setGlisse] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const prise = useRef<{ x: number; y: number; vue: Vue; bouge: boolean; numero: number | null } | null>(null);

  const personnes = useMemo(() => donnees?.personnes ?? [], [donnees]);
  const { positions, groupes } = useMemo(() => disposer(personnes), [personnes]);
  const cherche = recherche.trim().toLowerCase();
  const trouvees = cherche ? personnes.filter((p) => [p.nom, p.entreprise, p.poste, ...(p.etiquettes ?? [])].join(' ').toLowerCase().includes(cherche)) : [];
  const allumee = (onglet === 'fiche' || confirmer) && numero !== null ? numero : null;
  const cible = personnes.find((p) => p.numero === numero);

  // Échap ferme la confirmation, sinon le panneau ; un avis se lit 3,5 s, une erreur 8 s
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmer) setConfirmer(false);
      else fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [confirmer, setConfirmer, fermer]);
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis, setAvis]);
  // La taille du nuage : la vue garde ses proportions, sans bande vide autour
  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    const mesurer = () => setCadre({ w: Math.max(el.clientWidth - 28, 1), h: Math.max(el.clientHeight - 6, 1) });
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  // Sans zoom ni déplacement, la vue cadre tous les points ; sinon elle garde son centre et sa largeur à la forme de la fenêtre
  const courante = useMemo<Vue>(() => {
    const rapport = cadre.h / cadre.w;
    if (vue) {
      const h = vue.l * rapport;
      return { x: vue.x, y: vue.y + (vue.h - h) / 2, l: vue.l, h };
    }
    if (!positions.size) return { x: 0, y: 0, l: LARGEUR, h: LARGEUR * rapport };
    const xs = [...positions.values()].map((p) => p.x), ys = [...positions.values()].map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // Une marge à l'écran autour des points : 30 px, et 130 px à droite pour les noms
    const l = Math.max((x1 - x0) / Math.max(1 - 160 / cadre.w, 0.3), (y1 - y0) / Math.max(1 - 60 / cadre.h, 0.3) / rapport, 200);
    const u = l / cadre.w, h = l * rapport;
    return { x: x0 - 30 * u - (l - (x1 - x0) - 160 * u) / 2, y: (y0 + y1 - h) / 2, l, h };
  }, [vue, positions, cadre]);
  const echelle = courante.l / cadre.w;

  // Zoom à la molette autour du pointeur
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const tourner = (e: WheelEvent) => {
      e.preventDefault();
      const boite = el.getBoundingClientRect();
      const fx = (e.clientX - boite.left) / boite.width, fy = (e.clientY - boite.top) / boite.height;
      const facteur = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      const l = Math.min(LARGEUR * 3, Math.max(LARGEUR / 12, courante.l * facteur)), h = (l * courante.h) / courante.l;
      setVue({ x: courante.x + (courante.l - l) * fx, y: courante.y + (courante.h - h) * fy, l, h });
    };
    el.addEventListener('wheel', tourner, { passive: false });
    return () => el.removeEventListener('wheel', tourner);
  }, [courante]);

  const ouvrirFiche = (n: number) => {
    setNumero(n);
    setConfirmer(false);
    ouvrir('fiche');
  };
  // Glisser déplace la vue ; un clic sans glisser sur un point ouvre sa fiche
  const presser = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const point = (e.target as Element).closest('[data-numero]');
    prise.current = { x: e.clientX, y: e.clientY, vue: courante, bouge: false, numero: point ? Number(point.getAttribute('data-numero')) : null };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const bouger = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = prise.current;
    if (!p) return;
    const dx = (e.clientX - p.x) * echelle, dy = (e.clientY - p.y) * echelle;
    if (!p.bouge && Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) <= 3) return;
    p.bouge = true;
    setGlisse(true);
    setVue({ ...p.vue, x: p.vue.x - dx, y: p.vue.y - dy });
  };
  const lacher = () => {
    const p = prise.current;
    prise.current = null;
    setGlisse(false);
    if (p && !p.bouge && p.numero !== null) ouvrirFiche(p.numero);
  };

  const importer = async (lire: () => Promise<{ crees: number; completees: number; deja: number }>, nom: string) => {
    setOccupe(true);
    try {
      const b = await lire();
      setAvis({ texte: `${nom} : ${b.crees} créée(s), ${b.completees} complétée(s), ${b.deja} déjà là.` });
      await relire();
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    } finally {
      setOccupe(false);
    }
  };
  const supprimer = async () => {
    if (!cible) return;
    setOccupe(true);
    try {
      await appeler(`/relations/${cible.numero}`, { methode: 'DELETE' });
      setAvis({ texte: `Fiche de ${cible.nom} supprimée.` });
      setNumero(null);
      fermer();
      await relire();
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    } finally {
      setOccupe(false);
      setConfirmer(false);
    }
  };

  const eteinte = (n: number) => !!cherche && !trouvees.some((p) => p.numero === n);
  const montrees = new Set(trouvees.length <= 40 ? trouvees.map((p) => p.numero) : []);

  return (
    <Fenetre id="nuage" as="main" className="tableau nuage-relations" aria-label="Relations" titrePrise="Glisser pour détacher le nuage des relations">
      <div className="outils">
        <label className="recherche">{ICONES.loupe}
          <input type="search" placeholder="Nom, entreprise, étiquette…" aria-label="Rechercher une relation" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          <button type="button" className="action" title="L'export « Connections.csv » de vos données LinkedIn" disabled={occupe} onClick={() => fichier.current?.click()}>
            <span className="ico">{ICONES.televerser}</span><span className="txt">Importer Connections.csv</span>
          </button>
          <input ref={fichier} type="file" accept=".csv,text/csv" hidden aria-label="Fichier Connections.csv" onChange={(e) => {
            const lu = e.target.files?.[0];
            e.target.value = '';
            if (lu) void importer(async () => appeler('/relations/importer/linkedin', { methode: 'POST', corps: { csv: await lu.text() } }), 'LinkedIn');
          }} />
          <button type="button" className="action" title="Les personnes que LAPIS a trouvées chez les employeurs visés" disabled={occupe}
            onClick={() => void importer(() => appeler('/relations/importer/lapis', { methode: 'POST' }), 'LAPIS')}>
            <span className="ico">{ICONES.lapis}</span><span className="txt">Importer depuis LAPIS</span>
          </button>
          <button type="button" className="action plein" aria-haspopup="dialog" aria-expanded={onglet === 'neuve'} onClick={() => { setConfirmer(false); ouvrir('neuve'); }}>
            Nouvelle personne<span className="ico">{ICONES.plus}</span>
          </button>
        </div>
      </div>
      {confirmer && cible && (
        <Confirmer question={`Supprimer la fiche de ${cible.nom} ?`} detail={<span className="detail-r">Ses liens et ses échanges propres sont effacés.</span>} action="Supprimer"
          occupe={occupe} onAnnuler={() => setConfirmer(false)} onConfirmer={() => void supprimer()} />
      )}
      {cherche && (
        <div className="trouvees-r" aria-label="Personnes trouvées">
          {trouvees.slice(0, 40).map((p) => (
            <button key={p.numero} type="button" className="puce" onClick={() => ouvrirFiche(p.numero)}>{[p.nom, p.poste, p.entreprise].filter(Boolean).join(' · ')}</button>
          ))}
          {trouvees.length > 40 && <span className="note-r">… et {trouvees.length - 40} autre(s)</span>}
          {!trouvees.length && <span className="note-r">Personne ne répond à « {recherche.trim()} ».</span>}
        </div>
      )}
      <div className="nuage-r" ref={zone}>
        {donnees && !personnes.length ? (
          <p className="vide-r"><b>Aucune relation pour l&apos;instant.</b>Ajoutez une personne, ou importez vos contacts LinkedIn (« Connections.csv » de l&apos;export de vos données).</p>
        ) : (
          <svg ref={svg} className={glisse ? 'glisse' : undefined} viewBox={`${courante.x} ${courante.y} ${courante.l} ${courante.h}`} preserveAspectRatio="xMidYMid meet"
            role="group" aria-label="Nuage de vos relations : un point par personne, coloré par sa première étiquette"
            onPointerDown={presser} onPointerMove={bouger} onPointerUp={lacher} onPointerCancel={lacher}>
            <g className="traits-r">
              {(donnees?.liens ?? []).map((l) => {
                const a = positions.get(l.de), b = positions.get(l.vers);
                return a && b && (
                  <line key={`${l.de}-${l.vers}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    className={`trait-r${l.nature === 'même entreprise' ? ' implicite' : ''}${eteinte(l.de) && eteinte(l.vers) ? ' eteint' : ''}`}><title>{l.nature}</title></line>
                );
              })}
            </g>
            <g>
              {personnes.map((p) => {
                const { x, y } = positions.get(p.numero)!, s = cote(p);
                const teinte = groupes.find((g) => g.nom === groupe(p))?.teinte ?? TEINTES[0];
                return (
                  <rect key={p.numero} data-numero={p.numero} x={x - s / 2} y={y - s / 2} width={s} height={s} tabIndex={0} role="button"
                    aria-label={`Ouvrir la fiche de ${p.nom}`} style={{ '--t': teinte } as React.CSSProperties}
                    className={`point-r${allumee === p.numero ? ' choisi' : ''}${eteinte(p.numero) ? ' eteint' : ''}`}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      ouvrirFiche(p.numero);
                    }}>
                    <title>{[p.nom, p.poste, p.entreprise].filter(Boolean).join(' · ')}</title>
                  </rect>
                );
              })}
              {allumee !== null && positions.get(allumee) && (() => {
                const p = personnes.find((q) => q.numero === allumee)!, { x, y } = positions.get(allumee)!, s = cote(p) + 10;
                return <rect className="anneau-r" x={x - s / 2} y={y - s / 2} width={s} height={s} />;
              })()}
            </g>
            <g style={{ fontSize: 13 * echelle }}>
              {personnes.filter((p) => allumee === p.numero || (!cherche && p.echanges > 0) || montrees.has(p.numero)).map((p) => {
                const { x, y } = positions.get(p.numero)!;
                return <text key={p.numero} x={x + cote(p) / 2 + 6 * echelle} y={y + 4.5 * echelle} className={`nom-r${allumee === p.numero ? ' choisi' : ''}`}>{p.nom}</text>;
              })}
            </g>
          </svg>
        )}
      </div>
      {(avis || erreur) && (
        <p className={`avis-r${avis?.erreur || (!avis && erreur) ? ' erreur' : ''}`} role={avis?.erreur || (!avis && erreur) ? 'alert' : 'status'} onClick={() => setAvis(null)}>
          {avis?.texte ?? erreur}
        </p>
      )}
      <div className="legende-r">
        <span className="total-r">{personnes.length} personne{personnes.length > 1 ? 's' : ''}</span>
        {groupes.map((g) => <span key={g.nom} className="cle-r"><i style={{ '--t': g.teinte } as React.CSSProperties} />{g.nom}<span className="compteur">{g.nombre}</span></span>)}
        <span className="espace" />
        <span className="note-r">molette pour zoomer, glisser pour se déplacer, clic pour ouvrir</span>
      </div>
    </Fenetre>
  );
}

type ProprietesPanneau = {
  donnees: Donnees | null; numero: number | null; setNumero: (n: number | null) => void; setConfirmer: (b: boolean) => void;
  setAvis: (a: Avis) => void; relire: () => Promise<void>;
};

// Le panneau : la fiche de la personne ouverte, ou une fiche vierge à créer, un seul onglet à la fois
function PanneauRelations({ donnees, numero, setNumero, setConfirmer, setAvis, relire }: ProprietesPanneau) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [erreur, setErreur] = useState('');
  const [appels, setAppels] = useState<AppelCourt[]>([]);
  const [occupe, setOccupe] = useState(false);
  const ouverte = onglet === 'fiche' && numero !== null;
  useEffect(() => {
    if (!ouverte) return;
    let vivant = true;
    Promise.all([appeler<Fiche>(`/relations/${numero}`), appeler<{ appels: AppelCourt[] }>('/appels')]).then(([f, a]) => {
      if (!vivant) return;
      setFiche(f);
      setAppels(a.appels);
      setErreur('');
    }).catch((e) => vivant && setErreur(message(e)));
    return () => {
      vivant = false;
    };
  }, [ouverte, numero]);

  // Un geste sur la fiche : elle revient à jour, le nuage se relit
  const geste = async (faire: () => Promise<Fiche>, texte?: string) => {
    setOccupe(true);
    try {
      setFiche(await faire());
      await relire();
      if (texte) setAvis({ texte });
      return true;
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
      return false;
    } finally {
      setOccupe(false);
    }
  };
  const creer = async (champs: Record<string, unknown>) => {
    setOccupe(true);
    try {
      const lu = await appeler<Fiche>('/relations', { methode: 'POST', corps: champs });
      setAvis({ texte: `Fiche de ${lu.nom} créée.` });
      setFiche(lu);
      setNumero(lu.numero);
      ouvrir('fiche');
      await relire();
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    } finally {
      setOccupe(false);
    }
  };

  const lue = fiche && fiche.numero === numero ? fiche : null;
  const onglets: Onglet[] = onglet === 'neuve' ? [{
    cle: 'neuve', titre: 'Nouvelle personne',
    corps: <Formulaire id="relation-neuve" fiche={null} envoyer={(c) => void creer(c)} />,
    pied: (
      <>
        <button type="button" className="action" onClick={fermer}>Annuler</button>
        <button type="submit" form="relation-neuve" className="action plein" disabled={occupe}>Créer la fiche<span className="ico">{ICONES.coche}</span></button>
      </>
    ),
  }] : numero !== null ? [{
    cle: 'fiche', titre: `Fiche · ${lue?.nom ?? donnees?.personnes.find((p) => p.numero === numero)?.nom ?? ''}`,
    corps: erreur ? <p className="texte-f" role="alert">{erreur}</p> : !lue ? <p className="texte-f">Lecture de la fiche…</p> : (
      <CorpsFiche fiche={lue} donnees={donnees} appels={appels} occupe={occupe} setAvis={setAvis} geste={geste}
        ouvrirFiche={(n) => setNumero(n)} />
    ),
    pied: lue ? (
      <>
        <button type="button" className="action rouge gauche" aria-haspopup="dialog" onClick={() => setConfirmer(true)}>
          <span className="ico">{ICONES.supprimer}</span>Supprimer la fiche
        </button>
        <button type="submit" form="relation-fiche" className="action plein" disabled={occupe}>Enregistrer la fiche<span className="ico">{ICONES.coche}</span></button>
      </>
    ) : undefined,
  }] : [];
  return <Panneau onglets={onglets} />;
}

// Les champs d'une fiche, vierges pour une personne neuve ; Entrée enregistre
function Formulaire({ id, fiche, envoyer }: { id: string; fiche: Fiche | null; envoyer: (champs: Record<string, unknown>) => void }) {
  const depart = () => Object.fromEntries(CHAMPS.map(([cle, , genre]) => {
    const v = fiche?.[cle];
    return [cle, genre === 'liste' ? ((v as string[] | undefined) ?? []).join(', ') : ((v as string | undefined) ?? '')];
  })) as Record<Cle, string>;
  const [valeurs, setValeurs] = useState(depart);
  const champ = (cle: Cle) => {
    const [, libelle, genre] = CHAMPS.find((c) => c[0] === cle)!;
    const attributs = { id: `${id}-${cle}`, className: 'saisie', value: valeurs[cle],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValeurs((v) => ({ ...v, [cle]: e.target.value })) };
    return (
      <div className="champ"><label htmlFor={`${id}-${cle}`}>{libelle}</label>
        {genre === 'long' ? <textarea rows={2} {...attributs} /> : <input {...attributs} placeholder={genre === 'liste' ? 'séparées par des virgules' : undefined} />}
      </div>
    );
  };
  return (
    <form id={id} className="section-f" aria-label={fiche ? `Fiche de ${fiche.nom}` : 'Nouvelle personne'} onSubmit={(e) => {
      e.preventDefault();
      envoyer(Object.fromEntries(CHAMPS.map(([cle, , genre]) => [cle, genre === 'liste' ? valeurs[cle].split(',').map((v) => v.trim()).filter(Boolean) : valeurs[cle].trim()])));
    }}>
      <div className="grille-2">{champ('nom')}{champ('etiquettes')}</div>
      <div className="grille-2">{champ('entreprise')}{champ('poste')}</div>
      {champ('contexte')}
      <div className="grille-2">{champ('emails')}{champ('telephones')}</div>
      {champ('linkedin')}
      {champ('notes')}
    </form>
  );
}

type ProprietesFiche = {
  fiche: Fiche; donnees: Donnees | null; appels: AppelCourt[]; occupe: boolean; setAvis: (a: Avis) => void;
  geste: (faire: () => Promise<Fiche>, texte?: string) => Promise<boolean>; ouvrirFiche: (n: number) => void;
};

// La fiche : ce qu'on sait, les champs, les liens, les échanges
function CorpsFiche({ fiche, donnees, appels, occupe, setAvis, geste, ouvrirFiche }: ProprietesFiche) {
  const [vers, setVers] = useState('');
  const [nature, setNature] = useState('');
  const [note, setNote] = useState('');
  const [appel, setAppel] = useState('');
  const [noteEnCours, setNoteEnCours] = useState(false);
  const autres = (donnees?.personnes ?? []).filter((p) => p.numero !== fiche.numero);
  const chemin = `/relations/${fiche.numero}`;
  const relier = async () => {
    const cible = autres.find((p) => p.nom === vers.trim());
    if (!cible) {
      setAvis({ texte: 'Choisissez une personne de la liste.', erreur: true });
      return;
    }
    if (await geste(() => appeler<Fiche>(`${chemin}/liens`, { methode: 'POST', corps: { vers: cible.numero, nature } }), `${fiche.nom} et ${cible.nom} sont reliés.`)) {
      setVers('');
      setNature('');
    }
  };
  const noter = async () => {
    if (!note.trim()) {
      setAvis({ texte: 'La note est vide.', erreur: true });
      return;
    }
    setNoteEnCours(true);
    if (await geste(() => appeler<Fiche>(`${chemin}/notes`, { methode: 'POST', corps: { texte: note.trim() } }), 'Note ajoutée, fiche mise à jour.')) setNote('');
    setNoteEnCours(false);
  };
  const choixAppel = appel || String(appels[0]?.id ?? '');
  const savoir = fiche.resume || fiche.faits.length || fiche.sujets.length;

  return (
    <div className="rel-f">
      <p className="meta-f">{[fiche.etiquettes.join(', '), fiche.poste, fiche.entreprise].filter(Boolean).join(' · ') || 'Aucune étiquette, entreprise ni poste.'}</p>
      {savoir ? (
        <div className="section-f"><h3>Ce qu&apos;on sait</h3>
          {fiche.resume && <p className="resume-r">{fiche.resume}</p>}
          {fiche.sujets.length > 0 && <p className="sujets-r"><span className="lib-champ">Sujets en cours</span>{fiche.sujets.join(' · ')}</p>}
          {fiche.faits.length > 0 && (
            <ul className="faits-r">{fiche.faits.map((f, i) => <li key={i}>{f.texte}{f.genre && <small>{f.genre} du {jour(f.date)}</small>}</li>)}</ul>
          )}
        </div>
      ) : null}
      <Formulaire key={`${fiche.numero}-${JSON.stringify(CHAMPS.map(([c]) => fiche[c]))}`} id="relation-fiche" fiche={fiche}
        envoyer={(c) => void geste(() => appeler<Fiche>(chemin, { methode: 'PUT', corps: c }), 'Fiche enregistrée.')} />
      <div className="section-f"><h3>Liens</h3>
        {fiche.liens.length ? (
          <ul className="liste-f">
            {fiche.liens.map((l) => (
              <li key={l.numero}>
                <button type="button" className="lien-r" onClick={() => ouvrirFiche(l.numero)}>{l.nom || `#${l.numero}`}</button>
                <span className="d">{l.nature}</span>
                <button type="button" className="x-r" title="Retirer ce lien" aria-label={`Retirer le lien avec ${l.nom || l.numero}`} disabled={occupe}
                  onClick={() => void geste(() => appeler<Fiche>(`${chemin}/liens/${l.numero}`, { methode: 'DELETE' }))}>×</button>
              </li>
            ))}
          </ul>
        ) : <p className="texte-f">Aucun lien.</p>}
        <form className="rangee-r" aria-label="Relier à une personne" onSubmit={(e) => { e.preventDefault(); void relier(); }}>
          <input className="saisie" list="relations-noms" placeholder="Relier à…" aria-label="Relier à" value={vers} onChange={(e) => setVers(e.target.value)} />
          <datalist id="relations-noms">{autres.map((p) => <option key={p.numero} value={p.nom} />)}</datalist>
          <input className="saisie" placeholder="ami, collègue, frère…" aria-label="Nature du lien" value={nature} onChange={(e) => setNature(e.target.value)} />
          <button type="submit" className="action" disabled={occupe}>Relier</button>
        </form>
      </div>
      <div className="section-f"><h3>Échanges</h3>
        <div className="rangee-r deux">
          <textarea className="saisie" rows={2} placeholder="Une note : ce qu'elle vous a dit, ce qu'elle devient…" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="action" disabled={occupe} onClick={() => void noter()}>{noteEnCours ? 'La fiche se met à jour…' : 'Ajouter la note'}</button>
        </div>
        {appels.length > 0 && (
          <div className="rangee-r deux">
            <select className="saisie" aria-label="Appel à ranger" value={choixAppel} onChange={(e) => setAppel(e.target.value)}>
              {appels.map((a) => <option key={a.id} value={a.id}>{a.titre || 'Appel'} — {quand(a.debut)}</option>)}
            </select>
            <button type="button" className="action" disabled={occupe}
              onClick={() => void geste(() => appeler<Fiche>(`${chemin}/appels/${choixAppel}`, { methode: 'POST' }), 'Appel rangé dans la fiche.')}>Ranger cet appel ici</button>
          </div>
        )}
        {fiche.echanges.length ? (
          <ol className="chrono-r">
            {fiche.echanges.map((e) => (
              <li key={e.numero}>
                <time>{jour(e.date)}</time><span className="genre">{e.genre}</span>
                {e.genre === 'note' ? <span className="texte-r">{e.contenu}</span> : <details><summary>{e.titre}</summary><p>{e.contenu}</p></details>}
              </li>
            ))}
          </ol>
        ) : <p className="texte-f">Aucun échange : ajoutez une note, ou rangez un appel.</p>}
      </div>
    </div>
  );
}
