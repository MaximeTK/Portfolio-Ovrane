'use client';

import './parametres-serveur.css';
import { useCallback, useEffect, useId, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';

import { Fenetre, usePanneau, useVues } from '../../dock/Dock';
import { AuPied, Confirmer, Panneau, type Onglet } from '../../dock/Panneau';
import type { ProprietesPage } from '../liste';
import {
  CorpsEffacer, FormModele, MenuFournisseur, NEUF, Voyant, nomCourt, totalApercu, versBrouillon,
  type Apercu, type Brouillon, type Essai, type Fournisseur, type Modele,
} from './panneaux';
import { useEchap } from '../commun';
import { useFormParametres } from '../reglages/useFormParametres';
import { Action } from '../../elements/Action';
import { Case, ouvrable, useCoches } from '../../elements/Case';
import { Champ, ChampListe } from '../../elements/Champ';
import { ICONES } from '../../elements/icones';
import { ActionSupprimer } from '../../elements/Action';
import { SaisieSecrete } from '../../elements/Champ';
import { useAvis } from '../../elements/Avis';
import { TitreGroupe } from '../../elements/Menu';
import { avecAbsent, heure, message, optionsModele } from '../../elements/format';
import { ActionOnglet, CorpsGroupes, PiedGroupe, Rubrique, RubriqueOnglet } from '../../elements/Groupes';
import { PageDock } from '../../activite/PageDock';

type Parametres = Record<string, unknown> & { modeles: Modele[]; fournisseurs: Record<string, Fournisseur> };
type Champ = { cle: string; libelle: string; sorte: 'nombre' | 'texte' | 'secret' | 'choix'; aide?: string; choix?: string[]; min?: number };
type Groupe = { cle: string; titre: string; aide: string; champs: Champ[] };

// Groupes repris de l'ancien dashboard ; Réinitialiser ouvre son onglet.
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
// Modèle de chaque brique : réglage, libellé et sens du choix vide.
const BRIQUES: [string, string, string][] = [
  ['audit_modele', 'Audit', 'Aucun'], ['candidature_modele', 'Candidature', 'Aucun'], ['jade_modele', 'JADE', 'Celui de la candidature'],
  ['constructeur_modele', 'Lettre', 'Aucun : le gabarit'], ['mail_modele', 'Mail', 'Aucun'], ['lapis_modele', 'LAPIS', 'Celui des mails'],
  ['ruby_modele', 'RUBY (analyse)', 'Celui des mails'], ['veille_tri_modele', 'Étiquettes', 'Celui des mails'],
];
const CHAMPS: Champ[] = [...GROUPES.flatMap((g) => g.champs), ...BRIQUES.map(([cle, libelle]): Champ => ({ cle, libelle, sorte: 'texte' }))];

const decimal = (t: string) => parseFloat(t.replace(',', '.')) || 0;
// Un modèle tel qu'il part : sans clé, celle du coffre reste ; vide, effacée.
const sansCle = ({ cle_api: _, ...m }: Modele) => m;
const versEnvoi = (b: Brouillon) => ({
  nom: b.nom.trim(), fournisseur: b.fournisseur, modele: b.modele.trim(), base_url: b.base_url.trim(), reserve: b.reserve,
  reglages: Object.fromEntries(Object.entries(b.reglages).filter(([, v]) => v)), max_tokens: parseInt(b.max_tokens, 10) || 0,
  prix_entree: decimal(b.prix_entree), prix_cache: decimal(b.prix_cache), prix_ecriture: decimal(b.prix_ecriture), prix_sortie: decimal(b.prix_sortie),
  ...(b.cle.trim() || b.effacerCle ? { cle_api: b.cle.trim() } : {}),
});




export default function PageParametresServeur(_: ProprietesPage) {
  return (
    <PageDock id="parametres-serveur" principal="serveur" panneau={null}
      fenetres={{ serveur: { mini: [560, 420], pref: [780, 480], flot: [920, 620] }, panneau: { flot: [460, 620] } }}>
      <Serveur />
    </PageDock>
  );
}

function Serveur() {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const { fermerVue } = useVues();
  // Paramètres, groupe, filtre et derniers essais gardés d'une visite à l'autre.
  const [erreurLecture, setErreurLecture] = useState('');
  const { lus, setLus, valeurs, setValeurs, poser, changes, corps, secret, reprendre } = useFormParametres({
    depart: repris<Parametres | null>('parametres-serveur:lus', null), champs: CHAMPS, surErreur: setErreurLecture,
  });
  const [groupe, setGroupe] = useState(() => repris('parametres-serveur:groupe', 'modeles'));
  const [filtre, setFiltre] = useState(() => repris('parametres-serveur:filtre', ''));
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [essais, setEssais] = useState(() => repris<Record<string, Essai>>('parametres-serveur:essais', {}));
  // Un essai en cours ne se garde pas : sa réponse viendrait trop tard.
  useGarder('parametres-serveur', { lus, groupe, filtre, essais: Object.fromEntries(Object.entries(essais).filter(([, e]) => e.etat !== 'encours')) });
  // Change à chaque ajout entamé : le formulaire d'ajout repart vierge
  const [ajout, setAjout] = useState(0);
  const [confirmation, setConfirmation] = useState(false);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [erreurApercu, setErreurApercu] = useState('');
  const [enregistre, setEnregistre] = useState('');
  const { dire, vue } = useAvis('avis', true);
  const [occupe, setOccupe] = useState(false);

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
  useEchap(() => {
    if (confirmation) setConfirmation(false);
    else if (onglet) fermer();
  });

  const enregistrer = async () => {
    if (!changes.length || occupe) return;
    setOccupe(true);
    try {
      reprendre(await appeler<Parametres>('/parametres', { methode: 'PUT', corps: corps() }));
      setEnregistre(heure(new Date()));
      dire('Paramètres du serveur enregistrés.');
    } catch (e) {
      dire(`Enregistrement refusé : ${message(e)}`, true);
    }
    setOccupe(false);
  };

  // Le catalogue part entier ; les autres changements restent à enregistrer.
  const enregistrerModeles = async (modeles: Record<string, unknown>[], texte: string) => {
    setOccupe(true);
    try {
      const r = await appeler<Parametres>('/parametres', { methode: 'PUT', corps: { modeles } });
      setLus(r);
      setValeurs((v) => ({ ...r, ...Object.fromEntries(changes.filter((c) => c.sorte !== 'secret').map((c) => [c.cle, v[c.cle]])) }));
      setEnregistre(heure(new Date()));
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

  // Appel minuscule avec la saisie ; seul un modèle à outils a sa place ici.
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
  const { toutes, cocher } = useCoches(selection, setSelection, visibles.map((m) => m.nom));
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
        <Action onClick={fermer}>Annuler</Action>
        <Action icone={ICONES.vider} rouge disabled={occupe} onClick={toutEffacer}>Tout effacer</Action>
      </>
    ) : <Action onClick={fermer}>Fermer</Action>,
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
  const controle = (c: Champ) => (
    <Champ pour={`ps-${c.cle}`} libelle={c.libelle} key={c.cle}>
      {c.sorte === 'secret' ? <SaisieSecrete id={`ps-${c.cle}`} pose={!!lus?.[c.cle]} {...secret(c.cle)} /> : c.sorte === 'choix' ? (
        <select id={`ps-${c.cle}`} className="saisie" value={String(valeurs[c.cle] ?? '')} onChange={(e) => poser(c.cle, e.target.value)}>
          {(c.choix ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input id={`ps-${c.cle}`} className="saisie" type={c.sorte === 'nombre' ? 'number' : 'text'} min={c.min} inputMode={c.sorte === 'nombre' ? 'numeric' : undefined}
          value={String(valeurs[c.cle] ?? '')} onChange={(e) => poser(c.cle, c.sorte === 'nombre' && e.target.value !== '' ? Number(e.target.value) : e.target.value)} />
      )}
      {c.aide && <p className="aide-champ">{c.aide}</p>}
    </Champ>
  );

  return (
    <>
      <Fenetre id="serveur" className="tableau" aria-label="Paramètres serveur" titrePrise="Glisser pour détacher les paramètres du serveur">
        <div className="outils">
          <TitreGroupe titre={g.titre} />
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
                <ActionSupprimer n={coches.length} title={`Supprimer ${coches.length} modèle(s)`} onClick={() => setConfirmation(true)} />
              )}
              <ActionOnglet cle="ajout" iconeApres={ICONES.plus_pages} plein onClick={ajouter}>
                Ajouter un modèle
              </ActionOnglet>
            </div>
          )}
        </div>
        {confirmation && coches.length > 0 && (
          <Confirmer question={`Supprimer ${coches.length} modèle(s) ?`} occupe={occupe} action="Supprimer" onAnnuler={() => setConfirmation(false)} onConfirmer={supprimer}
            detail={`Leurs clés quittent le coffre.${briquesDe(coches.map((m) => m.nom)).length ? ` Sans modèle ensuite : ${briquesDe(coches.map((m) => m.nom)).join(', ')}.` : ''}`} />
        )}
        <CorpsGroupes nav={<>
            {GROUPES.map((x) => (
              <Rubrique key={x.cle} actif={x.cle === groupe} onClick={() => setGroupe(x.cle)}>{x.titre}</Rubrique>
            ))}
            <RubriqueOnglet cle="effacer" className="danger" aria-haspopup="dialog">Réinitialiser</RubriqueOnglet>
        </>}>
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
                          <th><Case aria-label="Tout sélectionner" checked={toutes} onChange={(e) => setSelection(new Set(e.target.checked ? visibles.map((m) => m.nom) : []))} /></th>
                          <th>Nom</th><th>Fournisseur</th><th>Modèle</th><th>Tokens max</th><th>$/M entrée</th><th title="lu en cache · écrit en cache">$/M cache</th>
                          <th>$/M sortie</th><th>Clé secrète</th><th aria-label="Dernier test" /><th aria-label="Tester" />
                        </tr>
                      </thead>
                      <tbody>
                        {visibles.map((m) => (
                          <tr key={m.nom} title={`Modifier « ${m.nom} »`} {...ouvrable('modele', m.nom, () => ouvrir('modele', m.nom))}
                            className={`${selection.has(m.nom) ? 'coche' : ''}${onglet === 'modele' && objet === m.nom ? ' ouverte' : ''}`}>
                            <td onClick={(e) => e.stopPropagation()}>
                              <Case aria-label={`Sélectionner ${m.nom}`} checked={selection.has(m.nom)} onChange={(e) => cocher([m.nom], e.target.checked)} />
                            </td>
                            <td><b>{m.nom}</b></td><td className="d">{nomCourt(fournisseurs, m.fournisseur)}</td><td>{m.modele || '—'}</td>
                            <td className="num">{m.max_tokens ? m.max_tokens.toLocaleString('fr-FR') : '—'}</td><td className="num">{m.prix_entree}</td>
                            <td className="num" title="lu en cache · écrit en cache">{`${m.prix_cache} · ${m.prix_ecriture}`}</td><td className="num">{m.prix_sortie}</td>
                            <td className={`d${m.cle_api ? '' : ' vide'}`}>{m.cle_api ? 'enregistrée' : 'non renseignée'}</td>
                            <td><Voyant essai={essais[m.nom]} /></td>
                            <td><Action disabled={essais[m.nom]?.etat === 'encours'} aria-label={`Tester ${m.nom}`} title="Un appel minuscule avec ce qui est saisi : seul un modèle qui appelle les outils a sa place dans Illusion." onClick={(e) => {
                                e.stopPropagation();
                                void tester(sansCle(m), (essai) => setEssais((x) => ({ ...x, [m.nom]: essai })));
                              }}>Tester</Action></td>
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
                        const options = avecAbsent(optionsModele(modeles, vide, false), v);
                        return (
                          <ChampListe id={`ps-${cle}`} libelle={libelle} key={cle} value={v} onChange={(e) => poser(cle, e.target.value)}>
                              {options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
                            </ChampListe>
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
            <PiedGroupe libelles={changes.map((c) => c.libelle)} repos={enregistre ? `Enregistré à ${enregistre}` : ''} type="submit" disabled={!changes.length || occupe} />
          </form>
        </CorpsGroupes>
        {vue}
      </Fenetre>
      <Panneau elements={elements} onglets={onglets} />
    </>
  );
}

type ProprietesEdition = {
  ancien: string | null; depart: Brouillon; essai?: Essai; modeles: Modele[]; fournisseurs: Record<string, Fournisseur>; occupe: boolean;
  enregistrer: (modeles: Record<string, unknown>[], texte: string) => Promise<boolean>; tester: (saisi: Record<string, unknown>, poser: (e: Essai) => void) => Promise<void>;
};

// Modèle à ajouter (`ancien` nul) ou modifier ; ses boutons vont au pied.
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
          <Action className="gauche tester-f" disabled={essai?.etat === 'encours'} title="Un appel minuscule avec ce qui est saisi : seul un modèle qui appelle les outils a sa place dans Illusion." onClick={() => tester(versEnvoi(brouillon), setEssai)}><Voyant essai={essai} />Tester</Action>
          <Action onClick={fermer}>Annuler</Action>
          <Action iconeApres={ancien === null ? ICONES.plus_pages : ICONES.valider_metriques} plein type="submit" form={id} disabled={occupe}>{ancien === null ? 'Ajouter' : 'Enregistrer'}</Action>
      </AuPied>
    </div>
  );
}
