'use client';

import './activite.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { appeler } from '../api';
import { Fenetre } from '../dock/Dock';
import { MarqueAdmin } from '../dock/Panneau';
import { ouvrirIllusion } from '../partage/LienIllusion';
import { useSondage } from './sondage';
import { adresseActivite, heure, nomDuJour, phrase, useActivite, type DonneesActivite, type Evenement, type ReponseActivite, type Sorte } from './useActivite';

const TRAIT = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', 'aria-hidden': true } as const;

// Chaque sorte : sa tuile (classes, icône, libellé du bilan) et son nom dans le fil
const SORTES: { sorte: Sorte; classes: string; tuile: string; nom: string; icone: React.ReactNode }[] = [
  { sorte: 'envoi', classes: 's-envoi t-envoi', tuile: 'envois', nom: 'Envoi', icone: <svg {...TRAIT}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg> },
  { sorte: 'reponse', classes: 's-reponse t-rep', tuile: 'réponses', nom: 'Réponse', icone: <svg {...TRAIT}><rect x="3" y="5" width="18" height="14" /><path d="m3 7 9 6 9-6" /></svg> },
  { sorte: 'entretien', classes: 's-entretien t-rep', tuile: 'entretien', nom: 'Entretien', icone: <svg {...TRAIT}><rect x="3" y="5" width="18" height="16" /><path d="M8 3v4M16 3v4M3 10h18" /></svg> },
  { sorte: 'relance', classes: 's-relance', tuile: 'relance', nom: 'Relance', icone: <svg {...TRAIT}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg> },
  { sorte: 'offres', classes: 's-offres', tuile: 'offres', nom: 'Offres', icone: <svg {...TRAIT}><rect x="3" y="7" width="18" height="13" /><path d="M9 7V3h6v4M3 13h18" /></svg> },
  { sorte: 'afaire', classes: 's-afaire t-faire', tuile: 'à faire', nom: 'À faire', icone: <svg {...TRAIT}><path d="M12 9v4M12 17h.01" /><path d="M12 3 2 21h20z" /></svg> },
];
const NOMS = Object.fromEntries(SORTES.map((s) => [s.sorte, s.nom])) as Record<Sorte, string>;
// Les périodes de l'historique, en jours avant aujourd'hui
const PERIODES = [{ jours: 0, nom: "Aujourd'hui" }, { jours: 6, nom: '7 jours' }, { jours: 29, nom: '30 jours' }, { jours: 89, nom: '90 jours' }];

type ProprietesActivite = {
  // Données fixes à la place du hook (banc d'essai)
  donnees?: DonneesActivite;
  // La ligne « Maintenant » ouvre une vue de la page, par exemple l'onglet En direct ; sans elle, l'admin va à En direct sur la page Candidatures
  surMaintenant?: () => void;
  // Liens en plus de « Tout voir » et « Journal » dans la tête
  liens?: React.ReactNode;
  // Sortes cachées à l'arrivée
  cachees?: Sorte[];
};

// Tuiles du bilan : chacune compte sa sorte et la montre ou la cache
function Tuiles({ bilan, masquees, basculer, label }: { bilan: Record<Sorte, number>; masquees: Sorte[]; basculer: (s: Sorte) => void; label: string }) {
  return (
    <div className="tuiles-sortes" role="group" aria-label={label}>
      {SORTES.map((s) => (
        <label key={s.sorte} className={`choix tuile-sorte ${s.classes}`}>
          <input type="checkbox" checked={!masquees.includes(s.sorte)} onChange={() => basculer(s.sorte)} />
          <span className="chiffre">{s.icone}<b>{bilan[s.sorte]}</b></span>
          <small>{s.tuile}</small>
        </label>
      ))}
    </div>
  );
}

// L'Activité : les grosses actions, filtrées par les tuiles du bilan du jour, la plus récente en bas
export function Activite({ donnees, surMaintenant, liens, cachees = [] }: ProprietesActivite) {
  const branchees = useActivite(!donnees);
  const [vue, setVue] = useState<'historique' | 'journal' | null>(null);
  const { bilan, fil, enCours, erreur } = donnees ?? branchees;
  const toutVoir = donnees ? donnees.toutVoir : () => setVue('historique');
  const [masquees, setMasquees] = useState(cachees);
  const basculer = (s: Sorte) => setMasquees((m) => (m.includes(s) ? m.filter((x) => x !== s) : [...m, s]));

  return (
    <Fenetre id="activite" className="echos" aria-label="Activité" titrePrise="Glisser pour détacher l'Activité">
      <div className="echos-tete">
        <span className="etiquette">Activité</span>
        <span className="liens-tete">
          {toutVoir && <button type="button" aria-haspopup="dialog" onClick={toutVoir}>Tout voir</button>}
          {!donnees && <button type="button" className="admin-seul" aria-haspopup="dialog" title="Journal technique de tout le pipeline" onClick={() => setVue('journal')}>Journal</button>}
          {liens}
        </span>
      </div>
      <Tuiles bilan={bilan} masquees={masquees} basculer={basculer} label="Bilan du jour : chaque tuile montre ou cache sa sorte dans le fil" />
      {erreur && <p className="avis-activite" role="alert">{erreur}</p>}
      <ol className="fil-actions" aria-label="Dernières actions, la plus récente en bas">
        {enCours && (
          <li className="encours">
            <button type="button" className={`ouvre-li${surMaintenant ? '' : ' admin-seul'}`} aria-label="Ouvrir En direct" title="En direct"
              onClick={surMaintenant ?? (() => ouvrirIllusion('candidatures?panneau=direct'))} />
            <p className="etiquette">Maintenant</p>
            <p className="phrase">{enCours}</p>
          </li>
        )}
        {fil.map((e) =>
          'jour' in e ? (
            <li key={e.id} className="jour etiquette">{e.jour}</li>
          ) : (
            !masquees.includes(e.sorte) && (
              <li key={e.id} className={e.sorte}>
                <p className="etiquette">{e.heure} · {NOMS[e.sorte]}</p>
                <p className="phrase">{e.phrase}</p>
              </li>
            )
          ),
        )}
      </ol>
      {vue === 'historique' && <Historique fermer={() => setVue(null)} />}
      {vue === 'journal' && <Journal fermer={() => setVue(null)} />}
    </Fenetre>
  );
}

// Fenêtre flottante au-dessus de la page, posée dans .ov pour échapper à la découpe du verre ; sa barre la déplace, sa croix et Échap la ferment
function Flottante({ titre, admin, fermer, children }: { titre: string; admin?: boolean; fermer: () => void; children: React.ReactNode }) {
  const [hote, setHote] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const boite = useRef<HTMLElement>(null);
  // La racine de la page, pas les canaux d'Illusion de l'en-tête du site
  useEffect(() => setHote(document.querySelector<HTMLElement>('.ov:not(.ov-barre)')), []);
  useEffect(() => {
    // En capture sur la fenêtre du navigateur : Échap ferme cette fenêtre avant le panneau de la page
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      fermer();
    };
    window.addEventListener('keydown', echap, true);
    return () => window.removeEventListener('keydown', echap, true);
  }, [fermer]);
  const saisir = (e: React.PointerEvent) => {
    if (!hote || !boite.current || (e.target as HTMLElement).closest('button')) return;
    const r = boite.current.getBoundingClientRect(), o = hote.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const bouger = (m: PointerEvent) => setPos({
      x: Math.min(Math.max(m.clientX - dx - o.left, 0), o.width - r.width),
      y: Math.min(Math.max(m.clientY - dy - o.top, 0), o.height - 40),
    });
    window.addEventListener('pointermove', bouger);
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', bouger), { once: true });
  };
  if (!hote) return null;
  return createPortal(
    <section ref={boite} className="flottante activite-flottante" role="dialog" aria-label={titre} style={pos ? { left: pos.x, top: pos.y, right: 'auto' } : undefined}>
      <header className="f-barre" onPointerDown={saisir}>
        <span className="f-poignee" aria-hidden="true" />
        <h2 className="f-titre">{titre}{admin && <MarqueAdmin />}</h2>
        <button type="button" className="f-btn" title="Fermer" aria-label={`Fermer ${titre}`} onClick={fermer}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="f-corps">{children}</div>
    </section>,
    hote,
  );
}

// « Tout voir » : l'historique par jour sur la période choisie, filtré par sorte
function Historique({ fermer }: { fermer: () => void }) {
  const [jours, setJours] = useState(6);
  const [lu, setLu] = useState<Evenement[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [masquees, setMasquees] = useState<Sorte[]>([]);
  useSondage(async () => {
    try {
      setLu((await appeler<ReponseActivite>(adresseActivite(jours, 500))).fil);
      setErreur('');
    } catch (e) {
      setErreur((e as Error).message);
    }
  }, 5000, true, jours);
  const comptes = Object.fromEntries(SORTES.map((s) => [s.sorte, 0])) as Record<Sorte, number>;
  (lu ?? []).forEach((e) => (comptes[e.sorte] += e.nombre));
  const parJour: { jour: string; lignes: Evenement[] }[] = [];
  (lu ?? []).filter((e) => !masquees.includes(e.sorte)).forEach((e) => {
    const jour = nomDuJour(new Date(e.quand));
    if (parJour.at(-1)?.jour !== jour) parJour.push({ jour, lignes: [] });
    parJour.at(-1)!.lignes.push(e);
  });

  return (
    <Flottante titre="Activité · historique" fermer={fermer}>
      <div className="histo-filtres" role="group" aria-label="Période">
        {PERIODES.map((p) => (
          <button key={p.jours} type="button" className={`filtre${p.jours === jours ? ' actif' : ''}`} aria-pressed={p.jours === jours} onClick={() => { setJours(p.jours); setLu(null); }}>{p.nom}</button>
        ))}
      </div>
      <Tuiles bilan={comptes} masquees={masquees} label="Sortes montrées dans l'historique"
        basculer={(s) => setMasquees((m) => (m.includes(s) ? m.filter((x) => x !== s) : [...m, s]))} />
      {erreur && <p className="avis-activite" role="alert">{erreur}</p>}
      {lu === null && !erreur && <p className="texte-f">Lecture…</p>}
      {lu !== null && !parJour.length && <p className="texte-f">Aucune action sur cette période.</p>}
      {parJour.map((j) => (
        <section key={j.jour} className="histo-jour" aria-label={j.jour}>
          <h3 className="etiquette">{j.jour}</h3>
          <ol className="liste-histo">
            {j.lignes.map((e) => (
              <li key={e.id} className={e.sorte}>
                <span className="h">{heure(new Date(e.quand))}</span>
                <span className="s">{NOMS[e.sorte]}</span>
                <span className="p">{phrase(e)}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Flottante>
  );
}

// Le journal technique de tout le pipeline, relu toutes les 5 s comme dans l'ancien dashboard ; le plus récent en haut
function Journal({ fermer }: { fermer: () => void }) {
  const [lignes, setLignes] = useState<string[] | null>(null);
  const [erreur, setErreur] = useState('');
  useSondage(async () => {
    try {
      setLignes((await appeler<{ journal: string[] }>('/pipeline')).journal);
      setErreur('');
    } catch (e) {
      setErreur((e as Error).message);
    }
  }, 5000);
  return (
    <Flottante titre="Journal technique" admin fermer={fermer}>
      {erreur && <p className="avis-activite" role="alert">{erreur}</p>}
      {lignes !== null && !lignes.length && <p className="texte-f">Rien au journal pour l&apos;instant.</p>}
      <ol className="journal-lignes" aria-label="Lignes du journal, la plus récente en haut">
        {(lignes ?? []).map((l, i) => <li key={`${i}-${l}`}>{l}</li>)}
      </ol>
    </Flottante>
  );
}
