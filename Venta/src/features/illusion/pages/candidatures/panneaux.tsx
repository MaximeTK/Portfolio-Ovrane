'use client';

import { LienIllusion } from '../../partage/LienIllusion';
import { useEffect, useState } from 'react';
import { appeler, televerser } from '../../api';
import { useSondage } from '../../activite/sondage';
import { MarqueAdmin, type Onglet } from '../../dock/Panneau';
import { useGeste, useParametresOuverts, duree } from '../commun';
import { avisAjout, posterOffre, urlOffreValide } from '../offres/commun';
import { Action } from '../../elements/Action';
import type { Dire } from '../../elements/Avis';
import { Champ, Interrupteur, ChampSaisie, ChampListe, OptionsModele, SectionFiche } from '../../elements/Champ';
import { ICONES } from '../../elements/icones';
import { message, nomProfil } from '../../elements/format';

// Refus d'un lancement faute de profil complet : chaque profil et ce qui manque
export type Incomplet = { message: string; profils: { nom: string; manquants: { cle: string; libelle: string }[] }[] };

// Réglages : compte, puis serveur pour l'admin ; seuls les changés partent
type Parametres = Record<string, unknown> & { modeles: { nom: string; modele?: string }[] };
type Champ = { cle: string; libelle: string; sorte: 'nombre' | 'inter' | 'modele'; min?: number; max?: number; vide?: string };
const DU_COMPTE: Champ[] = [
  { cle: 'candidature_par_lot', libelle: 'Candidatures par lancement', sorte: 'nombre', min: 1, max: 100 },
  { cle: 'candidature_paralleles', libelle: 'Candidatures en même temps', sorte: 'nombre', min: 1 },
  { cle: 'candidature_timeout_secondes', libelle: 'Timeout (s)', sorte: 'nombre', min: 60 },
  { cle: 'candidature_inscription', libelle: "Créer un compte si l'ATS l'exige", sorte: 'inter' },
  { cle: 'candidature_rejeu', libelle: 'Rejouer le chemin appris', sorte: 'inter' },
  { cle: 'creer_fiches', libelle: 'Créer la fiche entreprise', sorte: 'inter' },
];
const DU_SERVEUR: Champ[] = [
  { cle: 'candidature_tours', libelle: 'Tours de modèle', sorte: 'nombre', min: 1, max: 100 },
  { cle: 'guichets', libelle: 'Guichets du serveur', sorte: 'nombre', min: 1 },
  { cle: 'candidatures_par_jour', libelle: 'Candidatures par jour et par compte', sorte: 'nombre', min: 0 },
  { cle: 'candidature_modele', libelle: 'Modèle', sorte: 'modele', vide: '— aucun —' },
  { cle: 'jade_modele', libelle: 'Modèle de JADE', sorte: 'modele', vide: '— celui de la candidature —' },
];

export function useOngletReglages({ admin, actif, fermer, dire }: { admin: boolean; actif: boolean; fermer: () => void; dire: Dire }): Onglet {
  const [lus, setLus] = useState<Parametres | null>(null);
  const [valeurs, setValeurs] = useState<Record<string, unknown>>({});
  const [erreur, setErreur] = useState('');
  const { occupe, geste } = useGeste(setErreur);
  const champs = admin ? [...DU_COMPTE, ...DU_SERVEUR] : DU_COMPTE;
  useParametresOuverts<Parametres>(actif, (p) => {
    setLus(p);
    setValeurs(p);
  }, setErreur);
  const changes = lus ? champs.filter((c) => valeurs[c.cle] !== lus[c.cle]) : [];
  const enregistrer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changes.length) return;
    return geste(async () => {
      const r = await appeler<Parametres>('/parametres', { methode: 'PUT', corps: Object.fromEntries(changes.map((c) => [c.cle, valeurs[c.cle]])) });
      setLus(r);
      setValeurs(r);
      setErreur('');
      dire('Réglages enregistrés : le prochain lancement les prendra.');
    });
  };
  const champ = (c: Champ) => {
    const marque = DU_SERVEUR.includes(c) && <MarqueAdmin />;
    if (c.sorte === 'inter') {
      return (
        <Interrupteur key={c.cle} libelle={<>{c.libelle}{marque}</>} checked={!!valeurs[c.cle]} onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.checked }))} />
      );
    }
    if (c.sorte === 'modele') {
      const courant = String(valeurs[c.cle] ?? '');
      return (
        <label key={c.cle} className="reglage"><span>{c.libelle}{marque}</span>
          <select className="saisie" value={courant} onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value }))}>
            <OptionsModele modeles={lus?.modeles ?? []} vide={c.vide ?? ''} valeur={courant} />
          </select>
        </label>
      );
    }
    return (
      <label key={c.cle} className="reglage"><span>{c.libelle}{marque}</span>
        <input className="saisie" type="number" min={c.min} max={c.max} value={String(valeurs[c.cle] ?? '')}
          onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value === '' ? '' : Number(e.target.value) }))} />
      </label>
    );
  };
  return {
    cle: 'reglages', titre: 'Réglages', label: 'Réglages · Candidatures',
    corps: (
      <form id="reglages-candidatures" onSubmit={enregistrer} aria-label="Réglages · Candidatures">
        {erreur && <p className="avis-fiche erreur" role="alert">{erreur}</p>}
        {!lus && !erreur && <p className="texte-f">Lecture des réglages…</p>}
        {lus && <div className="section-f">{DU_COMPTE.map(champ)}</div>}
        {lus && admin && <SectionFiche titre="Serveur">{DU_SERVEUR.map(champ)}</SectionFiche>}
      </form>
    ),
    pied: (
      <>
        <Action onClick={() => { if (lus) setValeurs(lus); fermer(); }}>Annuler</Action>
        <Action plein iconeApres={ICONES.fleche} type="submit" form="reglages-candidatures" disabled={!changes.length || occupe}>Enregistrer</Action>
      </>
    ),
  };
}

// Ajouter une offre : à la file, ou menée tout de suite par l'atelier
type EtatAtelier = { en_cours: boolean; ok: boolean | null; erreur: string; depuis_s: number; duree_s: number };
const OPTIONS: { cle: string; libelle: string; admin?: boolean }[] = [
  { cle: 'spontanee', libelle: 'Candidature spontanée' },
  { cle: 'sans_filtre', libelle: 'Postuler sans tri' },
  { cle: 'reparer', libelle: 'Réparer le chemin' },
  { cle: 'reparer_complet', libelle: 'Réparer avec la vision complète' },
  { cle: 'debogage', libelle: 'Débogage', admin: true },
];
const VIERGE = { url: '', entreprise: '', titre: '', profil: '' };

export function useOngletAjout({ admin, actif, dire, relire, montrerIncomplet }: {
  admin: boolean; actif: boolean; dire: Dire; relire: () => void; montrerIncomplet: (i: Incomplet) => void;
}): Onglet {
  const [saisie, setSaisie] = useState(VIERGE);
  const [cv, setCv] = useState<File | null>(null);
  const [options, setOptions] = useState<Record<string, boolean>>({});
  const [profils, setProfils] = useState<{ nom: string }[] | null>(null);
  const [atelier, setAtelier] = useState<EtatAtelier | null>(null);
  const [erreur, setErreur] = useState('');
  const { occupe, geste } = useGeste(setErreur);
  const [suivre, setSuivre] = useState(false);
  useEffect(() => {
    if (!actif || profils) return;
    appeler<{ nom: string }[]>('/profils-candidature').then(setProfils).catch((e) => setErreur(message(e)));
  }, [actif, profils]);
  // Le lancement d'ici se suit toutes les 1,5 s
  useSondage(async () => {
    try {
      const etat = await appeler<EtatAtelier>('/atelier/candidature');
      setAtelier(etat);
      if (!etat.en_cours) setSuivre(false);
    } catch (e) {
      setErreur(message(e));
      setSuivre(false);
    }
  }, 1500, actif || suivre);
  const poser = (cle: keyof typeof VIERGE, valeur: string) => setSaisie((s) => ({ ...s, [cle]: valeur }));
  const urlValide = () => {
    if (urlOffreValide(saisie.url)) return true;
    setErreur("Indiquez l'adresse de l'offre : c'est tout ce qu'il faut pour la mettre en file.");
    return false;
  };
  const ajouterALaFile = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!urlValide()) return;
    return geste(async () => {
      const r = await posterOffre({ ...saisie, entreprise: saisie.entreprise.trim(), titre: saisie.titre.trim() }, cv);
      dire(...avisAjout(r, 'Cette offre était déjà en base : elle est rendue à la file.'));
      // Le CV imposé ne vaut que pour cette offre, pas la suivante
      setSaisie((s) => ({ ...VIERGE, profil: s.profil }));
      setCv(null);
      setErreur('');
      relire();
    });
  };
  const postuler = () => geste(async () => {
    if (atelier?.en_cours) {
      const r = await appeler<{ arretee: boolean }>('/atelier/candidature/arreter', { methode: 'POST' });
      dire(r.arretee ? 'Candidature arrêtée : ce qu’elle avait fait reste au journal.' : 'Aucun lancement en cours.', !r.arretee);
      return;
    }
    if (!urlValide()) return;
    if (!saisie.profil) return setErreur('Choisissez le profil du candidat : la candidature part avec lui.');
    // Un profil à compléter se dit avant tout lancement : rien ne partirait
    const { profils: incomplets } = await appeler<{ profils: Record<string, { cle: string; libelle: string }[]> }>('/profils-incomplets');
    if (incomplets[saisie.profil]?.length) {
      montrerIncomplet({ message: `Aucune candidature ne peut partir : le profil « ${nomProfil(saisie.profil)} » a des champs obligatoires vides.`,
        profils: [{ nom: saisie.profil, manquants: incomplets[saisie.profil] }] });
      return;
    }
    const p = await appeler<Record<string, unknown>>('/parametres');
    const r = await appeler<{ lancee: boolean }>('/atelier/candidature', { methode: 'POST', corps: { valeurs: {
      url: saisie.url.trim(), entreprise: saisie.entreprise.trim(), titre: saisie.titre.trim(), profil: saisie.profil,
      navigateur: p.candidature_navigateur, tours: p.candidature_tours, inscription: p.candidature_inscription, rejeu: p.candidature_rejeu,
      ...Object.fromEntries(OPTIONS.filter((o) => !o.admin || admin).map((o) => [o.cle, !!options[o.cle]])),
      ...(cv ? { cv: await televerser(cv) } : {}),
    } } });
    dire(r.lancee ? 'Candidature lancée : elle part par Ovrane, son avancée se lit dans En direct et l’Activité.' : 'Une candidature lancée d’ici tourne déjà : attendez-la, ou arrêtez-la.', !r.lancee);
    setErreur('');
    setSuivre(true);
  });
  const lancement =!atelier || (!atelier.en_cours && atelier.ok == null) ? null
    : atelier.en_cours ? { texte: `Candidature en cours · ${duree(atelier.depuis_s)}` }
      : atelier.ok ? { texte: `Dernière candidature terminée en ${duree(atelier.duree_s)}.` }
        : { texte: `Dernière candidature en échec : ${atelier.erreur || 'voir le journal du serveur'}.`, erreur: true };
  return {
    cle: 'ajout', titre: 'Ajouter', label: 'Ajouter une offre',
    corps: (
      <form id="ajout-offre" onSubmit={ajouterALaFile} aria-label="Ajouter une offre">
        {erreur && <p className="avis-fiche erreur" role="alert">{erreur}</p>}
        {lancement && <p className={`avis-fiche${lancement.erreur ? ' erreur' : ''}`} role="status">{lancement.texte}</p>}
        <div className="section-f">
          <ChampSaisie id="aj-url" libelle="Adresse de l&apos;offre" type="url" placeholder="https://…" required value={saisie.url} onChange={(e) => poser('url', e.target.value)} />
          <div className="grille-2">
            <ChampSaisie id="aj-ent" libelle="Entreprise" value={saisie.entreprise} onChange={(e) => poser('entreprise', e.target.value)} />
            <ChampSaisie id="aj-int" libelle="Intitulé" value={saisie.titre} onChange={(e) => poser('titre', e.target.value)} />
          </div>
          <ChampListe id="aj-prof" libelle="Profil du candidat" value={saisie.profil} onChange={(e) => poser('profil', e.target.value)}>
              <option value="">{profils === null ? 'Lecture des profils…' : 'Automatique (file seulement)'}</option>
              {(profils ?? []).map((p) => <option key={p.nom} value={p.nom}>{nomProfil(p.nom)}</option>)}
            </ChampListe>
          <Champ pour="aj-cv" libelle="CV imposé">
            <input id="aj-cv" className="saisie fichier" type="file" accept=".pdf,application/pdf" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
            <span className="aide-champ">Facultatif : un PDF joint tel quel à la place du CV fabriqué. « Ajouter à la file » l&apos;impose à l&apos;offre.</span></Champ>
        </div>
        <SectionFiche titre="Options">
          {OPTIONS.filter((o) => !o.admin || admin).map((o) => (
            <Interrupteur key={o.cle} libelle={<>{o.libelle}{o.admin && <MarqueAdmin />}</>} checked={!!options[o.cle]} onChange={(e) => setOptions((v) => ({ ...v, [o.cle]: e.target.checked }))} />
          ))}
          <p className="aide-champ">Les options valent pour « Postuler maintenant » seulement.</p>
        </SectionFiche>
      </form>
    ),
    pied: (
      <>
        <Action type="submit" form="ajout-offre" disabled={occupe}>Ajouter à la file</Action>
        <Action plein iconeApres={ICONES.fleche} disabled={occupe} onClick={() => void postuler()}>{atelier?.en_cours ? 'Arrêter' : 'Postuler maintenant'}</Action>
      </>
    ),
  };
}

// Profil incomplet : aucune candidature ne part ; de quoi le compléter
export function ongletProfilIncomplet(incomplet: Incomplet | null, fermer: () => void): Onglet {
  return {
    cle: 'profil-incomplet', titre: 'Profil incomplet', label: 'Profil incomplet : aucune candidature ne part',
    corps: incomplet ? (
      <SectionFiche titre="Aucune candidature ne part">
        <p className="texte-f">{incomplet.message}</p>
        <ul className="liste-f">
          {incomplet.profils.map((p) => <li key={p.nom}><b>{nomProfil(p.nom)}</b><span className="d">{p.manquants.map((m) => m.libelle).join(', ')}</span></li>)}
        </ul>
        <p className="aide-champ">La veille continue de récolter ses offres ; elles partiront une fois le profil complété.</p>
      </SectionFiche>
    ) : <p className="texte-f">Aucun profil à compléter.</p>,
    pied: (
      <>
        <Action onClick={fermer}>Fermer</Action>
        {incomplet?.profils.map((p) => (
          <LienIllusion key={p.nom} vers={`profil?fiche=${encodeURIComponent(`${nomProfil(p.nom)}.json`)}`} className="action plein">Compléter {nomProfil(p.nom)}<span className="ico">{ICONES.fleche}</span></LienIllusion>
        ))}
      </>
    ),
  };
}

// En direct : un onglet par candidature menée ou récente, relu toutes les 1,5 s
type EnDirect = {
  id: string; debut?: string; site?: string; page?: string; titre?: string; phase?: string; tours?: number; rejeu?: { gestes?: number };
  offre?: { intitule?: string; entreprise?: string; lieu?: string }; fini?: boolean; abouti?: boolean; fin?: string; offre_cle: string;
};
const ecoule = (debut?: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(debut ?? '').getTime()) / 1000));
  return Number.isFinite(s) ? (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`) : '—';
};

export function useOngletDirect({ actif, ouvrirFiche }: { actif: boolean; ouvrirFiche: (cle: string) => void }): Onglet {
  const [lues, setLues] = useState<EnDirect[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [choisi, setChoisi] = useState('');
  useSondage(async () => {
    try {
      setLues((await appeler<{ candidatures: EnDirect[] }>('/vues/candidatures/direct')).candidatures);
      setErreur('');
    } catch (e) {
      setErreur(message(e));
    }
  }, 1500, actif);
  const courante = lues?.find((c) => c.id === choisi) ?? lues?.find((c) => !c.fini) ?? lues?.[0];
  const etat = (c: EnDirect) => (c.fini ? (c.abouti ? 'finie' : 'arrêtée') : 'en cours');
  return {
    cle: 'direct', titre: 'En direct', label: 'En direct', admin: true,
    corps: (
      <>
        {erreur && <p className="avis-fiche erreur" role="alert">{erreur}</p>}
        {lues !== null && !courante && <p className="texte-f">Aucune candidature en cours : elles apparaissent ici dès que la brique Candidature en mène une ; celles qui viennent de finir restent un quart d&apos;heure.</p>}
        {courante && (
          <div className="direct">
            <div className="onglets-d" role="tablist" aria-label="Candidatures en cours">
              {lues!.map((c) => (
                <button key={c.id} type="button" role="tab" aria-selected={c.id === courante.id} className={`choix onglet-d${c.id === courante.id ? ' actif' : ''}`} onClick={() => setChoisi(c.id)}>
                  <strong><span className={`carre ${c.fini ? (c.abouti ? 'finie' : 'arretee') : 'cours'}`} />{c.offre?.entreprise || c.site || c.id}</strong>
                  <small>{c.site} · {etat(c)}</small>
                </button>
              ))}
            </div>
            <div className="ecran-d" role="tabpanel">
              <h3>{courante.offre?.intitule || courante.titre || "Offre en cours de lecture"}</h3>
              <p className="d">{[courante.offre?.entreprise, courante.offre?.lieu].filter(Boolean).join(' · ')}</p>
              <div className="chiffres-d"><span><b>{courante.tours ?? 0}</b>tour(s) du modèle</span><span><b>{courante.rejeu?.gestes ?? 0}</b>geste(s) rejoué(s)</span></div>
              <p className="etat-d">{courante.fini ? `${courante.abouti ? 'Finie' : 'Arrêtée'} : ${courante.fin || ''}` : `En cours depuis ${ecoule(courante.debut)}${courante.phase ? ` — étape ${courante.phase}` : ''}`}</p>
              <p className="page-d">{courante.site} — {courante.page}</p>
            </div>
          </div>
        )}
      </>
    ),
    pied: (
      <Action aria-haspopup="dialog" disabled={!courante?.offre_cle} data-ouvre="fiche-offre" data-objet={courante?.offre_cle || undefined} title={courante && !courante.offre_cle ? "L'offre de cette candidature n'est pas reconnue dans la file." : undefined} onClick={() => courante?.offre_cle && ouvrirFiche(courante.offre_cle)}>Voir la fiche offre</Action>
    ),
  };
}
