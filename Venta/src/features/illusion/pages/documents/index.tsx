'use client';
/* eslint-disable @next/next/no-img-element -- les aperçus viennent d'Illusion par le relais, avec la session : l'optimiseur de next/image ne les atteint pas */

import './documents.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appeler, telecharger } from '../../api';
import { cleBrouillon } from '../../stockage';
import { Activite } from '../../activite/Activite';
import { useSondage } from '../../activite/sondage';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer } from '../../dock/Panneau';
import type { ProprietesPage } from '../liste';
import { ICONES, MenuFiltre, RELAIS, court, message, useAvis } from './commun';
import { PanneauDocuments } from './panneaux';

// Une pièce de la galerie telle que /productions la rend
export type Production = {
  candidature: number; offre: string; poste: string; entreprise: string; date: string; profil: string; profil_chemin: string;
  statut: string; url: string; offre_reelle: boolean; essai: boolean; manquantes: string[]; ajoutees: string[]; implicites: string[];
  retenues: string[]; reponse: string; liens_suivis: boolean; clics: number; nature: 'cv' | 'lettre'; fabrication_s: number;
  apercu: boolean; nom: string; format: string; octets: number;
  fond_mode?: string; fond_structure?: string; fond_accent?: string; fond_secondaire?: string; fond_famille?: string; fond_photo?: string;
};
type Lot = { lignes: Production[]; suivant: number; fini: boolean };
type Options = { poste: string[]; entreprise: string[]; profil: string[]; fond_mode: string[] };
export type Filtres = { poste: string; entreprise: string; profil: string; fond_mode: string; depuis: string; essai: string };
export type Genre = 'cv' | 'lettre' | 'spontanes';
export type Modele = { nom: string; destination: string; profil: string; poste: string; competences: string[]; constructeur: boolean; fond: string; palette: string[]; cv: string };
export type Parametres = {
  constructeur_fond: string; constructeur_palette: string[]; constructeur_modele: string; constructeur_prompt_lettre: string;
  constructeur_notes_lettre: string; cv_spontanes: Modele[]; modeles: { nom: string; modele?: string }[];
};
type Argument = { cle: string; choix: string[]; valeur: unknown };
export type EtatAtelier = { en_cours: boolean; ok: boolean | null; erreur: string; depuis_s: number; duree_s: number };
export type NomAtelier = 'constructeur' | 'lettre';
export type Formulaire = { offre: string; entreprise: string; poste: string; profil: string; palette: string[]; langue: string; deja_postule: boolean; essai: boolean; silencieux: boolean };

const VIDES: Filtres = { poste: '', entreprise: '', profil: '', fond_mode: '', depuis: '', essai: '' };
const TRANCHE = 40;
const GENRES: { cle: Genre; libelle: string }[] = [{ cle: 'cv', libelle: 'CV' }, { cle: 'lettre', libelle: 'Lettres' }, { cle: 'spontanes', libelle: 'CV spontanés' }];
const ESSAIS = [{ cle: '', libelle: 'Tous' }, { cle: 'non', libelle: 'Sans les essais' }, { cle: 'oui', libelle: 'Essais seuls' }];
const FORMULAIRE_VIDE: Formulaire = { offre: '', entreprise: '', poste: '', profil: '', palette: [], langue: 'fr', deja_postule: false, essai: false, silencieux: true };
export const MODELE_VIDE = { nom: '', destination: '', profil: '', poste: '', competences: [], constructeur: true, fond: '', palette: [], cv: '', original: '' };
export const clePiece = (p: Production) => `${p.candidature}:${p.nature}`;
export const sansJson = (nom: string) => nom.replace(/\.json$/i, '');
export const nomFichier = (chemin: string) => String(chemin || '').split(/[\\/]/).pop() ?? '';
// « 28/10 14:02 », à l'heure du poste ; une date d'Illusion sans fuseau est en UTC
export const quand = (iso: string) => (iso ? new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`)
  .toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—');

// Ce qu'on a tapé dans un formulaire de fabrication reste d'une visite à l'autre, comme dans l'ancien dashboard
const lireMemoire = (nom: NomAtelier): Partial<Formulaire> => {
  try {
    return JSON.parse(localStorage.getItem(cleBrouillon(`documents:${nom}`)) ?? '{}');
  } catch {
    return {};
  }
};

function useDocuments(admin: boolean) {
  const { dire, vue: avis } = useAvis();
  const [genre, setGenre] = useState<Genre>('cv');
  const [filtres, setFiltres] = useState<Filtres>(VIDES);
  const [lot, setLot] = useState<Lot | null>(null);
  const [total, setTotal] = useState<{ cv: number; lettre: number } | null>(null);
  const [options, setOptions] = useState<Options>({ poste: [], entreprise: [], profil: [], fond_mode: [] });
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [choisie, setChoisie] = useState<Production | null>(null);
  const [parametres, setParametres] = useState<Parametres | null>(null);
  const [profils, setProfils] = useState<string[]>([]);
  const [etats, setEtats] = useState<Record<NomAtelier, EtatAtelier | null>>({ constructeur: null, lettre: null });
  const [formulaires, setFormulaires] = useState<Record<NomAtelier, Formulaire>>({ constructeur: FORMULAIRE_VIDE, lettre: FORMULAIRE_VIDE });
  const [modele, setModele] = useState<(Modele & { original: string }) | null>(null);
  const chargement = useRef(false);
  const generation = useRef(0);
  const telechargerApres = useRef(false);
  const enCours = useRef<Record<NomAtelier, boolean>>({ constructeur: false, lettre: false });

  const requete = useCallback((f: Filtres) => new URLSearchParams(Object.entries(f).filter(([, v]) => v)), []);

  // Une tranche de plus à la suite de `depuis` ; sans lui, la galerie repart de zéro, comme à un filtre
  const charger = useCallback(async (g: Genre, f: Filtres, depuis: Lot | null) => {
    if (g === 'spontanes' || (chargement.current && depuis)) return null;
    const n = depuis ? generation.current : ++generation.current;
    chargement.current = true;
    try {
      const params = requete(f);
      params.set('genre', g);
      params.set('depart', String(depuis?.suivant ?? 0));
      params.set('taille', String(TRANCHE));
      const lu = await appeler<Lot>(`/productions?${params}`);
      if (n !== generation.current) return null;
      const suite = { lignes: [...(depuis?.lignes ?? []), ...lu.lignes], suivant: lu.suivant, fini: lu.fini !== false };
      setLot(suite);
      return suite;
    } catch (e) {
      if (n === generation.current) dire(message(e), true);
      return null;
    } finally {
      if (n === generation.current) chargement.current = false;
    }
  }, [requete, dire]);

  const relireTout = useCallback(async (g: Genre, f: Filtres) => {
    setSelection(new Set());
    if (g === 'spontanes') return;
    setLot(null);
    await Promise.all([
      charger(g, f, null),
      appeler<{ cv: number; lettre: number }>(`/vues/documents/compte?${requete(f)}`).then(setTotal).catch((e) => dire(message(e), true)),
      appeler<Options>('/productions/filtres').then(setOptions).catch((e) => dire(message(e), true)),
    ]);
  }, [requete, charger, dire]);
  useEffect(() => {
    void relireTout(genre, filtres);
  }, [genre, filtres, relireTout]);
  const relire = useRef(() => relireTout(genre, filtres));
  useEffect(() => {
    relire.current = () => relireTout(genre, filtres);
  });

  useEffect(() => {
    appeler<Parametres>('/parametres').then(setParametres).catch((e) => dire(message(e), true));
    appeler<{ nom: string; arguments: Argument[]; etat: EtatAtelier }[]>('/atelier').then((briques) => {
      const depart = (nom: NomAtelier): Formulaire => {
        const args = briques.find((b) => b.nom === nom)?.arguments ?? [];
        const lus = Object.fromEntries(args.filter((a) => a.cle in FORMULAIRE_VIDE && a.valeur !== undefined).map((a) => [a.cle, a.valeur]));
        return { ...FORMULAIRE_VIDE, ...lus, ...lireMemoire(nom) } as Formulaire;
      };
      const etat = (nom: NomAtelier) => briques.find((b) => b.nom === nom)?.etat ?? null;
      setProfils(briques.find((b) => b.nom === 'constructeur')?.arguments.find((a) => a.cle === 'profil')?.choix ?? []);
      setFormulaires({ constructeur: depart('constructeur'), lettre: depart('lettre') });
      enCours.current = { constructeur: !!etat('constructeur')?.en_cours, lettre: !!etat('lettre')?.en_cours };
      setEtats({ constructeur: etat('constructeur'), lettre: etat('lettre') });
    }).catch((e) => dire(message(e), true));
  }, [dire]);

  const changerFormulaire = useCallback((nom: NomAtelier, champs: Partial<Formulaire>) => setFormulaires((fs) => {
    const neuf = { ...fs[nom], ...champs };
    try {
      localStorage.setItem(cleBrouillon(`documents:${nom}`), JSON.stringify(neuf));
    } catch { /* stockage refusé : le formulaire ne vaut que pour la visite */ }
    return { ...fs, [nom]: neuf };
  }), []);

  // Un lancement à la main se relit toutes les 1,5 s tant qu'il tourne ; fini, ce qu'il a bâti entre dans la galerie
  const lireEtat = useCallback(async (nom: NomAtelier) => {
    let etat: EtatAtelier;
    try {
      etat = await appeler<EtatAtelier>(`/atelier/${nom}`);
    } catch {
      return;
    }
    setEtats((e) => ({ ...e, [nom]: etat }));
    if (!enCours.current[nom] || etat.en_cours) return;
    enCours.current[nom] = false;
    if (nom === 'constructeur' && telechargerApres.current) {
      telechargerApres.current = false;
      if (etat.ok) telecharger(`/atelier/${nom}/fichier`).catch((e) => dire(message(e), true));
    } else if (etat.ok) void relire.current();
  }, [dire]);
  useSondage(() => lireEtat('constructeur'), 1500, !!etats.constructeur?.en_cours);
  useSondage(() => lireEtat('lettre'), 1500, !!etats.lettre?.en_cours);

  const executer = useCallback(async (nom: NomAtelier, variante?: { transparent: boolean; essai: boolean }) => {
    try {
      if (etats[nom]?.en_cours) {
        if (variante) return dire(`Brique ${nom} déjà lancée : attendez-la, ou arrêtez-la.`, true);
        const r = await appeler<{ arretee: boolean }>(`/atelier/${nom}/arreter`, { methode: 'POST' });
        return dire(r.arretee ? "Brique arrêtée — ce qu'elle avait déjà fait reste." : 'Aucun lancement en cours.', !r.arretee);
      }
      const f = formulaires[nom];
      // Les réglages de la brique partent avec le lancement, comme quand ils vivaient à côté du formulaire
      const valeurs: Record<string, unknown> = {
        profil: f.profil, offre: f.offre.trim(), poste: f.poste.trim(), entreprise: f.entreprise.trim(), deja_postule: f.deja_postule,
        essai: admin && !f.deja_postule && f.essai, silencieux: f.silencieux,
        ...(nom === 'constructeur'
          ? { palette: f.palette, fond: parametres?.constructeur_fond ?? '' }
          : { langue: f.langue, prompt_lettre: parametres?.constructeur_prompt_lettre ?? '', notes: parametres?.constructeur_notes_lettre ?? '' }),
        ...variante,
      };
      const r = await appeler<{ lancee: boolean; etat: EtatAtelier }>(`/atelier/${nom}`, { methode: 'POST', corps: { valeurs } });
      if (r.lancee) {
        enCours.current[nom] = true;
        telechargerApres.current = !!variante?.transparent;
        setEtats((e) => ({ ...e, [nom]: r.etat }));
      }
      const piece = nom === 'constructeur' ? 'le CV' : 'la lettre';
      dire(!r.lancee ? `Brique ${nom} déjà lancée depuis ici : attendez-la, ou arrêtez-la.`
        : variante ? 'Export lancé — le fichier se téléchargera à la fin.'
          : valeurs.essai ? `Essai lancé — ${piece} paraîtra sous l'étiquette « essai », rien n'est engagé.`
            : `Lancé — ${piece} entrera dans la galerie à la fin.`, !r.lancee);
    } catch (e) {
      dire(message(e), true);
    }
  }, [etats, formulaires, parametres, admin, dire]);

  const supprimer = useCallback(async (pieces: Production[]) => {
    try {
      const r = await appeler<{ fichiers: number }>('/productions/supprimer', {
        methode: 'POST', corps: { pieces: pieces.map((p) => ({ candidature: p.candidature, nature: p.nature })) } });
      dire(`${r.fichiers} pièce(s) supprimée(s).`);
      setChoisie((c) => (c && pieces.some((p) => clePiece(p) === clePiece(c)) ? null : c));
      await relire.current();
      return true;
    } catch (e) {
      dire(message(e), true);
      return false;
    }
  }, [dire]);

  const enregistrer = useCallback(async (modifs: Partial<Parametres>, texte = 'Réglages enregistrés — les prochains lancements les reprennent.') => {
    try {
      setParametres(await appeler<Parametres>('/parametres', { methode: 'PUT', corps: modifs }));
      if (texte) dire(texte);
      return true;
    } catch (e) {
      dire(`Enregistrement refusé : ${message(e)}`, true);
      return false;
    }
  }, [dire]);

  return {
    admin, dire, avis, genre, setGenre, filtres, setFiltres, lot, total, options, selection, setSelection, choisie, setChoisie,
    parametres, setParametres, profils, etats, formulaires, changerFormulaire, executer, modele, setModele, charger, supprimer, enregistrer,
  };
}
export type Documents = ReturnType<typeof useDocuments>;

export default function PageDocuments({ compte }: ProprietesPage) {
  const d = useDocuments(compte.admin);
  return (
    <Dock id="documents" principal="galerie" fenetres={{ galerie: { mini: [470, 300] } }} panneau={null}>
      <Activite />
      <Galerie d={d} />
      <PanneauDocuments d={d} />
    </Dock>
  );
}

// Autant de colonnes que la largeur en tient, deux rangées (trois sur un grand écran) à la hauteur de la fenêtre ; la suite défile
const LARGEUR_MIN = 145, HAUTEUR_MIN = 220, ECART = 14;
function useGrille(galerie: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = galerie.current;
    if (!el) return;
    const poser = () => {
      const s = getComputedStyle(el);
      const l = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      const h = el.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
      const rangs = Math.max(1, Math.floor((h + ECART) / (HAUTEUR_MIN + ECART)));
      el.style.setProperty('--cols', String(Math.max(1, Math.floor((l + ECART) / (LARGEUR_MIN + ECART)))));
      el.style.setProperty('--haut', `${Math.max(150, (h - ECART * (rangs - 1)) / rangs)}px`);
    };
    poser();
    const obs = new ResizeObserver(poser);
    obs.observe(el);
    return () => obs.disconnect();
  }, [galerie]);
}

// La rangée d'outils se replie par paliers tant qu'elle déborde, et se déplie dès qu'elle a de la place
function useRepli(outils: React.RefObject<HTMLDivElement | null>) {
  const ajuster = useCallback(() => {
    const el = outils.current;
    if (!el) return;
    let n = 0;
    el.dataset.repli = '0';
    while (n < 3 && el.scrollWidth > el.clientWidth + 1) el.dataset.repli = String(++n);
  }, [outils]);
  useLayoutEffect(ajuster);
  useLayoutEffect(() => {
    const el = outils.current;
    if (!el) return;
    const obs = new ResizeObserver(ajuster);
    obs.observe(el);
    return () => obs.disconnect();
  }, [outils, ajuster]);
}

function Galerie({ d }: { d: Documents }) {
  const { onglet, ouvrir } = usePanneau();
  const [confirmer, setConfirmer] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const galerie = useRef<HTMLDivElement>(null);
  const outils = useRef<HTMLDivElement>(null);
  useGrille(galerie);
  useRepli(outils);
  const { genre, filtres, lot, options, selection } = d;
  const pieces = lot?.lignes ?? [];
  const choisies = pieces.filter((p) => selection.has(clePiece(p)));
  const tout = pieces.length > 0 && pieces.every((p) => selection.has(clePiece(p)));
  const filtre = (cle: keyof Filtres, valeur: string) => d.setFiltres({ ...filtres, [cle]: valeur });
  const nouveau = genre === 'cv' ? 'nouveau-cv' : genre === 'lettre' ? 'nouvelle-lettre' : 'spontane';
  const modeles = d.parametres?.cv_spontanes ?? [];
  const batis = modeles.filter((m) => m.cv).length;
  const n = pieces.length, total = Math.max(d.total?.[genre === 'lettre' ? 'lettre' : 'cv'] ?? 0, n), s = n > 1 ? 's' : '';
  const compte = !lot ? '' : genre === 'lettre' ? (lot.fini ? `${n} lettre${s}` : `${n} lettre${s} chargée${s} sur ${total}`)
    : lot.fini ? `${n} CV` : `${n} CV chargé${s} sur ${total}`;
  const liees = choisies.filter((p) => p.offre_reelle).length;

  // Arrivé en bas de la galerie, la tranche suivante part toute seule ; le bouton reste
  const defiler = () => {
    const el = galerie.current;
    if (el && lot && !lot.fini && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) void d.charger(genre, filtres, lot);
  };
  const toutCocher = async (coche: boolean) => {
    if (!coche) return d.setSelection(new Set());
    // Tout, c'est tout ce que les filtres retiennent : les tranches pas encore chargées le sont d'abord
    let courant = lot;
    while (courant && !courant.fini) courant = await d.charger(genre, filtres, courant);
    d.setSelection(new Set((courant ?? lot)?.lignes.map(clePiece) ?? []));
  };
  const supprimer = async () => {
    setOccupe(true);
    if (await d.supprimer(choisies)) setConfirmer(false);
    setOccupe(false);
  };
  type Liste = 'poste' | 'entreprise' | 'profil' | 'fond_mode';
  const nom = (cle: Liste, v: string) => (cle === 'profil' ? sansJson(v) : v);
  const liste = (cle: Liste, lib: string, vide: string) => (
    <MenuFiltre lib={lib} valeur={filtres[cle] ? court(nom(cle, filtres[cle])) : vide} titre={filtres[cle] ? nom(cle, filtres[cle]) : vide} actif={!!filtres[cle]}
      choix={[{ cle: '', libelle: vide }, ...options[cle].map((v) => ({ cle: v, libelle: nom(cle, v) }))]} courant={filtres[cle]} choisir={(v) => filtre(cle, v)} />
  );

  return (
    <Fenetre id="galerie" as="div" className="docs-galerie" aria-label="Galerie des documents" titrePrise="Glisser pour détacher la galerie">
      <div ref={outils} className="outils" data-repli="0">
        <MenuFiltre valeur={GENRES.find((g) => g.cle === genre)!.libelle} actif choix={GENRES} courant={genre} choisir={(g) => d.setGenre(g as Genre)} />
        {genre !== 'spontanes' && (
          <>
            {liste('poste', 'Poste', 'Tous')}
            {liste('entreprise', 'Entreprise', 'Toutes')}
            {liste('profil', 'Profil', 'Tous')}
            {liste('fond_mode', 'Fond', 'Tous')}
            <MenuFiltre lib="Depuis" valeur={filtres.depuis ? filtres.depuis.slice(5).split('-').reverse().join('/') : '—'} titre={filtres.depuis || 'Toujours'}
              actif={!!filtres.depuis} choix={[{ cle: '', libelle: 'Toujours' }]} courant={filtres.depuis} choisir={() => filtre('depuis', '')}>
              <label className="menu-date">Depuis le<input type="date" className="saisie" value={filtres.depuis} onChange={(e) => filtre('depuis', e.target.value)} /></label>
            </MenuFiltre>
            <MenuFiltre lib="Essais" valeur={ESSAIS.find((e) => e.cle === filtres.essai)!.libelle} actif={!!filtres.essai} choix={ESSAIS} courant={filtres.essai} choisir={(v) => filtre('essai', v)} />
            {Object.values(filtres).some(Boolean) && <button type="button" className="lien-d tout-voir" onClick={() => d.setFiltres(VIDES)}>Tout voir</button>}
          </>
        )}
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          <button type="button" className={`action${onglet === 'reglages' ? ' allume' : ''}`} aria-haspopup="dialog" title="Réglages" onClick={() => ouvrir('reglages')}>
            <span className="ico">{ICONES.reglages}</span><span className="txt">Réglages</span>
          </button>
          {choisies.length > 0 && (
            <button type="button" className="action rouge" onClick={() => setConfirmer(true)}>
              <span className="ico">{ICONES.supprimer}</span><span><span className="txt">Supprimer </span>({choisies.length})</span>
            </button>
          )}
          <button type="button" className={`action plein${onglet === nouveau ? ' allume' : ''}`} aria-haspopup="dialog" onClick={() => {
            if (genre === 'spontanes') d.setModele(MODELE_VIDE);
            ouvrir(nouveau);
          }}>
            <span className="txt">{genre === 'cv' ? 'Nouveau CV' : genre === 'lettre' ? 'Nouvelle lettre' : 'Nouveau modèle'}</span><span className="ico">{ICONES.plus}</span>
          </button>
        </div>
      </div>
      {confirmer && choisies.length > 0 && (
        <Confirmer question={`Supprimer ${choisies.length} pièce${choisies.length > 1 ? 's' : ''} ?`} occupe={occupe} action="Supprimer"
          detail={liees ? `${liees} liée${liees > 1 ? 's' : ''} à une offre : le fichier part, la candidature envoyée reste.` : "Bâties sans annonce : rien d'autre n'en dépend."}
          onAnnuler={() => setConfirmer(false)} onConfirmer={supprimer} />
      )}
      <div ref={galerie} className="galerie" onScroll={defiler}>
        {genre === 'spontanes' ? (
          modeles.length ? modeles.map((m) => (
            <VignetteModele key={m.nom} m={m} ouverte={onglet === 'spontane' && d.modele?.original === m.nom} ouvrir={() => {
              d.setModele({ ...m, original: m.nom });
              ouvrir('spontane');
            }} />
          )) : <p className="vide-g">{d.parametres ? 'Aucun modèle encore : « Nouveau modèle », puis « Bâtir le CV ».' : 'Chargement…'}</p>
        ) : pieces.length ? pieces.map((p) => (
          <Vignette key={clePiece(p)} p={p} cochee={selection.has(clePiece(p))} ouverte={onglet === 'fiche' && !!d.choisie && clePiece(d.choisie) === clePiece(p)}
            cocher={(c) => {
              const suite = new Set(selection);
              if (c) suite.add(clePiece(p));
              else suite.delete(clePiece(p));
              d.setSelection(suite);
            }}
            ouvrir={() => {
              d.setChoisie(p);
              ouvrir('fiche');
            }} />
        )) : <p className="vide-g">{lot ? `Aucun${genre === 'lettre' ? 'e lettre' : ' CV'} à ces filtres.` : 'Chargement…'}</p>}
      </div>
      {d.avis}
      <div className="pagination">
        {genre === 'spontanes' ? (
          <span className="compte">{modeles.length} modèle{modeles.length > 1 ? 's' : ''} · {batis} bâti{batis > 1 ? 's' : ''}</span>
        ) : (
          <>
            <label className="tout"><input type="checkbox" className="case" aria-label="Tout sélectionner" checked={tout} onChange={(e) => void toutCocher(e.target.checked)} />Tout sélectionner</label>
            <span className="compte">{compte}</span>
            <span className="espace" />
            {lot && !lot.fini && (
              <button type="button" className="action" onClick={() => void d.charger(genre, filtres, lot)}><span className="ico">{ICONES.suite}</span>Charger la suite</button>
            )}
          </>
        )}
      </div>
    </Fenetre>
  );
}

// Vignette d'une pièce : la case et l'œil en tête, la première page au centre, le poste et ses repères dessous ; la carte ouvre sa fiche
function Vignette({ p, cochee, ouverte, cocher, ouvrir }: { p: Production; cochee: boolean; ouverte: boolean; cocher: (c: boolean) => void; ouvrir: () => void }) {
  const lien = `${RELAIS}/productions/${p.candidature}/${p.nature}`;
  const titre = `${p.poste || '(sans intitulé)'} · ${p.entreprise || '—'}`;
  return (
    <article className={`choix vignette${ouverte ? ' ouverte' : ''}`} aria-label={titre}>
      <button type="button" className="v-ouvrir" aria-label={`Ouvrir la fiche de fabrication : ${titre}`} onClick={ouvrir} />
      <div className="v-tete">
        <input type="checkbox" className="case" checked={cochee} aria-label={`Choisir ${titre}`} onChange={(e) => cocher(e.target.checked)} />
        {p.essai && <span className="essai" title="Essai de mise en page : aucune fiche d'employeur n'a été créée, rien n'est entré dans la file à postuler, et les comptes de compétences l'ignorent.">essai</span>}
        <a href={lien} target="_blank" rel="noopener noreferrer" className="v-oeil" title="Ouvrir le fichier" aria-label={`Ouvrir le fichier ${p.nom}`}>{ICONES.oeil}</a>
      </div>
      <div className="v-apercu">
        {p.apercu ? <img className="page-img" src={`${lien}/apercu?v=${encodeURIComponent(p.nom || p.date)}`} alt="" loading="lazy" decoding="async" />
          : <div className={`page${p.nature === 'lettre' ? ' lettre' : ''}`} style={{ ['--t' as string]: p.fond_accent || '#6E8FFE' }}><span className="format">{p.format || '?'}</span></div>}
      </div>
      <div className="v-texte">
        <strong title={p.poste}>{p.poste || '(sans intitulé)'}</strong>
        <span title={p.entreprise}>{p.entreprise || '—'} · {quand(p.date)}</span>
        <span className="prof">{sansJson(p.profil) || '—'}</span>
      </div>
    </article>
  );
}

// Vignette d'un modèle de CV spontané : sa première page une fois bâti, « à bâtir » sinon ; la carte l'ouvre dans le panneau
function VignetteModele({ m, ouverte, ouvrir }: { m: Modele; ouverte: boolean; ouvrir: () => void }) {
  const lien = `${RELAIS}/cv-spontanes/${encodeURIComponent(m.nom)}`;
  return (
    <article className={`choix vignette modele${ouverte ? ' ouverte' : ''}`} aria-label={`Modèle ${m.nom}`}>
      <button type="button" className="v-ouvrir" aria-label={`Ouvrir le modèle ${m.nom}`} onClick={ouvrir} />
      <div className="v-tete">
        <span className="etat-m">{m.cv ? 'bâti' : 'à bâtir'}</span>
        {m.cv && <a href={`${lien}/fichier`} target="_blank" rel="noopener noreferrer" className="v-oeil" title="Ouvrir le PDF" aria-label={`Ouvrir le PDF de ${m.nom}`}>{ICONES.oeil}</a>}
      </div>
      <div className="v-apercu">
        {m.cv ? <img className="page-img" src={`${lien}/apercu?v=${encodeURIComponent(m.cv)}`} alt="" loading="lazy" decoding="async" />
          : <div className="page a-batir"><span className="format">à bâtir</span></div>}
      </div>
      <div className="v-texte">
        <strong title={m.nom}>{m.nom}</strong>
        <span title={m.destination}>{m.destination || '—'}</span>
        <span className="prof">{m.poste || 'poste du profil'} · {sansJson(m.profil) || '—'}</span>
      </div>
    </article>
  );
}
