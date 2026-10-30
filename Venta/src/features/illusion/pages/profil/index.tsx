'use client';

import './profil.css';
import { useCallback, useEffect, useState } from 'react';
import { appeler } from '../../api';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, Panneau, type Onglet } from '../../dock/Panneau';
import { Activite } from '../../activite/Activite';
import type { ProprietesPage } from '../liste';
import { FORMES_CHAMP, SECTIONS_DE_CHAMP, libelleDonnee, titreProfil, type ChampSchema } from './champs';
import { EditeurProfil, useEditeur, type EtatProfil, type Profil } from './editeur';

type ProfilDispo = { nom: string; chemin: string };
type Manque = { cle: string; libelle: string };
type Avis = { texte: string; erreur?: boolean } | null;
type Demandee = { cle: string; libelles?: string[]; sites?: string[] };
type Dire = (texte: string, erreur?: boolean) => void;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const nomFichier = (chemin: string) => chemin.split(/[\\/]/).pop() ?? chemin;
const SANS_ETAT: EtatProfil = { manquants: [], a_completer: [] };
const SVG = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', 'aria-hidden': true } as const;
const ICONES = {
  supprimer: <svg {...SVG}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  dupliquer: <svg {...SVG}><rect x="8" y="8" width="12" height="12" /><path d="M16 8V4H4v12h4" /></svg>,
  fleche: <svg {...SVG}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  plus: <svg {...SVG}><path d="M12 5v14M5 12h14" /></svg>,
};
const ico = (i: React.ReactNode) => <span className="ico">{i}</span>;
// Un profil sans expérience est refusé par le constructeur : la carte vide le dit d'entrée
const neuve = (): Profil => ({ experiences: [{}] });

export default function PageProfil({ compte, recherche }: ProprietesPage) {
  const params = new URLSearchParams(recherche);
  const depart = compte.admin && params.get('champ') !== null ? 'champ' : params.get('nouveau') ? 'nouveau' : null;
  return (
    <Dock id="profil" principal="profils" panneau={depart}
      fenetres={{ profils: { mini: [520, 300], pref: [760, 420], flot: [900, 600] }, panneau: { flot: [480, 640] } }}>
      <Activite />
      <Profils admin={compte.admin} fiche={params.get('fiche')} champ={params.get('champ')} libelle={params.get('libelle')} />
    </Dock>
  );
}

function Profils({ admin, fiche, champ, libelle }: { admin: boolean; fiche: string | null; champ: string | null; libelle: string | null }) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const [profils, setProfils] = useState<ProfilDispo[] | null>(null);
  const [incomplets, setIncomplets] = useState<Record<string, Manque[]>>({});
  const [schema, setSchema] = useState<ChampSchema[]>([]);
  const [choisi, setChoisi] = useState('');
  const [origine, setOrigine] = useState<Profil>({});
  const [etat, setEtat] = useState<EtatProfil>(SANS_ETAT);
  const [avis, setAvis] = useState<Avis>(null);
  const [confirmation, setConfirmation] = useState<'supprimer' | 'dupliquer' | null>(null);
  const [nomCopie, setNomCopie] = useState('');
  const [bandeauFerme, setBandeauFerme] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const editeur = useEditeur(origine, schema);
  const dire = useCallback<Dire>((texte, erreur = false) => setAvis({ texte, erreur }), []);

  // Un avis se lit 3,5 s, une erreur 8 s, comme les notifications de l'ancien dashboard
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis]);

  const relireListe = useCallback(async () => {
    const [liste, inc, sch] = await Promise.all([
      appeler<ProfilDispo[]>('/profils-candidature'),
      appeler<{ profils: Record<string, Manque[]> }>('/profils-incomplets').catch(() => ({ profils: {} })),
      // Sans base partagée, ni champ ajouté ni manque à dire : l'éditeur s'ouvre comme avant
      appeler<{ champs: ChampSchema[] }>('/schema-profil').catch(() => ({ champs: [] })),
    ]);
    setProfils(liste);
    setIncomplets(inc.profils ?? {});
    setSchema((avant) => (JSON.stringify(avant) === JSON.stringify(sch.champs) ? avant : sch.champs));
    return liste;
  }, []);

  const ouvrirProfil = useCallback(async (nom: string) => {
    try {
      const lu = await appeler<{ contenu: string }>(`/profils-candidature/${encodeURIComponent(nom)}`);
      const etatLu = await appeler<EtatProfil>(`/profils-candidature/${encodeURIComponent(nom)}/etat`).catch(() => SANS_ETAT);
      setOrigine(JSON.parse(lu.contenu));
      setEtat(etatLu);
      setChoisi(nom);
    } catch (e) {
      dire(message(e), true);
    }
  }, [dire]);

  // Le profil demandé par l'adresse, sinon le premier
  useEffect(() => {
    let vivant = true;
    relireListe().then((liste) => {
      if (!vivant) return;
      const voulu = fiche ? nomFichier(fiche) : '';
      if (voulu && !liste.some((p) => p.nom === voulu)) dire(`${voulu} : introuvable.`, true);
      const nom = liste.some((p) => p.nom === voulu) ? voulu : liste[0]?.nom;
      if (nom) void ouvrirProfil(nom);
    }).catch((e) => vivant && dire(message(e), true));
    return () => {
      vivant = false;
    };
  }, [fiche, relireListe, ouvrirProfil, dire]);

  // Échap ferme la confirmation, sinon le panneau
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (confirmation) setConfirmation(null);
      else if (onglet) fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [confirmation, onglet, fermer]);

  const enregistrer = async () => {
    setOccupe(true);
    try {
      const r = await appeler<{ workflows: number }>(`/profils-candidature/${encodeURIComponent(choisi)}`,
        { methode: 'PUT', corps: { contenu: JSON.stringify(editeur.lire(), null, 2) } });
      // Le changement se voit dans le workflow des sites : les réponses qu'il remet en cause seront refaites
      dire(r.workflows ? `${choisi} enregistré — ${r.workflows} réponse(s) du workflow des sites marquée(s) à refaire ou rétablie(s).` : `${choisi} enregistré.`);
      await relireListe();
      await ouvrirProfil(choisi);
    } catch (e) {
      dire(`Enregistrement refusé : ${message(e)}`, true);
    }
    setOccupe(false);
  };

  const supprimer = async () => {
    setOccupe(true);
    try {
      await appeler(`/profils-candidature/${encodeURIComponent(choisi)}`, { methode: 'DELETE' });
      dire(`${choisi} supprimé.`);
      setConfirmation(null);
      const liste = await relireListe();
      if (liste[0]) await ouvrirProfil(liste[0].nom);
      else {
        setChoisi('');
        setOrigine({});
      }
    } catch (e) {
      dire(message(e), true);
    }
    setOccupe(false);
  };

  // Une copie du profil enregistré, à son propre titre et à son propre identifiant : le serveur refuse un titre déjà pris
  const dupliquer = async () => {
    if (!nomCopie.trim()) return dire('Donnez un nom à la copie.', true);
    setOccupe(true);
    try {
      const copie = await appeler<ProfilDispo & { workflows: number }>(`/profils-candidature/${encodeURIComponent(choisi)}/dupliquer`,
        { methode: 'POST', corps: { nom: nomCopie.trim() } });
      dire(`${copie.nom} créé depuis ${choisi}${copie.workflows ? ` — ${copie.workflows} réponse(s) du workflow des sites reprise(s)` : ''}.`);
      setNomCopie('');
      setConfirmation(null);
      await relireListe();
      await ouvrirProfil(copie.nom);
    } catch (e) {
      dire(message(e), true);
    }
    setOccupe(false);
  };

  // Une donnée que JADE avait dû déduire ou inventer, rangée dans le profil : il se rouvre à jour
  const completer = async (cle: string, valeur: string) => {
    if (!valeur) {
      dire('Donnez la valeur à garder.', true);
      return false;
    }
    try {
      await appeler(`/profils-candidature/${encodeURIComponent(choisi)}/donnee`, { methode: 'POST', corps: { cle, valeur } });
      dire(`${libelleDonnee(cle, schema)} rangé dans ${choisi}.`);
      await relireListe();
      await ouvrirProfil(choisi);
      return true;
    } catch (e) {
      dire(message(e), true);
      return false;
    }
  };

  const nouveau = useNouveau({ schema, dire, apres: async (nom) => {
    await relireListe();
    await ouvrirProfil(nom);
  } });
  const nouveauChamp = useNouveauChamp({ admin, champ, libelle, schema, dire, apres: async () => {
    await relireListe();
    if (choisi) await ouvrirProfil(choisi);
  } });

  const onglets: Onglet[] = [
    { cle: 'nouveau', titre: 'Nouveau profil', label: 'Nouveau profil de candidature', corps: nouveau.corps, pied: nouveau.pied },
    ...(admin ? [{ cle: 'champ', titre: 'Nouveau champ', label: 'Ajouter un champ au profil', admin: true, corps: nouveauChamp.corps, pied: nouveauChamp.pied }] : []),
  ];
  const titre = titreProfil(choisi);
  const aCompleter = Object.entries(incomplets);

  return (
    <>
      <Fenetre id="profils" className={`profils-page${onglet ? ' resserre' : ''}`} titrePrise="Glisser pour détacher les profils">
        {aCompleter.length > 0 && !bandeauFerme && (
          <div className="bandeau" role="alert" aria-label="Profil incomplet : aucune candidature ne part">
            <div className="f-corps">
              <p className="texte-f">{aCompleter.length === 1 ? 'Un profil est incomplet : aucune candidature ne part avec lui.'
                : `${aCompleter.length} profils sont incomplets : aucune candidature ne part avec eux.`}</p>
              <ul className="liste-f">{aCompleter.map(([nom, manque]) => <li key={nom}><strong>{titreProfil(nom)}</strong><span className="d">{manque.map((m) => m.libelle).join(', ')}</span></li>)}</ul>
              <p className="aide-champ">La veille continue de récolter ses offres ; elles partiront une fois le profil complété.</p>
            </div>
            <footer className="f-pied">
              <button type="button" className="action" onClick={() => setBandeauFerme(true)}>Fermer</button>
              {aCompleter.slice(0, 2).map(([nom]) => (
                <button key={nom} type="button" className="action plein" onClick={() => ouvrirProfil(nom)}>Compléter {titreProfil(nom)}{ico(ICONES.fleche)}</button>
              ))}
            </footer>
          </div>
        )}
        <div className="outils">
          <p className="titre-page"><span className="etiquette">Profils de candidature</span><span className="compteur">{profils?.length ?? ''}</span></p>
          <span className="espace" />
          {choisi && (
            <div className="actions" role="group" aria-label="Actions du profil">
              <button type="button" className="action rouge" title="Supprimer le profil" onClick={() => setConfirmation('supprimer')}>{ico(ICONES.supprimer)}<span className="txt">Supprimer le profil</span></button>
              <button type="button" className="action" title="Une copie à son propre nom et à son propre identifiant, réponses du workflow des sites comprises."
                onClick={() => setConfirmation('dupliquer')}>{ico(ICONES.dupliquer)}<span className="txt">Dupliquer</span></button>
              <button type="button" className="action plein" disabled={occupe} onClick={enregistrer}><span className="txt">Enregistrer</span>{ico(ICONES.fleche)}</button>
            </div>
          )}
        </div>
        {confirmation === 'supprimer' && (
          <Confirmer question={`Supprimer ${titre} ?`} detail="Le profil est effacé ; le CV qui en sortait ne sera plus fabriqué." action="Supprimer"
            occupe={occupe} onAnnuler={() => setConfirmation(null)} onConfirmer={supprimer} />
        )}
        {confirmation === 'dupliquer' && (
          <div className="confirmer copie" role="dialog" aria-label={`Dupliquer ${titre}`}>
            <p title="La copie part du profil enregistré, sous un nom neuf ; les réponses apprises des sites la suivent."><b>Dupliquer {titre}</b> Les réponses apprises des sites la suivent.</p>
            <label htmlFor="dup-nom" className="lib-champ">Nom de la copie</label>
            <input id="dup-nom" className="saisie" type="text" placeholder="Dev" value={nomCopie} autoFocus onChange={(e) => setNomCopie(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !occupe && dupliquer()} />
            <button type="button" className="action" onClick={() => setConfirmation(null)}>Annuler</button>
            <button type="button" className="action plein" disabled={occupe} onClick={dupliquer}>Dupliquer{ico(ICONES.fleche)}</button>
          </div>
        )}
        <div className="corps-p">
          <div className="profils" aria-label="Profils de candidature">
            {profils?.map((p) => (
              <button key={p.nom} type="button" className={`choix profil${p.nom === choisi ? ' actif' : ''}`} title={p.nom}
                aria-current={p.nom === choisi} onClick={() => {
                  setConfirmation(null);
                  void ouvrirProfil(p.nom);
                }}>
                <span className="l1"><span className="nom-p">{titreProfil(p.nom)}</span>{incomplets[p.nom] && <span className="eo ech">non exploitable</span>}</span>
                <span className="chemin">{p.nom}</span>
              </button>
            ))}
            <button type="button" className={`profil neuf${onglet === 'nouveau' ? ' allume' : ''}`} title="Créer un profil de candidature" onClick={() => ouvrir('nouveau')}>
              Nouveau profil{ico(ICONES.plus)}
            </button>
          </div>
          {choisi ? (
            <EditeurProfil key={choisi} e={editeur} nom={choisi} etat={etat} completer={completer} ouvertes={['identite', 'presentation']} prefixe="ed" />
          ) : (
            <section className="editeur vide">
              <p className="texte-f">{profils?.length === 0 ? <><strong>Aucun profil.</strong> Le premier sert à tout : sans lui, ni CV ni candidature.</> : 'Lecture des profils…'}</p>
            </section>
          )}
        </div>
        {avis && <p className={`avis${avis.erreur ? ' erreur' : ''}`} role={avis.erreur ? 'alert' : 'status'} onClick={() => setAvis(null)}>{avis.texte}</p>}
      </Fenetre>
      <Panneau onglets={onglets} />
    </>
  );
}

// Un profil neuf n'existe qu'à l'enregistrement : tant qu'il n'a pas de nom il n'y a rien à nommer, et une saisie abandonnée ne laisse rien derrière elle
function useNouveau({ schema, dire, apres }: { schema: ChampSchema[]; dire: Dire; apres: (nom: string) => Promise<void> }) {
  const { fermer } = usePanneau();
  const [origine, setOrigine] = useState(neuve);
  const [nom, setNom] = useState('');
  const [occupe, setOccupe] = useState(false);
  const editeur = useEditeur(origine, schema);
  const vider = () => {
    setOrigine(neuve());
    setNom('');
  };
  const creer = async () => {
    if (!nom.trim()) return dire('Donnez un nom au profil.', true);
    setOccupe(true);
    try {
      // La création seule sait attribuer l'identifiant qui rend le nom unique ; la saisie remplace aussitôt le squelette
      const cree = await appeler<ProfilDispo>('/profils-candidature', { methode: 'POST', corps: { nom: nom.trim() } });
      await appeler(`/profils-candidature/${encodeURIComponent(cree.nom)}`, { methode: 'PUT', corps: { contenu: JSON.stringify(editeur.lire(), null, 2) } });
      dire(`${cree.nom} créé.`);
      vider();
      fermer();
      await apres(cree.nom);
    } catch (e) {
      dire(message(e), true);
    }
    setOccupe(false);
  };
  return {
    corps: <EditeurProfil key={editeur.saisie.gen} e={editeur} nom="" nomNeuf={nom} setNomNeuf={setNom} etat={SANS_ETAT} ouvertes={['identite']} prefixe="neuf" />,
    pied: (
      <>
        <button type="button" className="action" onClick={() => {
          vider();
          fermer();
        }}>Annuler</button>
        <button type="button" className="action plein" disabled={occupe} onClick={creer}>Créer le profil{ico(ICONES.fleche)}</button>
      </>
    ),
  };
}

// Le champ du profil de tous qu'un admin crée ou rend obligatoire, comme Workflows · Vérification le proposait ; ?champ=<clé>&libelle=… le préremplit
function useNouveauChamp({ admin, champ, libelle, schema, dire, apres }: {
  admin: boolean; champ: string | null; libelle: string | null; schema: ChampSchema[]; dire: Dire; apres: () => Promise<void>;
}) {
  const { onglet, fermer } = usePanneau();
  const vierge = { cle: '', libelle: '', section: 'identite', type: 'text', choix: '', obligatoire: true };
  const [f, setF] = useState({ ...vierge, cle: champ ?? '', libelle: libelle ?? '' });
  const [sites, setSites] = useState<string[]>([]);
  const [occupe, setOccupe] = useState(false);
  // Une donnée demandée par les formulaires donne son libellé et les sites qui l'ont demandée
  useEffect(() => {
    if (!admin || onglet !== 'champ' || !f.cle.trim()) return setSites([]);
    let vivant = true;
    appeler<{ donnees: Demandee[] }>('/donnees-demandees').then(({ donnees }) => {
      if (!vivant) return;
      const d = donnees.find((x) => x.cle === f.cle.trim());
      setSites(d?.sites ?? []);
      const vu = d?.libelles?.[0];
      if (vu) setF((v) => (v.libelle ? v : { ...v, libelle: vu }));
    }).catch(() => vivant && setSites([]));
    return () => {
      vivant = false;
    };
  }, [admin, onglet, f.cle]);
  const valider = async () => {
    setOccupe(true);
    try {
      const fait = await appeler<{ libelle: string }>('/schema-profil', { methode: 'POST', corps: {
        cle: f.cle.trim(), libelle: f.libelle.trim(), section: f.section, type: f.type, obligatoire: f.obligatoire,
        choix: f.choix.split(',').map((c) => c.trim()).filter(Boolean) } });
      dire(`« ${fait.libelle} » ajouté au profil de tous.`);
      setF(vierge);
      fermer();
      await apres();
    } catch (e) {
      dire(message(e), true);
    }
    setOccupe(false);
  };
  const poser = (cle: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [cle]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
  const entree = (e: React.KeyboardEvent) => e.key === 'Enter' && !occupe && valider();
  return {
    corps: (
      <div className="champ-profil">
        <p className="texte-f">Une clé déjà au profil le rend obligatoire ; une nouvelle l&apos;y ajoute pour tous.</p>
        <div className="grille-2">
          <div className="champ"><label htmlFor="cp-cle">Clé</label>
            <input id="cp-cle" className="saisie" type="text" list="cp-cles" autoComplete="off" value={f.cle} onChange={poser('cle')} onKeyDown={entree} />
            <datalist id="cp-cles">{schema.map((c) => <option key={c.cle} value={c.cle}>{c.libelle}</option>)}</datalist>
          </div>
          <div className="champ"><label htmlFor="cp-lib">Libellé</label><input id="cp-lib" className="saisie" type="text" value={f.libelle} onChange={poser('libelle')} onKeyDown={entree} /></div>
        </div>
        <div className="grille-2">
          <div className="champ"><label htmlFor="cp-sec">Section</label>
            <select id="cp-sec" className="saisie" value={f.section} onChange={poser('section')}>{Object.entries(SECTIONS_DE_CHAMP).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
          </div>
          <div className="champ"><label htmlFor="cp-forme">Forme</label>
            <select id="cp-forme" className="saisie" value={f.type} onChange={poser('type')}>{Object.entries(FORMES_CHAMP).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
          </div>
        </div>
        <div className="champ"><label htmlFor="cp-choix">Choix</label>
          <input id="cp-choix" className="saisie" type="text" value={f.choix} onChange={poser('choix')} onKeyDown={entree} />
          <p className="aide-champ">Séparés par des virgules.{sites.length > 0 && ` Demandée par ${sites.join(', ')}, depuis Workflows · Vérification.`}</p>
        </div>
        <label className="inter">Obligatoire<input type="checkbox" checked={f.obligatoire} onChange={poser('obligatoire')} /></label>
      </div>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={fermer}>Annuler</button>
        <button type="button" className="action plein" disabled={occupe} onClick={valider}>Valider{ico(ICONES.fleche)}</button>
      </>
    ),
  };
}
