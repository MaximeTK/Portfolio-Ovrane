'use client';
/* eslint-disable @next/next/no-img-element -- les aperçus viennent d'Illusion par le relais, avec la session : l'optimiseur de next/image ne les atteint pas */

import { useCallback, useEffect, useRef, useState } from 'react';
import './commun.css';
import { appeler, televerser } from '../../api';
import { repris, useGarder } from '../../stockage';

import { MenuFiltre as Filtre } from '../../elements/Menu';
import { useAvis as useAvisCommun, type Dire } from '../../elements/Avis';
import { Action } from '../../elements/Action';
import { ICONES } from '../../elements/icones';
import { message } from '../../elements/format';

// Partagé par Documents et Constructeur : icônes, menus, couleurs, fichiers

// Les fichiers servis tels quels passent par le même relais que appeler()
export const RELAIS = '/api/illusion/app';



// Les fonds d'un CV ; le vide se nomme à chaque appel
export const FONDS = ['', 'aplat', 'degrade', 'photo', 'photo-teintee', 'blanc'];

// « 4,2 Ko », « 860 Ko », « 1,4 Mo » : une décimale sous 10, aucune au-delà
export function poids(octets: number) {
  if (!octets) return '';
  if (octets < 1024) return `${octets} o`;
  const [v, u] = octets < 1048576 ? [octets / 1024, 'Ko'] : [octets / 1048576, 'Mo'];
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${u}`;
}

// Avis d'un geste, plus long pour une erreur ; un clic le ferme
export const useAvis = () => useAvisCommun('avis-doc', true);

// Menu de filtre : choix courant allumé, un clic ailleurs ou Échap le ferme
export type Choix = { cle: string; libelle: string };
export function MenuFiltre({ lib, valeur, actif, choix, courant, choisir, titre, children }: {
  lib?: string; valeur: string; actif: boolean; choix?: Choix[]; courant?: string; choisir?: (cle: string) => void; titre?: string; children?: React.ReactNode;
}) {
  return (
    <Filtre arreter classeHote="filtre-doc" lib={lib} titre={lib ?? 'Type'} valeur={valeur} actif={actif} choix={choix} courant={courant} choisir={choisir} icone={ICONES.chevron}
      title={titre} aria-label={`${lib ?? 'Type'} : ${titre ?? valeur}`}>
      {children}
    </Filtre>
  );
}

// Une valeur longue de filtre se raccourcit, entière dans son infobulle
export const court = (texte: string, n = 16) => (texte.length > n ? `${texte.slice(0, n - 1).trimEnd()}…` : texte);

// Quatre couleurs au plus : chaque pastille ouvre le sélecteur du navigateur
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
            <Action icone={ICONES.plus_pages} onClick={() => nouvelle.current?.click()}>Couleur</Action>
          )}
        </>
      )}
    </div>
  );
}

// Chaque geste sur ces fichiers part aussitôt, sans « Enregistrer »
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

// Nom de police propre à chaque fichier : aucun rendu volé
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

// Gestionnaire de fichiers ; la confirmation de suppression revient à la page
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
                    <Action onClick={() => setRenomme(null)}>Annuler</Action>
                    <Action plein iconeApres={ICONES.valider} type="submit">Renommer</Action>
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
                  <button type="button" className="bt sup" title="Supprimer" aria-label={`Supprimer ${f.nom}`} onClick={() => aSupprimer(f)}>{ICONES.croix_documents}</button>
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
      <Action className={`${compact ? '' : ' plein'} televerser`} onClick={() => choix.current?.click()}>
        {compact && <span className="ico">{ICONES.exporter}</span>}Téléverser…{!compact && <span className="ico">{ICONES.plus_pages}</span>}
      </Action>
    </>
  );
}
