'use client';
/* eslint-disable @next/next/no-img-element -- les aperçus viennent d'Illusion par le relais, avec la session : l'optimiseur de next/image ne les atteint pas */

import { useCallback, useEffect, useRef, useState } from 'react';
import './commun.css';
import { appeler, televerser } from '../../api';
import { repris, useGarder } from '../../stockage';

// Ce que Documents et Constructeur partagent : icônes, poids, menus de filtre, couleurs, gestionnaire de fichiers, avis

// Les fichiers servis tels quels (aperçus, polices, PDF ouverts) passent par le même relais que appeler()
export const RELAIS = '/api/illusion/app';
export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
export const ICONES = {
  chevron: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>,
  reglages: <svg {...TRAIT}><polygon points="22.3,10.2 22.3,13.8 19.4,13.8 18.5,15.9 20.6,18.0 18.0,20.6 15.9,18.5 13.8,19.4 13.8,22.3 10.2,22.3 10.2,19.4 8.1,18.5 6.0,20.6 3.4,18.0 5.5,15.9 4.6,13.8 1.7,13.8 1.7,10.2 4.6,10.2 5.5,8.1 3.4,6.0 6.0,3.4 8.1,5.5 10.2,4.6 10.2,1.7 13.8,1.7 13.8,4.6 15.9,5.5 18.0,3.4 20.6,6.0 18.5,8.1 19.4,10.2" /><circle cx="12" cy="12" r="3" /></svg>,
  supprimer: <svg {...TRAIT}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  plus: <svg {...TRAIT} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
  oeil: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>,
  suite: <svg {...TRAIT}><path d="m6 9 6 6 6-6" /></svg>,
  exporter: <svg {...TRAIT}><path d="M12 15V4M7 9l5-5 5 5M5 20h14" /></svg>,
  telecharger: <svg {...TRAIT}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>,
  reprendre: <svg {...TRAIT}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>,
  image: <svg {...TRAIT}><rect x="3" y="5" width="18" height="14" /><path d="m3 16 5-5 4 4 3-3 6 6" /></svg>,
  fleche: <svg {...TRAIT}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  envoyer: <svg {...TRAIT}><path d="M4 12h12M12 6l6 6-6 6M20 4v16" /></svg>,
  coche: <svg {...TRAIT} strokeWidth={2.6}><path d="m5 12 5 5 9-10" /></svg>,
  crayon: <svg {...TRAIT}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>,
  croix: <svg {...TRAIT}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  arret: <svg {...TRAIT}><path d="M7 7h10v10H7z" fill="currentColor" /></svg>,
};

// « 4,2 Ko », « 860 Ko », « 1,4 Mo » : une décimale sous 10, aucune au-delà
export function poids(octets: number) {
  if (!octets) return '';
  if (octets < 1024) return `${octets} o`;
  const [v, u] = octets < 1048576 ? [octets / 1024, 'Ko'] : [octets / 1048576, 'Mo'];
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${u}`;
}

// L'avis d'un geste, 3,5 s comme l'ancien dashboard, une erreur un peu plus ; un clic le ferme
export type Dire = (texte: string, erreur?: boolean) => void;
export function useAvis() {
  const [avis, setAvis] = useState<{ texte: string; erreur: boolean; n: number } | null>(null);
  const dire = useCallback<Dire>((texte, erreur = false) => setAvis((a) => ({ texte, erreur, n: (a?.n ?? 0) + 1 })), []);
  useEffect(() => {
    if (!avis) return;
    const t = window.setTimeout(() => setAvis(null), avis.erreur ? 6000 : 3500);
    return () => window.clearTimeout(t);
  }, [avis]);
  const vue = avis ? (
    <p key={avis.n} className={`avis-doc${avis.erreur ? ' erreur' : ''}`} role={avis.erreur ? 'alert' : 'status'} onClick={() => setAvis(null)}>{avis.texte}</p>
  ) : null;
  return { dire, vue };
}

// Menu d'un filtre en texte : une colonne de choix, le courant allumé ; un clic ailleurs ou Échap le referme
export type Choix = { cle: string; libelle: string };
export function MenuFiltre({ lib, valeur, actif, choix, courant, choisir, titre, children }: {
  lib?: string; valeur: string; actif: boolean; choix?: Choix[]; courant?: string; choisir?: (cle: string) => void; titre?: string; children?: React.ReactNode;
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
      e.stopPropagation();
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
    <div ref={hote} className="menu-hote filtre-doc">
      <button type="button" className={`filtre${actif ? ' actif' : ''}`} aria-haspopup="listbox" aria-expanded={ouvert} title={titre}
        aria-label={`${lib ?? 'Type'} : ${titre ?? valeur}`} onClick={() => setOuvert((o) => !o)}>
        <span>{lib && <span className="lib">{lib}</span>}{valeur}</span>
        {ICONES.chevron}
      </button>
      {ouvert && (
        <div className="menu verre" role="listbox" aria-label={lib ?? 'Type'}>
          <span className="verre-halos" aria-hidden="true" />
          {choix?.map((c) => (
            <button key={c.cle} type="button" role="option" aria-selected={c.cle === courant} className={`menu-option${c.cle === courant ? ' actif' : ''}`}
              onClick={() => {
                choisir?.(c.cle);
                setOuvert(false);
              }}>
              {c.libelle}
            </button>
          ))}
          {children}
        </div>
      )}
    </div>
  );
}

// Une valeur longue de filtre se raccourcit, entière dans son infobulle
export const court = (texte: string, n = 16) => (texte.length > n ? `${texte.slice(0, n - 1).trimEnd()}…` : texte);

// Quatre couleurs au plus : chaque pastille ouvre le sélecteur du navigateur, « + Couleur » en ajoute une
export function Couleurs({ valeurs, changer, libelle, grand }: { valeurs: string[]; changer: (v: string[]) => void; libelle: string; grand?: boolean }) {
  const nouvelle = useRef<HTMLInputElement>(null);
  return (
    <div className={grand ? 'pastilles' : 'couleurs'} role="group" aria-label={libelle}>
      {valeurs.map((c, i) => (
        <span key={i} className="pastille-c">
          <input type="color" className="pastille" value={c} title={c} aria-label={`${libelle} : couleur ${i + 1}, ${c}`}
            onChange={(e) => changer(valeurs.map((v, j) => (j === i ? e.target.value : v)))} />
          <button type="button" className="retirer-c" title="Retirer cette couleur" aria-label={`Retirer ${c}`} onClick={() => changer(valeurs.filter((_, j) => j !== i))}>×</button>
        </span>
      ))}
      {valeurs.length < 4 && (
        <>
          <input ref={nouvelle} type="color" className="cache" tabIndex={-1} aria-hidden="true" defaultValue="#6E8FFE"
            onChange={(e) => changer([...valeurs, e.target.value])} />
          {grand ? (
            <button type="button" className="ajout-c" onClick={() => nouvelle.current?.click()}>+ Couleur</button>
          ) : (
            <button type="button" className="action" onClick={() => nouvelle.current?.click()}><span className="ico">{ICONES.plus}</span>Couleur</button>
          )}
        </>
      )}
    </div>
  );
}

// Les fichiers qu'Illusion range lui-même derrière une route : chaque geste part aussitôt, sans « Enregistrer » ; sous la `section` qui la monte, la liste lue reste d'une visite à l'autre
export type Fichier = { nom: string; taille: number };
export function useFichiers(route: string, dire: Dire, actif = true, section = '') {
  const [fichiers, setFichiers] = useState(() => (section ? repris<Fichier[] | null>(`${section}:fichiers:${route}`, null) : null));
  useGarder(section, section ? { [`fichiers:${route}`]: fichiers } : {});
  const relire = useCallback(async () => {
    try {
      setFichiers(await appeler<Fichier[]>(route));
    } catch (e) {
      setFichiers((f) => f ?? []);
      dire(message(e), true);
    }
  }, [route, dire]);
  useEffect(() => {
    if (actif) void relire();
  }, [actif, relire]);
  const envoyer = async (liste: FileList) => {
    for (const f of Array.from(liste)) {
      try {
        // Lu en base64 dans le navigateur, il part au serveur, qui le range lui-même
        await appeler(route, { methode: 'POST', corps: await televerser(f) });
        dire(`${f.name} téléversé.`);
      } catch (e) {
        dire(message(e), true);
      }
    }
    await relire();
  };
  const renommer = async (nom: string, nouveau: string) => {
    try {
      await appeler(`${route}/${encodeURIComponent(nom)}/renommer`, { methode: 'POST', corps: { nom: nouveau } });
      dire(`${nom} renommé en ${nouveau}.`);
      await relire();
      return true;
    } catch (e) {
      dire(message(e), true);
      return false;
    }
  };
  const supprimer = async (nom: string) => {
    try {
      await appeler(`${route}/${encodeURIComponent(nom)}`, { methode: 'DELETE' });
      dire(`${nom} supprimé.`);
    } catch (e) {
      dire(message(e), true);
    }
    await relire();
  };
  return { fichiers, relire, envoyer, renommer, supprimer };
}

// Une police téléversée, chargée sous un nom à elle : deux fichiers ne se volent jamais leur rendu
let numeroPolice = 0;
function Echantillon({ adresse }: { adresse: string }) {
  const [famille, setFamille] = useState('');
  const [illisible, setIllisible] = useState(false);
  useEffect(() => {
    const police = new FontFace(`apercu-police-${++numeroPolice}`, `url("${adresse}")`);
    document.fonts.add(police);
    police.load().then(() => setFamille(police.family), () => setIllisible(true));
    return () => {
      document.fonts.delete(police);
    };
  }, [adresse]);
  return <span className={`ap police${illisible ? ' illisible' : ''}`} style={famille ? { fontFamily: `"${famille}"` } : undefined} aria-hidden="true">Aa</span>;
}

// Gestionnaire de fichiers : aperçu, nom, poids, ✎ renommer sur place, × supprimer (la confirmation revient à la page), puis Téléverser…
export function ListeFichiers({ route, accept, apercu, compact, sorte, portee, gestion, aSupprimer, vise }: {
  route: string; accept: string; apercu?: 'image' | 'feuille' | 'police'; compact?: boolean; sorte: string; portee: string;
  gestion: ReturnType<typeof useFichiers>; aSupprimer: (f: Fichier) => void; vise?: string | null;
}) {
  const [renomme, setRenomme] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState('');
  const choix = useRef<HTMLInputElement>(null);
  const { fichiers } = gestion;
  const valider = async (nom: string) => {
    const propre = nouveau.trim();
    if (!propre || propre === nom) return setRenomme(null);
    if (await gestion.renommer(nom, propre)) setRenomme(null);
  };
  const ouvrir = (f: Fichier) => {
    setRenomme(f.nom);
    setNouveau(f.nom);
  };
  return (
    <>
      <ul className={compact ? 'liste-f fichiers compact' : 'fichiers'} aria-label={`${sorte}s`}>
        {fichiers === null && <li className="vide-f">Chargement…</li>}
        {fichiers?.length === 0 && <li className="vide-f">Aucun fichier.</li>}
        {fichiers?.map((f) => {
          const adresse = `${RELAIS}${route}/${encodeURIComponent(f.nom)}`;
          const vignette = apercu === 'image' || apercu === 'feuille' ? <img className={`ap${apercu === 'feuille' ? ' feuille' : ''}`} src={adresse} alt="" loading="lazy" decoding="async" />
            : apercu === 'police' ? <Echantillon adresse={adresse} /> : null;
          if (renomme === f.nom) {
            return (
              <li key={f.nom} className="renomme vise">
                {vignette}
                <form className="renommer" aria-label={`Renommer ${f.nom}`} onSubmit={(e) => { e.preventDefault(); void valider(f.nom); }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Escape') return;
                    // Échap annule le renommage, pas le panneau qui porte la liste
                    e.preventDefault();
                    e.stopPropagation();
                    setRenomme(null);
                  }}>
                  <label htmlFor={`ren-${sorte}`}>Nouveau nom</label>
                  <input id={`ren-${sorte}`} className="saisie" value={nouveau} autoFocus onChange={(e) => setNouveau(e.target.value)} />
                  <p className="aide-champ">{sorte} · {poids(f.taille)} · {portee}.</p>
                  <div className="ren-pied">
                    <button type="button" className="action" onClick={() => setRenomme(null)}>Annuler</button>
                    <button type="submit" className="action plein">Renommer<span className="ico">{ICONES.coche}</span></button>
                  </div>
                </form>
              </li>
            );
          }
          return (
            <li key={f.nom} className={vise === f.nom ? 'vise' : undefined}>
              {compact ? (
                <>
                  <span className="mono nom-f" title={f.nom}>{f.nom}</span>
                  <span className="d">{poids(f.taille)}</span>
                  <button type="button" className="mini" title="Renommer" aria-label={`Renommer ${f.nom}`} onClick={() => ouvrir(f)}>✎</button>
                  <button type="button" className="mini" title="Supprimer" aria-label={`Supprimer ${f.nom}`} onClick={() => aSupprimer(f)}>×</button>
                </>
              ) : (
                <>
                  {vignette}
                  <span className="nf"><b title={f.nom}>{f.nom}</b><small>{poids(f.taille)}</small></span>
                  <button type="button" className="bt" title="Renommer" aria-label={`Renommer ${f.nom}`} onClick={() => ouvrir(f)}>{ICONES.crayon}</button>
                  <button type="button" className="bt sup" title="Supprimer" aria-label={`Supprimer ${f.nom}`} onClick={() => aSupprimer(f)}>{ICONES.croix}</button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <input ref={choix} type="file" accept={accept} multiple hidden aria-label={`${sorte}s à téléverser`}
        onChange={async (e) => {
          const liste = e.target.files;
          if (liste?.length) await gestion.envoyer(liste);
          e.target.value = '';
        }} />
      <button type="button" className={`action${compact ? '' : ' plein'} televerser`} onClick={() => choix.current?.click()}>
        {compact && <span className="ico">{ICONES.exporter}</span>}Téléverser…{!compact && <span className="ico">{ICONES.plus}</span>}
      </button>
    </>
  );
}
