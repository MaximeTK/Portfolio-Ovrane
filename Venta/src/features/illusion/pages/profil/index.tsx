'use client';

import './profil.css';
import { useCallback, useEffect, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, Panneau, type Onglet } from '../../dock/Panneau';

import type { ProprietesPage } from '../liste';
import { libelleDonnee, titreProfil, type ChampSchema } from './champs';
import { EditeurProfil, useEditeur, type EtatProfil, type Profil } from './editeur';
import { useUIStore } from '@/lib/uiStore';
import { useEchap, useGeste } from '../commun';
import { Action } from '../../elements/Action';
import { ICONES } from '../../elements/icones';
import { useAvis, type Dire } from '../../elements/Avis';
import { message, nomFichier } from '../../elements/format';
import { CHAMP_VIERGE, ChampsDuProfil, champVersEnvoi, useFormChamp } from './FormChampProfil';
import { PageDock } from '../../activite/PageDock';

type ProfilDispo = { nom: string; chemin: string };
type Manque = { cle: string; libelle: string };
type Demandee = { cle: string; libelles?: string[]; sites?: string[] };

const SANS_ETAT: EtatProfil = { manquants: [], a_completer: [] };
// Le constructeur refuse un profil sans expérience : la carte le dit
const neuve = (): Profil => ({ experiences: [{}] });

export default function PageProfil({ compte, recherche }: ProprietesPage) {
  const params = new URLSearchParams(recherche);
  const depart = compte.admin && params.get('champ') !== null ? 'champ' : params.get('nouveau') ? 'nouveau' : null;
  return (
    <PageDock id="profil" principal="profils" panneau={depart}
      fenetres={{ profils: { mini: [520, 300], pref: [760, 420], flot: [900, 600] }, panneau: { flot: [480, 640] } }}>
      <Profils admin={compte.admin} depart={depart} fiche={params.get('fiche')} champ={params.get('champ')} libelle={params.get('libelle')} />
    </PageDock>
  );
}

function Profils({ admin, depart, fiche, champ, libelle }: { admin: boolean; depart: string | null; fiche: string | null; champ: string | null; libelle: string | null }) {
  const { onglet, ouvrir, fermer } = usePanneau();
  // Un lien vers un panneau l'ouvre aussi sur une section déjà visitée
  useEffect(() => {
    if (depart) ouvrir(depart);
  }, [depart, ouvrir]);
  // Profils lus et profil ouvert gardés d'une visite à l'autre
  const [profils, setProfils] = useState(() => repris<ProfilDispo[] | null>('profil:profils', null));
  const [incomplets, setIncomplets] = useState(() => repris<Record<string, Manque[]>>('profil:incomplets', {}));
  const [schema, setSchema] = useState(() => repris<ChampSchema[]>('profil:schema', []));
  const [choisi, setChoisi] = useState(() => repris('profil:choisi', ''));
  const [origine, setOrigine] = useState(() => repris<Profil>('profil:origine', {}));
  const [etat, setEtat] = useState(() => repris<EtatProfil>('profil:etat', SANS_ETAT));
  useGarder('profil', { profils, incomplets, schema, choisi, origine, etat });
  const { dire, vue } = useAvis('avis', true);
  const [confirmation, setConfirmation] = useState<'supprimer' | 'dupliquer' | null>(null);
  const [nomCopie, setNomCopie] = useState('');
  const [bandeauFerme, setBandeauFerme] = useState(false);
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const editeur = useEditeur(origine, schema);

  const relireListe = useCallback(async () => {
    const [liste, inc, sch] = await Promise.all([
      appeler<ProfilDispo[]>('/profils-candidature'),
      appeler<{ profils: Record<string, Manque[]> }>('/profils-incomplets').catch(() => ({ profils: {} })),
      // Sans base partagée ni manque à dire, l'éditeur s'ouvre comme avant
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

  // Le profil demandé par l'adresse, sinon l'ouvert gardé, sinon le premier
  useEffect(() => {
    let vivant = true;
    relireListe().then((liste) => {
      if (!vivant) return;
      const voulu = fiche ? nomFichier(fiche) : '';
      if (voulu && !liste.some((p) => p.nom === voulu)) dire(`${voulu} : introuvable.`, true);
      const nom = [voulu, repris('profil:choisi', '')].find((n) => n && liste.some((p) => p.nom === n)) ?? liste[0]?.nom;
      if (nom) void ouvrirProfil(nom);
    }).catch((e) => vivant && dire(message(e), true));
    return () => {
      vivant = false;
    };
  }, [fiche, relireListe, ouvrirProfil, dire]);

  // Échap ferme la confirmation, sinon le panneau
  useEchap(() => {
    if (confirmation) setConfirmation(null);
    else if (onglet) fermer();
  });

  // Son préfixe reste ici : les trois gestes partagent un seul `echec`
  const enregistrer = () => geste(async () => {
    try {
      const r = await appeler<{ workflows: number }>(`/profils-candidature/${encodeURIComponent(choisi)}`,
        { methode: 'PUT', corps: { contenu: JSON.stringify(editeur.lire(), null, 2) } });
      // Les réponses que le changement remet en cause seront refaites
      dire(r.workflows ? `${choisi} enregistré — ${r.workflows} réponse(s) du workflow des sites marquée(s) à refaire ou rétablie(s).` : `${choisi} enregistré.`);
      await relireListe();
      await ouvrirProfil(choisi);
    } catch (e) {
      dire(`Enregistrement refusé : ${message(e)}`, true);
    }
  });

  const supprimer = () => geste(async () => {
    await appeler(`/profils-candidature/${encodeURIComponent(choisi)}`, { methode: 'DELETE' });
    dire(`${choisi} supprimé.`);
    setConfirmation(null);
    const liste = await relireListe();
    if (liste[0]) await ouvrirProfil(liste[0].nom);
    else {
      setChoisi('');
      setOrigine({});
    }
  });

  // Copie à son propre titre et identifiant : le serveur refuse un titre pris
  const dupliquer = () => {
    if (!nomCopie.trim()) return dire('Donnez un nom à la copie.', true);
    return geste(async () => {
      const copie = await appeler<ProfilDispo & { workflows: number }>(`/profils-candidature/${encodeURIComponent(choisi)}/dupliquer`,
        { methode: 'POST', corps: { nom: nomCopie.trim() } });
      dire(`${copie.nom} créé depuis ${choisi}${copie.workflows ? ` — ${copie.workflows} réponse(s) du workflow des sites reprise(s)` : ''}.`);
      setNomCopie('');
      setConfirmation(null);
      await relireListe();
      await ouvrirProfil(copie.nom);
    });
  };

  // Donnée déduite par JADE rangée dans le profil, qui se rouvre à jour
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
              <Action onClick={() => setBandeauFerme(true)}>Fermer</Action>
              {aCompleter.slice(0, 2).map(([nom]) => (
                <Action iconeApres={ICONES.fleche} plein key={nom} onClick={() => ouvrirProfil(nom)}>Compléter {titreProfil(nom)}</Action>
              ))}
            </footer>
          </div>
        )}
        <div className="outils">
          <p className="titre-page"><span className="etiquette">Profils de candidature</span><span className="compteur">{profils?.length ?? ''}</span></p>
          <span className="espace" />
          <Action icone={ICONES.compte} txt title="Pseudo, e-mail et déconnexion" onClick={() => useUIStore.getState().setPage('connexion')}>Compte</Action>
          {choisi && (
            <div className="actions" role="group" aria-label="Actions du profil">
              <Action icone={ICONES.supprimer} txt rouge title="Supprimer le profil" onClick={() => setConfirmation('supprimer')}>Supprimer le profil</Action>
              <Action icone={ICONES.dupliquer} txt title="Une copie à son propre nom et à son propre identifiant, réponses du workflow des sites comprises." onClick={() => setConfirmation('dupliquer')}>Dupliquer</Action>
              <Action iconeApres={ICONES.fleche} txt plein disabled={occupe} onClick={enregistrer}>Enregistrer</Action>
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
            <Action onClick={() => setConfirmation(null)}>Annuler</Action>
            <Action iconeApres={ICONES.fleche} plein disabled={occupe} onClick={dupliquer}>Dupliquer</Action>
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
              Nouveau profil<span className="ico">{ICONES.plus}</span>
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
        {vue}
      </Fenetre>
      <Panneau onglets={onglets} />
    </>
  );
}

// Un profil neuf n'existe qu'à l'enregistrement : l'abandon ne laisse rien
function useNouveau({ schema, dire, apres }: { schema: ChampSchema[]; dire: Dire; apres: (nom: string) => Promise<void> }) {
  const { fermer } = usePanneau();
  const [origine, setOrigine] = useState(neuve);
  const [nom, setNom] = useState('');
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const editeur = useEditeur(origine, schema);
  const vider = () => {
    setOrigine(neuve());
    setNom('');
  };
  const creer = () => {
    if (!nom.trim()) return dire('Donnez un nom au profil.', true);
    return geste(async () => {
      // Seule la création attribue l'identifiant qui rend le nom unique
      const cree = await appeler<ProfilDispo>('/profils-candidature', { methode: 'POST', corps: { nom: nom.trim() } });
      await appeler(`/profils-candidature/${encodeURIComponent(cree.nom)}`, { methode: 'PUT', corps: { contenu: JSON.stringify(editeur.lire(), null, 2) } });
      dire(`${cree.nom} créé.`);
      vider();
      fermer();
      await apres(cree.nom);
    });
  };
  return {
    corps: <EditeurProfil key={editeur.saisie.gen} e={editeur} nom="" nomNeuf={nom} setNomNeuf={setNom} etat={SANS_ETAT} ouvertes={['identite']} prefixe="neuf" />,
    pied: (
      <>
        <Action onClick={() => {
          vider();
          fermer();
        }}>Annuler</Action>
        <Action iconeApres={ICONES.fleche} plein disabled={occupe} onClick={creer}>Créer le profil</Action>
      </>
    ),
  };
}

// Champ créé ou rendu obligatoire par un admin ; ?champ=<clé> le préremplit
function useNouveauChamp({ admin, champ, libelle, schema, dire, apres }: {
  admin: boolean; champ: string | null; libelle: string | null; schema: ChampSchema[]; dire: Dire; apres: () => Promise<void>;
}) {
  const { onglet, fermer } = usePanneau();
  const { f, setF, poser } = useFormChamp(() => ({ ...CHAMP_VIERGE, cle: champ ?? '', libelle: libelle ?? '' }));
  const [sites, setSites] = useState<string[]>([]);
  const { occupe, geste } = useGeste((t) => dire(t, true));
  // Une donnée demandée par les formulaires donne son libellé et ses sites
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
  const valider = () => geste(async () => {
    const fait = await appeler<{ libelle: string }>('/schema-profil', { methode: 'POST', corps: champVersEnvoi(f) });
    dire(`« ${fait.libelle} » ajouté au profil de tous.`);
    setF(CHAMP_VIERGE);
    fermer();
    await apres();
  });
  const entree = (e: React.KeyboardEvent) => e.key === 'Enter' && !occupe && valider();
  return {
    corps: (
      <div className="champ-profil">
        <p className="texte-f">Une clé déjà au profil le rend obligatoire ; une nouvelle l&apos;y ajoute pour tous.</p>
        <ChampsDuProfil f={f} poser={poser} entree={entree} cles={schema} aideChoix={<>Séparés par des virgules.{sites.length > 0 && ` Demandée par ${sites.join(', ')}, depuis Workflows · Vérification.`}</>} />
      </div>
    ),
    pied: (
      <>
        <Action onClick={fermer}>Annuler</Action>
        <Action iconeApres={ICONES.fleche} plein disabled={occupe} onClick={valider}>Valider</Action>
      </>
    ),
  };
}
