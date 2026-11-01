'use client';

import './parametres-serveur.css';
import { useCallback, useEffect, useId, useState } from 'react';
import { appeler } from '../../api';
import { Activite } from '../../activite/Activite';
import { Dock, Fenetre, usePanneau, useVues } from '../../dock/Dock';
import { AuPied, Confirmer, Panneau, type Onglet } from '../../dock/Panneau';
import type { ProprietesPage } from '../liste';
import {
  CorpsEffacer, FormModele, MenuFournisseur, NEUF, Voyant, nomCourt, totalApercu, versBrouillon,
  type Apercu, type Brouillon, type Essai, type Fournisseur, type Modele,
} from './panneaux';

type Parametres = Record<string, unknown> & { modeles: Modele[]; fournisseurs: Record<string, Fournisseur> };
type Champ = { cle: string; libelle: string; sorte: 'nombre' | 'texte' | 'secret' | 'choix'; aide?: string; choix?: string[]; min?: number };
type Groupe = { cle: string; titre: string; aide: string; champs: Champ[] };
type Avis = { texte: string; erreur?: boolean } | null;

// Les groupes de la page, repris de la partie serveur des Paramètres de l'ancien dashboard ; Réinitialiser ouvre son onglet
const GROUPES: Groupe[] = [
  { cle: 'modeles', titre: "Modèles d'IA", champs: [],
    aide: 'Ceux du serveur, avec ses clés, pour tous les comptes. Un modèle saturé ou tombé passe aussitôt la demande à sa réserve.' },
  { cle: 'resolution', titre: 'Résolution du site officiel', aide: 'Le moteur qui retrouve le site officiel de chaque entreprise collectée.', champs: [
    { cle: 'moteur_recherche', libelle: 'Moteur de recherche', sorte: 'choix', choix: ['auto', 'serper', 'brave'],
      aide: '« serper » : les résultats de Google.com (recommandé). « auto » prend Serper s’il est configuré, sinon Brave.' },
    { cle: 'serper_api_key', libelle: 'Clé Serper (Google)', sorte: 'secret', aide: 'serper.dev : 2 500 recherches offertes à l’inscription, puis packs dès 50 $.' },
    { cle: 'brave_api_key', libelle: 'Clé Brave Search', sorte: 'secret', aide: 'Utilisée si Serper n’est pas configuré.' },
  ] },
  { cle: 'base', titre: 'Base partagée',
    aide: "La base MongoDB qu'Illusion et Ovrane lisent et écrivent tous deux : le portfolio y lit les candidatures et leurs CV, Illusion y lit les visites des liens suivis. Tes candidatures, tes profils et tes fichiers restent rangés sous ton adresse.",
    champs: [
      { cle: 'mongodb_uri', libelle: 'Adresse de la base', sorte: 'secret', aide: 'La même que la variable MONGODB_URI d’Ovrane (mongodb+srv://…). Gardée dans le coffre, jamais réaffichée.' },
      { cle: 'mongodb_base', libelle: 'Nom de la base', sorte: 'texte', aide: 'Le même que la variable MONGODB_DB d’Ovrane : venta_dev pour le développement.' },
      { cle: 'utilisateur', libelle: 'Ton adresse', sorte: 'texte', aide: 'Tes candidatures, profils et fichiers sont rangés sous elle, à part de ceux des autres utilisateurs.' },
    ] },
  { cle: 'guichets', titre: 'Guichets et quotas', aide: 'Ce que le serveur mène en même temps, et ce que chaque compte mène par jour.', champs: [
    { cle: 'guichets', libelle: 'Guichets du serveur', sorte: 'nombre', min: 1,
      aide: 'Candidatures menées en même temps sur le serveur, tous comptes confondus. Au-delà, chacune attend son guichet, le compte servi il y a le plus longtemps d’abord ; une attente de plus de 30 s se lit au journal du serveur. Réglé au-dessus de la pointe, il ne ralentit personne.' },
    { cle: 'candidatures_par_jour', libelle: 'Candidatures par jour et par compte', sorte: 'nombre', min: 0,
      aide: 'Le quota atteint, la file du compte attend le lendemain, et son journal le dit une fois. 0 : sans limite.' },
  ] },
];
// Le modèle de chaque brique : son réglage, son libellé, et ce que vaut le choix vide
const BRIQUES: [string, string, string][] = [
  ['audit_modele', 'Audit', 'Aucun'], ['candidature_modele', 'Candidature', 'Aucun'], ['jade_modele', 'JADE', 'Celui de la candidature'],
  ['constructeur_modele', 'Lettre', 'Aucun : le gabarit'], ['mail_modele', 'Mail', 'Aucun'], ['lapis_modele', 'LAPIS', 'Celui des mails'],
  ['ruby_modele', 'RUBY (analyse)', 'Celui des mails'], ['veille_tri_modele', 'Étiquettes', 'Celui des mails'],
];
const CHAMPS: Champ[] = [...GROUPES.flatMap((g) => g.champs), ...BRIQUES.map(([cle, libelle]): Champ => ({ cle, libelle, sorte: 'texte' }))];

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const decimal = (t: string) => parseFloat(t.replace(',', '.')) || 0;
// Un modèle tel qu'il part au serveur : sans clé, celle du coffre est gardée ; vide, elle est effacée
const sansCle = ({ cle_api: _, ...m }: Modele) => m;
const versEnvoi = (b: Brouillon) => ({
  nom: b.nom.trim(), fournisseur: b.fournisseur, modele: b.modele.trim(), base_url: b.base_url.trim(), reserve: b.reserve,
  reglages: Object.fromEntries(Object.entries(b.reglages).filter(([, v]) => v)), max_tokens: parseInt(b.max_tokens, 10) || 0,
  prix_entree: decimal(b.prix_entree), prix_cache: decimal(b.prix_cache), prix_ecriture: decimal(b.prix_ecriture), prix_sortie: decimal(b.prix_sortie),
  ...(b.cle.trim() || b.effacerCle ? { cle_api: b.cle.trim() } : {}),
});
const heure = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
const ICONES = {
  plus: <svg {...TRAIT} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
  supprimer: <svg {...TRAIT}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  valider: <svg {...TRAIT}><path d="m5 12 5 5 9-10" /></svg>,
  effacer: <svg {...TRAIT}><path d="M4 6h16M6 6l1 14h10l1-14M9 10l6 6M15 10l-6 6" /></svg>,
};
const ico = (i: React.ReactNode) => <span className="ico">{i}</span>;

export default function PageParametresServeur(_: ProprietesPage) {
  return (
    <Dock id="parametres-serveur" principal="serveur" panneau={null}
      fenetres={{ serveur: { mini: [560, 420], pref: [780, 480], flot: [920, 620] }, panneau: { flot: [460, 620] } }}>
      <Activite />
      <Serveur />
    </Dock>
  );
}

function Serveur() {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const { fermerVue } = useVues();
  const [lus, setLus] = useState<Parametres | null>(null);
  const [erreurLecture, setErreurLecture] = useState('');
  const [valeurs, setValeurs] = useState<Record<string, unknown>>({});
  const [secrets, setSecrets] = useState<Record<string, { saisie: string; effacer: boolean }>>({});
  const [groupe, setGroupe] = useState('modeles');
  const [filtre, setFiltre] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [essais, setEssais] = useState<Record<string, Essai>>({});
  // Change à chaque ajout entamé : le formulaire d'ajout repart vierge
  const [ajout, setAjout] = useState(0);
  const [confirmation, setConfirmation] = useState(false);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [erreurApercu, setErreurApercu] = useState('');
  const [enregistre, setEnregistre] = useState('');
  const [avis, setAvis] = useState<Avis>(null);
  const [occupe, setOccupe] = useState(false);
  const dire = useCallback((texte: string, erreur = false) => setAvis({ texte, erreur }), []);

  useEffect(() => {
    appeler<Parametres>('/parametres').then((p) => {
      setLus(p);
      setValeurs(p);
    }).catch((e) => setErreurLecture(message(e)));
  }, []);

  // Un avis se lit 3,5 s, une erreur 8 s
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis]);

  // Ce que l'effacement emporterait, compté à chaque ouverture de son onglet
  const compter = useCallback(() => {
    setApercu(null);
    appeler<Apercu>('/reinitialiser/apercu').then((a) => {
      setApercu(a);
      setErreurApercu('');
    }).catch((e) => setErreurApercu(message(e)));
  }, []);
  useEffect(() => {
    if (onglet === 'effacer') compter();
  }, [onglet, compter]);

  // Échap ferme la confirmation, sinon le panneau
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (confirmation) setConfirmation(false);
      else if (onglet) fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [confirmation, onglet, fermer]);

  // Ce qui partira : chaque champ dans sa forme, les secrets seulement retapés ou effacés
  const envoi = (c: Champ): unknown => (c.sorte === 'nombre' ? (valeurs[c.cle] === '' ? 0 : Number(valeurs[c.cle])) : valeurs[c.cle]);
  const changes = lus ? CHAMPS.filter((c) => (c.sorte === 'secret' ? !!(secrets[c.cle]?.saisie || secrets[c.cle]?.effacer) : envoi(c) !== lus[c.cle])) : [];

  const enregistrer = async () => {
    if (!changes.length || occupe) return;
    setOccupe(true);
    try {
      const r = await appeler<Parametres>('/parametres', {
        methode: 'PUT', corps: Object.fromEntries(changes.map((c) => [c.cle, c.sorte === 'secret' ? secrets[c.cle].saisie.trim() : envoi(c)])),
      });
      setLus(r);
      setValeurs(r);
      setSecrets({});
      setEnregistre(heure());
      dire('Paramètres du serveur enregistrés.');
    } catch (e) {
      dire(`Enregistrement refusé : ${message(e)}`, true);
    }
    setOccupe(false);
  };

  // Le catalogue part entier ; les autres changements en cours restent à enregistrer
  const enregistrerModeles = async (modeles: Record<string, unknown>[], texte: string) => {
    setOccupe(true);
    try {
      const r = await appeler<Parametres>('/parametres', { methode: 'PUT', corps: { modeles } });
      setLus(r);
      setValeurs((v) => ({ ...r, ...Object.fromEntries(changes.filter((c) => c.sorte !== 'secret').map((c) => [c.cle, v[c.cle]])) }));
      setEnregistre(heure());
      setSelection(new Set());
      dire(texte);
      return true;
    } catch (e) {
      dire(`Enregistrement refusé : ${message(e)}`, true);
      return false;
    } finally {
      setOccupe(false);
    }
  };

  // Un appel minuscule avec ce qui est saisi, la clé du coffre si elle n'est pas retapée : seul un modèle qui appelle les outils a sa place dans Illusion
  const tester = async (saisi: Record<string, unknown>, poser: (e: Essai) => void) => {
    poser({ etat: 'encours', detail: 'essai en cours…' });
    try {
      const { ok, detail } = await appeler<{ ok: boolean; detail: string }>('/modeles/tester', {
        methode: 'POST', corps: { nom: saisi.nom, fournisseur: saisi.fournisseur, modele: saisi.modele, base_url: saisi.base_url, reglages: saisi.reglages,
          ...('cle_api' in saisi ? { cle_api: saisi.cle_api } : {}) },
      });
      poser({ etat: ok ? 'ok' : 'ko', detail });
      dire(`${String(saisi.nom || 'Ce modèle')} : ${detail}`, !ok);
    } catch (e) {
      poser({ etat: 'ko', detail: message(e) });
      dire(message(e), true);
    }
  };

  const modeles = lus?.modeles ?? [];
  const fournisseurs = lus?.fournisseurs ?? {};
  const visibles = modeles.filter((m) => !filtre || m.fournisseur === filtre);
  const coches = visibles.filter((m) => selection.has(m.nom));
  const briquesDe = (noms: string[]) => BRIQUES.filter(([cle]) => noms.includes(String(valeurs[cle] ?? ''))).map(([, lib]) => lib);

  const ajouter = () => {
    if (onglet !== 'ajout') setAjout((n) => n + 1);
    ouvrir('ajout');
  };
  const supprimer = async () => {
    const partants = coches.map((m) => m.nom);
    if (await enregistrerModeles(modeles.filter((m) => !partants.includes(m.nom)).map(sansCle), `${partants.length} modèle(s) retiré(s) du catalogue.`)) {
      setConfirmation(false);
      if (onglet === 'modele' && objet && partants.includes(objet)) fermerVue('panneau');
    }
  };
  const toutEffacer = async () => {
    setOccupe(true);
    try {
      const r = await appeler<Record<string, number>>('/reinitialiser', { methode: 'POST' });
      dire(`Base réinitialisée : ${r.fiches} fiche(s), ${r.offres} offre(s), ${r.candidatures} candidature(s), ${r.mails} mail(s), ${r.fichiers} fichier(s).`);
      fermer();
    } catch (e) {
      dire(message(e), true);
    }
    setOccupe(false);
  };

  const edition = { modeles, fournisseurs, occupe, enregistrer: enregistrerModeles, tester };
  const total = totalApercu(apercu);
  const ongletEffacer: Onglet = {
    cle: 'effacer', titre: 'Effacer', label: total ? `Effacer ${total} enregistrement(s) ?` : 'Effacer',
    corps: <div className="serveur-f"><CorpsEffacer apercu={apercu} erreur={erreurApercu} /></div>,
    pied: total ? (
      <>
        <button type="button" className="action" onClick={fermer}>Annuler</button>
        <button type="button" className="action rouge" disabled={occupe} onClick={toutEffacer}>{ico(ICONES.effacer)}Tout effacer</button>
      </>
    ) : <button type="button" className="action" onClick={fermer}>Fermer</button>,
  };
  // Le formulaire pose ses boutons dans le pied par <AuPied>
  const onglets: Onglet[] = [{ cle: 'ajout', titre: 'Ajouter', label: 'Ajouter un modèle', corps: <EditionModele key={ajout} ancien={null} depart={NEUF} {...edition} />, pied: true }, ongletEffacer];
  // Un modèle du catalogue, à modifier ; chaque fenêtre a son brouillon
  const elements = {
    modele: (nom: string): Onglet => {
      const m = modeles.find((x) => x.nom === nom);
      return {
        cle: 'modele', titre: `Modifier « ${nom} »`,
        corps: m ? <EditionModele ancien={nom} depart={versBrouillon(m)} essai={essais[nom]} {...edition} />
          : <p className="texte-f">{lus ? `« ${nom} » n'est plus au catalogue.` : 'Lecture des paramètres…'}</p>,
        pied: !!m,
      };
    },
  };

  const g = GROUPES.find((x) => x.cle === groupe)!;
  const parFournisseur = [...new Set(modeles.map((m) => m.fournisseur))];
  const secret = (c: Champ) => {
    const s = secrets[c.cle] ?? { saisie: '', effacer: false };
    const pose = !!lus?.[c.cle];
    return (
      <span className="secret">
        <input id={`ps-${c.cle}`} className="saisie" type="password" autoComplete="new-password" value={s.saisie}
          placeholder={s.effacer ? "effacée à l'enregistrement" : pose ? 'enregistrée' : 'non renseignée'}
          onChange={(e) => setSecrets((x) => ({ ...x, [c.cle]: { saisie: e.target.value, effacer: false } }))} />
        {pose && !s.effacer && !s.saisie && (
          <button type="button" className="effacer" title="Retire ce secret du coffre à l'enregistrement." onClick={() => setSecrets((x) => ({ ...x, [c.cle]: { saisie: '', effacer: true } }))}>Effacer</button>
        )}
      </span>
    );
  };
  const controle = (c: Champ) => (
    <div key={c.cle} className="champ">
      <label htmlFor={`ps-${c.cle}`}>{c.libelle}</label>
      {c.sorte === 'secret' ? secret(c) : c.sorte === 'choix' ? (
        <select id={`ps-${c.cle}`} className="saisie" value={String(valeurs[c.cle] ?? '')} onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value }))}>
          {(c.choix ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input id={`ps-${c.cle}`} className="saisie" type={c.sorte === 'nombre' ? 'number' : 'text'} min={c.min} inputMode={c.sorte === 'nombre' ? 'numeric' : undefined}
          value={String(valeurs[c.cle] ?? '')} onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: c.sorte === 'nombre' && e.target.value !== '' ? Number(e.target.value) : e.target.value }))} />
      )}
      {c.aide && <p className="aide-champ">{c.aide}</p>}
    </div>
  );

  return (
    <>
      <Fenetre id="serveur" className="tableau" aria-label="Paramètres serveur" titrePrise="Glisser pour détacher les paramètres du serveur">
        <div className="outils">
          <p className="filtre titre-groupe"><span><span className="lib">Groupe</span>{g.titre}</span></p>
          {groupe === 'modeles' && (
            <MenuFournisseur valeur={`${filtre ? nomCourt(fournisseurs, filtre) : 'tous'} · ${visibles.length}`} courant={filtre} choisir={(f) => {
              setFiltre(f);
              setSelection(new Set());
            }} choix={[{ cle: '', libelle: 'tous', n: modeles.length }, ...parFournisseur.map((f) => ({ cle: f, libelle: nomCourt(fournisseurs, f), n: modeles.filter((m) => m.fournisseur === f).length }))]} />
          )}
          <span className="espace" />
          {groupe === 'modeles' && (
            <div className="actions" role="group" aria-label="Actions des modèles">
              {coches.length > 0 && (
                <button type="button" className="action rouge" title={`Supprimer ${coches.length} modèle(s)`} onClick={() => setConfirmation(true)}>
                  {ico(ICONES.supprimer)}<span><span className="txt">Supprimer </span>({coches.length})</span>
                </button>
              )}
              <button type="button" className={`action plein${onglet === 'ajout' ? ' allume' : ''}`} aria-haspopup="dialog" onClick={ajouter}>
                <span className="txt">Ajouter un modèle</span>{ico(ICONES.plus)}
              </button>
            </div>
          )}
        </div>
        {confirmation && coches.length > 0 && (
          <Confirmer question={`Supprimer ${coches.length} modèle(s) ?`} occupe={occupe} action="Supprimer" onAnnuler={() => setConfirmation(false)} onConfirmer={supprimer}
            detail={`Leurs clés quittent le coffre.${briquesDe(coches.map((m) => m.nom)).length ? ` Sans modèle ensuite : ${briquesDe(coches.map((m) => m.nom)).join(', ')}.` : ''}`} />
        )}
        <div className="corps-groupes">
          <nav className="groupes" aria-label="Groupes">
            {GROUPES.map((x) => (
              <button key={x.cle} type="button" className={`rubrique${x.cle === groupe ? ' actif' : ''}`} aria-current={x.cle === groupe ? 'page' : undefined}
                onClick={() => setGroupe(x.cle)}>{x.titre}</button>
            ))}
            <button type="button" className={`rubrique danger${onglet === 'effacer' ? ' allume' : ''}`} aria-expanded={onglet === 'effacer'} aria-haspopup="dialog"
              onClick={() => (onglet === 'effacer' ? fermer() : ouvrir('effacer'))}>Réinitialiser</button>
          </nav>
          <form className="groupe-contenu" onSubmit={(e) => {
            e.preventDefault();
            void enregistrer();
          }}>
            {!lus ? <p className={`aide-groupe${erreurLecture ? ' erreur' : ''}`} role={erreurLecture ? 'alert' : 'status'}>{erreurLecture || 'Lecture des paramètres…'}</p>
              : groupe === 'modeles' ? (
                <>
                  <p className="aide-groupe">{g.aide}</p>
                  <div className="defile grille-tab">
                    <table className="tab-modeles">
                      <thead>
                        <tr>
                          <th><input type="checkbox" className="case" aria-label="Tout sélectionner" checked={visibles.length > 0 && coches.length === visibles.length}
                            onChange={(e) => setSelection(new Set(e.target.checked ? visibles.map((m) => m.nom) : []))} /></th>
                          <th>Nom</th><th>Fournisseur</th><th>Modèle</th><th>Tokens max</th><th>$/M entrée</th><th title="lu en cache · écrit en cache">$/M cache</th>
                          <th>$/M sortie</th><th>Clé secrète</th><th aria-label="Dernier test" /><th aria-label="Tester" />
                        </tr>
                      </thead>
                      <tbody>
                        {visibles.map((m) => (
                          <tr key={m.nom} tabIndex={0} title={`Modifier « ${m.nom} »`} data-ouvre="modele" data-objet={m.nom}
                            className={`${selection.has(m.nom) ? 'coche' : ''}${onglet === 'modele' && objet === m.nom ? ' ouverte' : ''}`}
                            onClick={() => ouvrir('modele', m.nom)} onKeyDown={(e) => {
                              if (e.key !== 'Enter' || e.target !== e.currentTarget) return;
                              e.preventDefault();
                              ouvrir('modele', m.nom);
                            }}>
                            <td onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" className="case" aria-label={`Sélectionner ${m.nom}`} checked={selection.has(m.nom)} onChange={() => setSelection((s) => {
                                const n = new Set(s);
                                if (!n.delete(m.nom)) n.add(m.nom);
                                return n;
                              })} />
                            </td>
                            <td><b>{m.nom}</b></td><td className="d">{nomCourt(fournisseurs, m.fournisseur)}</td><td>{m.modele || '—'}</td>
                            <td className="num">{m.max_tokens ? m.max_tokens.toLocaleString('fr-FR') : '—'}</td><td className="num">{m.prix_entree}</td>
                            <td className="num" title="lu en cache · écrit en cache">{`${m.prix_cache} · ${m.prix_ecriture}`}</td><td className="num">{m.prix_sortie}</td>
                            <td className={`d${m.cle_api ? '' : ' vide'}`}>{m.cle_api ? 'enregistrée' : 'non renseignée'}</td>
                            <td><Voyant essai={essais[m.nom]} /></td>
                            <td><button type="button" className="action" disabled={essais[m.nom]?.etat === 'encours'} aria-label={`Tester ${m.nom}`}
                              title="Un appel minuscule avec ce qui est saisi : seul un modèle qui appelle les outils a sa place dans Illusion."
                              onClick={(e) => {
                                e.stopPropagation();
                                void tester(sansCle(m), (essai) => setEssais((x) => ({ ...x, [m.nom]: essai })));
                              }}>Tester</button></td>
                          </tr>
                        ))}
                        {!visibles.length && <tr className="vide-s"><td colSpan={11}>Aucun modèle{filtre ? ' de ce fournisseur' : ''} : « Ajouter un modèle » en pose un.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="briques">
                    <h3 className="etiquette">Modèle de chaque brique</h3>
                    <div className="grille-4">
                      {BRIQUES.map(([cle, libelle, vide]) => {
                        const v = String(valeurs[cle] ?? '');
                        const options: [string, string][] = [['', vide], ...modeles.map((m): [string, string] => [m.nom, m.nom])];
                        if (v && !options.some(([o]) => o === v)) options.push([v, `${v} (absent du catalogue)`]);
                        return (
                          <div key={cle} className="champ">
                            <label htmlFor={`ps-${cle}`}>{libelle}</label>
                            <select id={`ps-${cle}`} className="saisie" value={v} onChange={(e) => setValeurs((x) => ({ ...x, [cle]: e.target.value }))}>
                              {options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="defile">
                  <p className="aide-groupe">{g.aide}</p>
                  <div className="form-colonnes">{g.champs.map(controle)}</div>
                </div>
              )}
            <div className="pied-groupe">
              <span className="etat-changes">{changes.length
                ? `${changes.length} changement${changes.length > 1 ? 's' : ''} non enregistré${changes.length > 1 ? 's' : ''} : ${changes.slice(0, 3).map((c) => c.libelle).join(', ')}${changes.length > 3 ? '…' : ''}`
                : enregistre ? `Enregistré à ${enregistre}` : ''}</span>
              <button type="submit" className="action plein" disabled={!changes.length || occupe}>Enregistrer{ico(ICONES.valider)}</button>
            </div>
          </form>
        </div>
        {avis && <p className={`avis${avis.erreur ? ' erreur' : ''}`} role={avis.erreur ? 'alert' : 'status'} onClick={() => setAvis(null)}>{avis.texte}</p>}
      </Fenetre>
      <Panneau elements={elements} onglets={onglets} />
    </>
  );
}

type ProprietesEdition = {
  ancien: string | null; depart: Brouillon; essai?: Essai; modeles: Modele[]; fournisseurs: Record<string, Fournisseur>; occupe: boolean;
  enregistrer: (modeles: Record<string, unknown>[], texte: string) => Promise<boolean>; tester: (saisi: Record<string, unknown>, poser: (e: Essai) => void) => Promise<void>;
};

// Un modèle à ajouter (`ancien` nul) ou à modifier : brouillon, erreur et essai sont ceux de sa fenêtre, ses boutons vont dans le pied de celle-ci
function EditionModele({ ancien, depart, essai: essaiLu, modeles, fournisseurs, occupe, enregistrer, tester }: ProprietesEdition) {
  const { fermer } = usePanneau();
  const id = useId();
  const [brouillon, setBrouillon] = useState(depart);
  const [erreur, setErreur] = useState('');
  const [essai, setEssai] = useState(essaiLu);
  const valider = async () => {
    const nom = brouillon.nom.trim();
    if (!nom) return setErreur('Donnez-lui un nom : les briques le choisissent par lui.');
    if (modeles.some((m) => m.nom === nom && m.nom !== ancien)) return setErreur(`Un modèle s'appelle déjà « ${nom} ».`);
    setErreur('');
    const neuf = versEnvoi(brouillon);
    const liste = ancien === null ? [...modeles.map(sansCle), neuf] : modeles.map((m) => (m.nom === ancien ? neuf : sansCle(m)));
    if (await enregistrer(liste, ancien === null ? `Modèle « ${nom} » ajouté au catalogue.` : `Modèle « ${nom} » enregistré.`)) fermer();
  };
  return (
    <div className="serveur-f">
      <FormModele id={id} brouillon={brouillon} poser={setBrouillon} fournisseurs={fournisseurs} erreur={erreur} valider={valider}
        autres={modeles.map((m) => m.nom).filter((n) => n !== ancien && n !== brouillon.nom.trim())} />
      <AuPied>
          <button type="button" className="action gauche tester-f" disabled={essai?.etat === 'encours'} title="Un appel minuscule avec ce qui est saisi : seul un modèle qui appelle les outils a sa place dans Illusion."
            onClick={() => tester(versEnvoi(brouillon), setEssai)}><Voyant essai={essai} />Tester</button>
          <button type="button" className="action" onClick={fermer}>Annuler</button>
          <button type="submit" form={id} className="action plein" disabled={occupe}>{ancien === null ? 'Ajouter' : 'Enregistrer'}{ico(ancien === null ? ICONES.plus : ICONES.valider)}</button>
      </AuPied>
    </div>
  );
}
