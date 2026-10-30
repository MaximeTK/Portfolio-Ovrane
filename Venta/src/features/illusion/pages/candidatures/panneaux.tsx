'use client';

import { LienIllusion } from '../../partage/LienIllusion';
import { useEffect, useState } from 'react';
import { appeler, televerser } from '../../api';
import { useSondage } from '../../activite/sondage';
import { MarqueAdmin, type Onglet } from '../../dock/Panneau';
import { nomProfil } from '../../partage/FicheOffre';

export type Avis = { texte: string; erreur?: boolean } | null;
// Le refus d'un lancement faute de profil complet : chaque profil et ce qui lui manque
export type Incomplet = { message: string; profils: { nom: string; manquants: { cle: string; libelle: string }[] }[] };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const duree = (s: number) => (!s ? "à l'instant" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);
const FLECHE = <span className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>;

// Réglages · Candidatures : ceux du compte, puis ceux du serveur pour l'admin ; seuls les champs changés partent
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

export function useOngletReglages({ admin, actif, fermer, setAvis }: { admin: boolean; actif: boolean; fermer: () => void; setAvis: (a: Avis) => void }): Onglet {
  const [lus, setLus] = useState<Parametres | null>(null);
  const [valeurs, setValeurs] = useState<Record<string, unknown>>({});
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const champs = admin ? [...DU_COMPTE, ...DU_SERVEUR] : DU_COMPTE;
  // Relus à chaque ouverture : un autre onglet a pu les changer
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    appeler<Parametres>('/parametres').then((p) => {
      if (!vivant) return;
      setLus(p);
      setValeurs(p);
      setErreur('');
    }).catch((e) => vivant && setErreur(message(e)));
    return () => {
      vivant = false;
    };
  }, [actif]);
  const changes = lus ? champs.filter((c) => valeurs[c.cle] !== lus[c.cle]) : [];
  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changes.length) return;
    setOccupe(true);
    try {
      const r = await appeler<Parametres>('/parametres', { methode: 'PUT', corps: Object.fromEntries(changes.map((c) => [c.cle, valeurs[c.cle]])) });
      setLus(r);
      setValeurs(r);
      setErreur('');
      setAvis({ texte: 'Réglages enregistrés : le prochain lancement les prendra.' });
    } catch (err) {
      setErreur(message(err));
    } finally {
      setOccupe(false);
    }
  };
  const champ = (c: Champ) => {
    const marque = DU_SERVEUR.includes(c) && <MarqueAdmin />;
    if (c.sorte === 'inter') {
      return (
        <label key={c.cle} className="inter"><span>{c.libelle}{marque}</span>
          <input type="checkbox" checked={!!valeurs[c.cle]} onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.checked }))} />
        </label>
      );
    }
    if (c.sorte === 'modele') {
      const noms = (lus?.modeles ?? []).map((m) => ({ nom: m.nom, texte: m.modele ? `${m.nom} · ${m.modele}` : m.nom }));
      const courant = String(valeurs[c.cle] ?? '');
      if (courant && !noms.some((m) => m.nom === courant)) noms.push({ nom: courant, texte: `${courant} (absent du catalogue)` });
      return (
        <label key={c.cle} className="reglage"><span>{c.libelle}{marque}</span>
          <select className="saisie" value={courant} onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value }))}>
            <option value="">{c.vide}</option>
            {noms.map((m) => <option key={m.nom} value={m.nom}>{m.texte}</option>)}
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
        {lus && admin && <div className="section-f"><h3>Serveur</h3>{DU_SERVEUR.map(champ)}</div>}
      </form>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={() => { if (lus) setValeurs(lus); fermer(); }}>Annuler</button>
        <button type="submit" form="reglages-candidatures" className="action plein" disabled={!changes.length || occupe}>Enregistrer{FLECHE}</button>
      </>
    ),
  };
}

// Ajouter une offre : à la file pour plus tard, ou une candidature menée tout de suite par l'atelier, comme l'« Exécuter » de l'ancien dashboard
type EtatAtelier = { en_cours: boolean; ok: boolean | null; erreur: string; depuis_s: number; duree_s: number };
const OPTIONS: { cle: string; libelle: string; admin?: boolean }[] = [
  { cle: 'spontanee', libelle: 'Candidature spontanée' },
  { cle: 'sans_filtre', libelle: 'Postuler sans tri' },
  { cle: 'reparer', libelle: 'Réparer le chemin' },
  { cle: 'reparer_complet', libelle: 'Réparer avec la vision complète' },
  { cle: 'debogage', libelle: 'Débogage', admin: true },
];
const VIERGE = { url: '', entreprise: '', titre: '', profil: '' };

export function useOngletAjout({ admin, actif, setAvis, relire, montrerIncomplet }: {
  admin: boolean; actif: boolean; setAvis: (a: Avis) => void; relire: () => void; montrerIncomplet: (i: Incomplet) => void;
}): Onglet {
  const [saisie, setSaisie] = useState(VIERGE);
  const [cv, setCv] = useState<File | null>(null);
  const [options, setOptions] = useState<Record<string, boolean>>({});
  const [profils, setProfils] = useState<{ nom: string }[] | null>(null);
  const [atelier, setAtelier] = useState<EtatAtelier | null>(null);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [suivre, setSuivre] = useState(false);
  useEffect(() => {
    if (!actif || profils) return;
    appeler<{ nom: string }[]>('/profils-candidature').then(setProfils).catch((e) => setErreur(message(e)));
  }, [actif, profils]);
  // Le lancement d'ici se suit toutes les 1,5 s, comme l'atelier de l'ancien dashboard
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
    if (/^https?:\/\/\S+$/i.test(saisie.url.trim())) return true;
    setErreur("Indiquez l'adresse de l'offre : c'est tout ce qu'il faut pour la mettre en file.");
    return false;
  };
  const ajouterALaFile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!urlValide()) return;
    setOccupe(true);
    try {
      const r = await appeler<{ neuve: boolean; entreprise_siren: string | null }>('/offres', {
        methode: 'POST',
        corps: { url: saisie.url.trim(), entreprise: saisie.entreprise.trim(), titre: saisie.titre.trim(), profil: saisie.profil, ...(cv ? { cv: await televerser(cv) } : {}) },
      });
      setAvis(r.neuve ? { texte: `Offre ajoutée à la file${r.entreprise_siren ? ' et rattachée à sa fiche' : ''}.` }
        : { texte: 'Cette offre était déjà en base : elle est rendue à la file.', erreur: true });
      // Le CV imposé ne valait que pour cette offre : il ne repart pas avec la suivante
      setSaisie((s) => ({ ...VIERGE, profil: s.profil }));
      setCv(null);
      setErreur('');
      relire();
    } catch (err) {
      setErreur(message(err));
    } finally {
      setOccupe(false);
    }
  };
  const postuler = async () => {
    setOccupe(true);
    try {
      if (atelier?.en_cours) {
        const r = await appeler<{ arretee: boolean }>('/atelier/candidature/arreter', { methode: 'POST' });
        setAvis(r.arretee ? { texte: 'Candidature arrêtée : ce qu’elle avait fait reste au journal.' } : { texte: 'Aucun lancement en cours.', erreur: true });
        return;
      }
      if (!urlValide()) return;
      if (!saisie.profil) return setErreur('Choisissez le profil du candidat : la candidature part avec lui.');
      // Un profil à compléter se dit avant tout lancement : rien ne partirait avec lui
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
      setAvis(r.lancee ? { texte: 'Candidature lancée : elle part par Ovrane, son avancée se lit dans En direct et l’Activité.' }
        : { texte: 'Une candidature lancée d’ici tourne déjà : attendez-la, ou arrêtez-la.', erreur: true });
      setErreur('');
      setSuivre(true);
    } catch (err) {
      setErreur(message(err));
    } finally {
      setOccupe(false);
    }
  };
  const lancement = !atelier || (!atelier.en_cours && atelier.ok == null) ? null
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
          <div className="champ"><label htmlFor="aj-url">Adresse de l&apos;offre</label>
            <input id="aj-url" className="saisie" type="url" placeholder="https://…" required value={saisie.url} onChange={(e) => poser('url', e.target.value)} /></div>
          <div className="grille-2">
            <div className="champ"><label htmlFor="aj-ent">Entreprise</label><input id="aj-ent" className="saisie" value={saisie.entreprise} onChange={(e) => poser('entreprise', e.target.value)} /></div>
            <div className="champ"><label htmlFor="aj-int">Intitulé</label><input id="aj-int" className="saisie" value={saisie.titre} onChange={(e) => poser('titre', e.target.value)} /></div>
          </div>
          <div className="champ"><label htmlFor="aj-prof">Profil du candidat</label>
            <select id="aj-prof" className="saisie" value={saisie.profil} onChange={(e) => poser('profil', e.target.value)}>
              <option value="">{profils === null ? 'Lecture des profils…' : 'Automatique (file seulement)'}</option>
              {(profils ?? []).map((p) => <option key={p.nom} value={p.nom}>{nomProfil(p.nom)}</option>)}
            </select></div>
          <div className="champ"><label htmlFor="aj-cv">CV imposé</label>
            <input id="aj-cv" className="saisie fichier" type="file" accept=".pdf,application/pdf" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
            <span className="aide-champ">Facultatif : un PDF joint tel quel à la place du CV fabriqué. « Ajouter à la file » l&apos;impose à l&apos;offre.</span></div>
        </div>
        <div className="section-f"><h3>Options</h3>
          {OPTIONS.filter((o) => !o.admin || admin).map((o) => (
            <label key={o.cle} className="inter"><span>{o.libelle}{o.admin && <MarqueAdmin />}</span>
              <input type="checkbox" checked={!!options[o.cle]} onChange={(e) => setOptions((v) => ({ ...v, [o.cle]: e.target.checked }))} />
            </label>
          ))}
          <p className="aide-champ">Les options valent pour « Postuler maintenant » seulement.</p>
        </div>
      </form>
    ),
    pied: (
      <>
        <button type="submit" form="ajout-offre" className="action" disabled={occupe}>Ajouter à la file</button>
        <button type="button" className="action plein" disabled={occupe} onClick={() => void postuler()}>{atelier?.en_cours ? 'Arrêter' : 'Postuler maintenant'}{FLECHE}</button>
      </>
    ),
  };
}

// Profil incomplet : aucune candidature ne part ; de quoi aller compléter chaque profil
export function ongletProfilIncomplet(incomplet: Incomplet | null, fermer: () => void): Onglet {
  return {
    cle: 'profil-incomplet', titre: 'Profil incomplet', label: 'Profil incomplet : aucune candidature ne part',
    corps: incomplet ? (
      <div className="section-f">
        <h3>Aucune candidature ne part</h3>
        <p className="texte-f">{incomplet.message}</p>
        <ul className="liste-f">
          {incomplet.profils.map((p) => <li key={p.nom}><b>{nomProfil(p.nom)}</b><span className="d">{p.manquants.map((m) => m.libelle).join(', ')}</span></li>)}
        </ul>
        <p className="aide-champ">La veille continue de récolter ses offres ; elles partiront une fois le profil complété.</p>
      </div>
    ) : <p className="texte-f">Aucun profil à compléter.</p>,
    pied: (
      <>
        <button type="button" className="action" onClick={fermer}>Fermer</button>
        {incomplet?.profils.map((p) => (
          <LienIllusion key={p.nom} vers={`profil?fiche=${encodeURIComponent(`${nomProfil(p.nom)}.json`)}`} className="action plein">Compléter {nomProfil(p.nom)}{FLECHE}</LienIllusion>
        ))}
      </>
    ),
  };
}

// En direct : un onglet par candidature menée ou finie depuis peu, l'écran de celle choisie ; relu toutes les 1,5 s comme la page Workflows
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
      <button type="button" className="action" aria-haspopup="dialog" disabled={!courante?.offre_cle} title={courante && !courante.offre_cle ? "L'offre de cette candidature n'est pas reconnue dans la file." : undefined}
        onClick={() => courante?.offre_cle && ouvrirFiche(courante.offre_cle)}>Voir la fiche offre</button>
    ),
  };
}
