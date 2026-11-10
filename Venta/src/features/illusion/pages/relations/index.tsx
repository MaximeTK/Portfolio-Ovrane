'use client';

import './relations.css';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Fenetre, usePanneau } from '../../dock/Dock';
import { AuPied, Confirmer, Panneau, type Elements, type Onglet } from '../../dock/Panneau';
import type { ProprietesPage } from '../liste';
import { useEchap, useGeste } from '../commun';
import { Action } from '../../elements/Action';
import { Champ, SectionFiche } from '../../elements/Champ';
import { ICONES } from '../../elements/icones';
import { useAvis, type Dire } from '../../elements/Avis';
import { jourMois, message, parVirgules, quand } from '../../elements/format';
import { PageDock } from '../../activite/PageDock';

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
type Vue = { x: number; y: number; l: number; h: number };

// Une couleur par étiquette, dans l'ordre des grappes, répétées au-delà
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

const groupe = (p: Personne) => p.etiquettes?.[0] || SANS;
const cote = (p: Personne) => 9 + Math.min(7.2, Math.sqrt(p.echanges || 0) * 4.2);


// Une grappe par première étiquette, ses personnes en spirale de tournesol
function disposer(personnes: Personne[]) {
  const groupes = new Map<string, Personne[]>();
  for (const p of personnes) groupes.set(groupe(p), [...(groupes.get(groupe(p)) ?? []), p]);
  const ordre = [...groupes.entries()].sort((a, b) => b[1].length - a[1].length);
  const angle = Math.PI * (3 - Math.sqrt(5));
  const pas = Math.max(14, Math.min(34, 300 / Math.sqrt(personnes.length || 1)));
  const positions = new Map<number, { x: number; y: number }>();
  ordre.forEach(([, membres], rang) => {
    // Les grappes s'enroulent en spirale autour du centre, la plus grosse au milieu
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
  // Le nuage lu reste d'une visite à l'autre, relu derrière
  const [donnees, setDonnees] = useState(() => repris<Donnees | null>('relations:donnees', null));
  useGarder('relations', { donnees });
  const [erreur, setErreur] = useState('');
  const { dire, vue } = useAvis('avis-r', true, erreur);
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
    <PageDock id="relations" principal="nuage" panneau={null} fenetres={{ nuage: { mini: [470, 260], pref: [620, 400], flot: [760, 520] } }}>
      <Nuage donnees={donnees} avis={vue} dire={dire} relire={relire} />
      <PanneauRelations donnees={donnees} dire={dire} relire={relire} />
    </PageDock>
  );
}

type ProprietesNuage = { donnees: Donnees | null; avis: React.ReactNode; dire: Dire; relire: () => Promise<void> };

function Nuage({ donnees, avis, dire, relire }: ProprietesNuage) {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  // La recherche, le zoom et le déplacement restent d'une visite à l'autre
  const [recherche, setRecherche] = useState(() => repris('relations:recherche', ''));
  const [vue, setVue] = useState(() => repris<Vue | null>('relations:vue', null));
  useGarder('relations', { recherche, vue });
  const { occupe, geste } = useGeste((t) => dire(t, true));
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
  const allumee = onglet === 'fiche' && objet !== null ? Number(objet) : null;

  // Échap ferme le panneau, sauf celui qu'une confirmation garde pour elle
  useEchap(fermer);
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

  // Sans zoom ni déplacement, la vue cadre tous les points
  const courante = useMemo<Vue>(() => {
    const rapport = cadre.h / cadre.w;
    if (vue) {
      const h = vue.l * rapport;
      return { x: vue.x, y: vue.y + (vue.h - h) / 2, l: vue.l, h };
    }
    if (!positions.size) return { x: 0, y: 0, l: LARGEUR, h: LARGEUR * rapport };
    const xs = [...positions.values()].map((p) => p.x), ys = [...positions.values()].map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // Marge de 30 px autour des points, et 130 px à droite pour les noms
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

  const ouvrirFiche = (n: number) => ouvrir('fiche', String(n));
  // Glisser déplace la vue ; clic sur un point : fiche, clic droit : fenêtre
  const presser = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const point = (e.target as Element).closest('[data-objet]');
    prise.current = { x: e.clientX, y: e.clientY, vue: courante, bouge: false, numero: point ? Number(point.getAttribute('data-objet')) : null };
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

  const importer = (lire: () => Promise<{ crees: number; completees: number; deja: number }>, nom: string) => geste(async () => {
    const b = await lire();
    dire(`${nom} : ${b.crees} créée(s), ${b.completees} complétée(s), ${b.deja} déjà là.`);
    await relire();
  });
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
          <Action icone={ICONES.televerser_relations} txt title="L'export « Connections.csv » de vos données LinkedIn" disabled={occupe} onClick={() => fichier.current?.click()}>Importer Connections.csv
          </Action>
          <input ref={fichier} type="file" accept=".csv,text/csv" hidden aria-label="Fichier Connections.csv" onChange={(e) => {
            const lu = e.target.files?.[0];
            e.target.value = '';
            if (lu) void importer(async () => appeler('/relations/importer/linkedin', { methode: 'POST', corps: { csv: await lu.text() } }), 'LinkedIn');
          }} />
          <Action icone={ICONES.contacts} txt title="Les personnes que LAPIS a trouvées chez les employeurs visés" disabled={occupe} onClick={() => void importer(() => appeler('/relations/importer/lapis', { methode: 'POST' }), 'LAPIS')}>Importer depuis LAPIS
          </Action>
          <Action plein iconeApres={ICONES.plus_pages} aria-haspopup="dialog" aria-expanded={onglet === 'neuve'} onClick={() => ouvrir('neuve')}>
            Nouvelle personne
          </Action>
        </div>
      </div>
      {cherche && (
        <div className="trouvees-r" aria-label="Personnes trouvées">
          {trouvees.slice(0, 40).map((p) => (
            <button key={p.numero} type="button" className="puce" data-ouvre="fiche" data-objet={p.numero} onClick={() => ouvrirFiche(p.numero)}>{[p.nom, p.poste, p.entreprise].filter(Boolean).join(' · ')}</button>
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
                  <rect key={p.numero} data-ouvre="fiche" data-objet={p.numero} x={x - s / 2} y={y - s / 2} width={s} height={s} tabIndex={0} role="button"
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
      {avis}
      <div className="legende-r">
        <span className="total-r">{personnes.length} personne{personnes.length > 1 ? 's' : ''}</span>
        {groupes.map((g) => <span key={g.nom} className="cle-r"><i style={{ '--t': g.teinte } as React.CSSProperties} />{g.nom}<span className="compteur">{g.nombre}</span></span>)}
        <span className="espace" />
        <span className="note-r">molette pour zoomer, glisser pour se déplacer, clic pour ouvrir</span>
      </div>
    </Fenetre>
  );
}

type ProprietesPanneau = { donnees: Donnees | null; dire: Dire; relire: () => Promise<void> };

// Panneau : une fiche par personne ouverte, ou une fiche vierge à créer
function PanneauRelations({ donnees, dire, relire }: ProprietesPanneau) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const creer = (champs: Record<string, unknown>) => geste(async () => {
    const lu = await appeler<Fiche>('/relations', { methode: 'POST', corps: champs });
    dire(`Fiche de ${lu.nom} créée.`);
    // Le nuage relu d'abord : la fiche s'ouvre sur une personne qu'il connaît
    await relire();
    ouvrir('fiche', String(lu.numero));
  });

  const elements: Elements = {
    fiche: (n) => {
      const personne = donnees?.personnes.find((p) => String(p.numero) === n);
      // Sortie du nuage (supprimée), sa fiche ne se montre plus
      return donnees && !personne ? null : {
        cle: 'fiche', titre: `Fiche · ${personne?.nom ?? ''}`,
        corps: <FicheRelation numero={Number(n)} donnees={donnees} dire={dire} relire={relire} />, pied: true,
      };
    },
  };
  const onglets: Onglet[] = onglet === 'neuve' ? [{
    cle: 'neuve', titre: 'Nouvelle personne',
    corps: <Formulaire id="relation-neuve" fiche={null} envoyer={(c) => void creer(c)} />,
    pied: (
      <>
        <Action onClick={fermer}>Annuler</Action>
        <Action plein iconeApres={ICONES.coche} type="submit" form="relation-neuve" disabled={occupe}>Créer la fiche</Action>
      </>
    ),
  }] : [];
  return <Panneau elements={elements} onglets={onglets} />;
}

type ProprietesFicheRelation = { numero: number; donnees: Donnees | null; dire: Dire; relire: () => Promise<void> };

// Fiche d'une personne, une par fenêtre, avec son propre pied
function FicheRelation({ numero, donnees, dire, relire }: ProprietesFicheRelation) {
  const { ouvrir, fermer } = usePanneau();
  const [fiche, setFiche] = useState(() => repris<Fiche | null>(`relations:fiche-${numero}`, null));
  const [erreur, setErreur] = useState('');
  const [appels, setAppels] = useState(() => repris<AppelCourt[]>('relations:appels', []));
  useGarder('relations', { [`fiche-${numero}`]: fiche, appels });
  const [occupe, setOccupe] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const formulaire = useId();
  useEffect(() => {
    let vivant = true;
    Promise.all([appeler<Fiche>(`/relations/${numero}`), appeler<{ appels: AppelCourt[] }>('/appels')]).then(([f, a]) => {
      if (!vivant) return;
      // Inchangée depuis la dernière visite : rien ne bouge sous la main
      setFiche((x) => (JSON.stringify(x) === JSON.stringify(f) ? x : f));
      setAppels(a.appels);
      setErreur('');
    }).catch((e) => vivant && setErreur(message(e)));
    return () => {
      vivant = false;
    };
  }, [numero]);

  // Un geste sur la fiche : elle revient à jour, le nuage se relit
  const geste = async (faire: () => Promise<Fiche>, texte?: string) => {
    setOccupe(true);
    try {
      setFiche(await faire());
      await relire();
      if (texte) dire(texte);
      return true;
    } catch (e) {
      dire(message(e), true);
      return false;
    } finally {
      setOccupe(false);
    }
  };
  const supprimer = async () => {
    setOccupe(true);
    try {
      await appeler(`/relations/${numero}`, { methode: 'DELETE' });
      dire(`Fiche de ${fiche?.nom ?? ''} supprimée.`);
      fermer();
      await relire();
    } catch (e) {
      dire(message(e), true);
    } finally {
      setOccupe(false);
      setConfirmer(false);
    }
  };

  if (erreur) return <p className="texte-f" role="alert">{erreur}</p>;
  if (!fiche) return <p className="texte-f">Lecture de la fiche…</p>;
  return (
    <>
      {confirmer && (
        <Confirmer question={`Supprimer la fiche de ${fiche.nom} ?`} detail="Ses liens et ses échanges propres sont effacés." action="Supprimer"
          occupe={occupe} onAnnuler={() => setConfirmer(false)} onConfirmer={() => void supprimer()} />
      )}
      <CorpsFiche fiche={fiche} donnees={donnees} appels={appels} occupe={occupe} dire={dire} geste={geste} formulaire={formulaire}
        ouvrirFiche={(n) => ouvrir('fiche', String(n))} />
      <AuPied>
        <Action className="gauche" rouge icone={ICONES.supprimer} aria-haspopup="dialog" onClick={() => setConfirmer(true)}>Supprimer la fiche
        </Action>
        <Action plein iconeApres={ICONES.coche} type="submit" form={formulaire} disabled={occupe}>Enregistrer la fiche</Action>
      </AuPied>
    </>
  );
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
      <Champ pour={`${id}-${cle}`} libelle={libelle}>
        {genre === 'long' ? <textarea rows={2} {...attributs} /> : <input {...attributs} placeholder={genre === 'liste' ? 'séparées par des virgules' : undefined} />}
      </Champ>
    );
  };
  return (
    <form id={id} className="section-f" aria-label={fiche ? `Fiche de ${fiche.nom}` : 'Nouvelle personne'} onSubmit={(e) => {
      e.preventDefault();
      envoyer(Object.fromEntries(CHAMPS.map(([cle, , genre]) => [cle, genre === 'liste' ? parVirgules(valeurs[cle]) : valeurs[cle].trim()])));
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
  fiche: Fiche; donnees: Donnees | null; appels: AppelCourt[]; occupe: boolean; dire: Dire;
  geste: (faire: () => Promise<Fiche>, texte?: string) => Promise<boolean>; formulaire: string; ouvrirFiche: (n: number) => void;
};

// `formulaire` : l'id propre à la fenêtre, que son pied vise
function CorpsFiche({ fiche, donnees, appels, occupe, dire, geste, formulaire, ouvrirFiche }: ProprietesFiche) {
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
      dire('Choisissez une personne de la liste.', true);
      return;
    }
    if (await geste(() => appeler<Fiche>(`${chemin}/liens`, { methode: 'POST', corps: { vers: cible.numero, nature } }), `${fiche.nom} et ${cible.nom} sont reliés.`)) {
      setVers('');
      setNature('');
    }
  };
  const noter = async () => {
    if (!note.trim()) {
      dire('La note est vide.', true);
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
        <SectionFiche titre="Ce qu&apos;on sait">
          {fiche.resume && <p className="resume-r">{fiche.resume}</p>}
          {fiche.sujets.length > 0 && <p className="sujets-r"><span className="lib-champ">Sujets en cours</span>{fiche.sujets.join(' · ')}</p>}
          {fiche.faits.length > 0 && (
            <ul className="faits-r">{fiche.faits.map((f, i) => <li key={i}>{f.texte}{f.genre && <small>{f.genre} du {jourMois(f.date, '')}</small>}</li>)}</ul>
          )}
        </SectionFiche>
      ) : null}
      <Formulaire key={`${fiche.numero}-${JSON.stringify(CHAMPS.map(([c]) => fiche[c]))}`} id={formulaire} fiche={fiche}
        envoyer={(c) => void geste(() => appeler<Fiche>(chemin, { methode: 'PUT', corps: c }), 'Fiche enregistrée.')} />
      <SectionFiche titre="Liens">
        {fiche.liens.length ? (
          <ul className="liste-f">
            {fiche.liens.map((l) => (
              <li key={l.numero}>
                <button type="button" className="lien-r" data-ouvre="fiche" data-objet={l.numero} onClick={() => ouvrirFiche(l.numero)}>{l.nom || `#${l.numero}`}</button>
                <span className="d">{l.nature}</span>
                <button type="button" className="x-r" title="Retirer ce lien" aria-label={`Retirer le lien avec ${l.nom || l.numero}`} disabled={occupe}
                  onClick={() => void geste(() => appeler<Fiche>(`${chemin}/liens/${l.numero}`, { methode: 'DELETE' }))}>×</button>
              </li>
            ))}
          </ul>
        ) : <p className="texte-f">Aucun lien.</p>}
        <form className="rangee-r" aria-label="Relier à une personne" onSubmit={(e) => { e.preventDefault(); void relier(); }}>
          <input className="saisie" list={`${formulaire}-noms`} placeholder="Relier à…" aria-label="Relier à" value={vers} onChange={(e) => setVers(e.target.value)} />
          <datalist id={`${formulaire}-noms`}>{autres.map((p) => <option key={p.numero} value={p.nom} />)}</datalist>
          <input className="saisie" placeholder="ami, collègue, frère…" aria-label="Nature du lien" value={nature} onChange={(e) => setNature(e.target.value)} />
          <Action type="submit" disabled={occupe}>Relier</Action>
        </form>
      </SectionFiche>
      <SectionFiche titre="Échanges">
        <div className="rangee-r deux">
          <textarea className="saisie" rows={2} placeholder="Une note : ce qu'elle vous a dit, ce qu'elle devient…" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Action disabled={occupe} onClick={() => void noter()}>{noteEnCours ? 'La fiche se met à jour…' : 'Ajouter la note'}</Action>
        </div>
        {appels.length > 0 && (
          <div className="rangee-r deux">
            <select className="saisie" aria-label="Appel à ranger" value={choixAppel} onChange={(e) => setAppel(e.target.value)}>
              {appels.map((a) => <option key={a.id} value={a.id}>{a.titre || 'Appel'} — {quand(a.debut)}</option>)}
            </select>
            <Action disabled={occupe} onClick={() => void geste(() => appeler<Fiche>(`${chemin}/appels/${choixAppel}`, { methode: 'POST' }), 'Appel rangé dans la fiche.')}>Ranger cet appel ici</Action>
          </div>
        )}
        {fiche.echanges.length ? (
          <ol className="chrono-r">
            {fiche.echanges.map((e) => (
              <li key={e.numero}>
                <time>{jourMois(e.date, '')}</time><span className="genre">{e.genre}</span>
                {e.genre === 'note' ? <span className="texte-r">{e.contenu}</span> : <details><summary>{e.titre}</summary><p>{e.contenu}</p></details>}
              </li>
            ))}
          </ol>
        ) : <p className="texte-f">Aucun échange : ajoutez une note, ou rangez un appel.</p>}
      </SectionFiche>
    </div>
  );
}
