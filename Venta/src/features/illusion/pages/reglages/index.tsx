'use client';

import './reglages.css';
import { LienIllusion } from '../../partage/LienIllusion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { appeler, televerser } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, MarqueAdmin, Panneau, type Onglet } from '../../dock/Panneau';

import { useSondage } from '../../activite/sondage';
import type { ProprietesPage } from '../liste';
import { FENETRES_REGLAGES, useOngletApparence } from './apparence';
import { FILTRES, TableComptes, lignesDe, ongletTester, useOngletAjout, versEnvoi, type Essai, type Identifiant, type Ligne } from './comptes';
import { useEchap, useGeste } from '../commun';
import { FONDS } from '../documents/commun';
import { egal, useFormParametres } from './useFormParametres';
import { MenuFiltre, TitreGroupe } from '../../elements/Menu';
import { Action } from '../../elements/Action';
import { Champ, Interrupteur, SectionFiche } from '../../elements/Champ';
import { ICONES } from '../../elements/icones';
import { ActionSupprimer } from '../../elements/Action';
import { SaisieSecrete } from '../../elements/Champ';
import { useAvis } from '../../elements/Avis';
import { avecAbsent, message, optionsModele } from '../../elements/format';
import { ActionOnglet, CorpsGroupes, PiedGroupe, Rubrique, RubriqueOnglet } from '../../elements/Groupes';
import { PageDock } from '../../activite/PageDock';

type Parametres = Record<string, unknown> & { modeles: { nom: string; modele?: string }[]; identifiants: Identifiant[] };
type Sorte = 'inter' | 'nombre' | 'texte' | 'liste' | 'secret' | 'choix' | 'modele' | 'texte_long' | 'couleurs';
type Champ = { cle: string; libelle: string; sorte: Sorte; aide?: string; admin?: boolean; choix?: [string, string][]; vide?: string; min?: number; max?: number };
type Section = { titre: string; champs: Champ[]; admin?: boolean; pieces?: boolean };
type Groupe = { cle: string; titre: string; aide?: string; sections?: Section[] };
type Piece = { nom: string; taille: number };
type Confirmation = { sorte: 'sites' } | { sorte: 'piece'; nom: string } | null;

const poids = (o: number) => (o < 1024 ? `${o} o` : `${(o / 1024).toFixed(1).replace('.', ',')} Ko`);

// Réglages du compte par groupe ; « Modèle » et ceux du serveur sont à l'admin.
const GROUPES: Groupe[] = [
  { cle: 'comptes', titre: 'Comptes des plateformes' },
  { cle: 'liens', titre: 'Liens suivis',
    aide: "Les liens LinkedIn, GitHub et portfolio de chaque CV et lettre passent par le portfolio avec un jeton propre à l'offre : le clic d'un recruteur se compte, et le portfolio se présente selon la candidature.",
    sections: [{ titre: 'Liens suivis', champs: [
      { cle: 'liens_suivis', libelle: 'Suivre les liens des CV', sorte: 'inter', aide: "À n'activer qu'une fois Ovrane déployé avec ses routes « redirectgithub » et « redirectportfolio », et la base partagée renseignée. Les CV déjà envoyés gardent leurs liens." },
      { cle: 'ovrane_url', libelle: 'Adresse du portfolio', sorte: 'texte', aide: 'Celle que portent les liens des CV.' },
    ] }] },
  { cle: 'lapis', titre: 'LAPIS',
    aide: "Les posts les plus récents de chaque recherche, lus dans le navigateur piloté et rangés par le modèle, puis, chez les employeurs qu'ils nomment, les personnes aux postes cherchés. Le programme lit et défile seulement : aucune demande de connexion, aucun message.",
    sections: [
      { titre: 'Recherches', champs: [
        { cle: 'lapis_recherches', libelle: 'Recherches de posts', sorte: 'liste', aide: 'Comme les recherches de la veille. Vide : les intitulés cherchés des profils de recherche menés.' },
        { cle: 'lapis_postes', libelle: 'Postes à chercher', sorte: 'liste', aide: 'Tapés un par un dans la page « Personnes » de chaque employeur.' },
      ] },
      { titre: 'Volumes', champs: [
        { cle: 'lapis_posts_par_recherche', libelle: 'Posts par recherche', sorte: 'nombre', min: 0, aide: 'Les plus récents d’abord. LinkedIn surveille les volumes : mieux vaut peu et souvent.' },
        { cle: 'lapis_personnes_par_poste', libelle: 'Personnes par poste', sorte: 'nombre', min: 0 },
        { cle: 'lapis_entreprises_par_passe', libelle: 'Employeurs par passe', sorte: 'nombre', min: 0, aide: 'Pris dans les posts lus ; un employeur fouillé il y a moins de deux semaines attend. 0 : aucun.' },
        { cle: 'lapis_modele', libelle: 'Modèle', sorte: 'modele', admin: true, vide: 'Aucun : celui des mails', aide: 'Celui qui lit les posts : offre, événement ou autre, et l’employeur dont ils parlent.' },
      ] },
    ] },
  { cle: 'appels', titre: 'Appels',
    aide: "Les appels transcrits en direct par AssemblyAI, chaque voix séparée, puis analysés. AssemblyAI facture à la durée de la session ; seul le texte est gardé, jamais l'audio.",
    sections: [{ titre: 'RUBY', champs: [
      { cle: 'ruby_cle', libelle: 'Clé AssemblyAI', sorte: 'secret', aide: 'Sur assemblyai.com : 50 $ offerts à l’inscription.' },
      { cle: 'ruby_modele_parole', libelle: 'Modèle de transcription', sorte: 'choix', choix: [['universal-streaming-multilingual', 'Multilingual · 0,15 $/h'], ['universal-3-6-pro', '3.6 Pro · 0,45 $/h']],
        aide: 'Multilingual : français, anglais, espagnol, allemand, italien, portugais. 3.6 Pro : plus précis sur un haut-parleur de téléphone. Séparer les voix ajoute 0,12 $/h.' },
      { cle: 'ruby_modele', libelle: "Modèle de l'analyse", sorte: 'modele', admin: true, vide: 'Aucun : celui des mails' },
    ] }] },
  { cle: 'candidatures', titre: 'Candidatures',
    aide: "La candidature remplit le formulaire d'une offre dans un navigateur piloté, joint le CV et la lettre, puis soumet. Une offre hors du profil est écartée sans qu'on y postule.",
    sections: [
      { titre: 'Candidatures', champs: [
        { cle: 'candidature_par_lot', libelle: 'Candidatures par lancement', sorte: 'nombre', min: 1, max: 100, aide: 'Chacune ouvre un onglet. Écoute armée, la file se complète toute seule.' },
        { cle: 'candidature_paralleles', libelle: 'Candidatures en même temps', sorte: 'nombre', min: 1, aide: '1 au minimum, pas de maximum : la limite est celle de la machine et du fournisseur.' },
        { cle: 'candidature_timeout_secondes', libelle: 'Timeout (s)', sorte: 'nombre', min: 60 },
        { cle: 'candidature_inscription', libelle: "Créer un compte si l'ATS l'exige", sorte: 'inter', aide: "Coupé, la candidature s'arrête devant l'écran d'inscription : le dossier reste à finir à la main." },
        { cle: 'candidature_rejeu', libelle: 'Rejouer le chemin appris', sorte: 'inter', aide: 'Clics, dépôt et réponses déjà connues partent sans le modèle. Coupé, le modèle pilote tout et rien n’est appris.' },
        { cle: 'creer_fiches', libelle: 'Créer la fiche entreprise', sorte: 'inter', aide: "Une candidature envoyée fabrique la fiche de l'employeur, puis le parser part dessus." },
      ] },
      { titre: 'Serveur', admin: true, champs: [
        { cle: 'candidature_tours', libelle: 'Tours de modèle', sorte: 'nombre', admin: true, min: 1, max: 100, aide: 'Tours de modèle avant abandon sur un formulaire.' },
        { cle: 'guichets', libelle: 'Guichets du serveur', sorte: 'nombre', admin: true, min: 1, aide: 'Candidatures menées en même temps sur le serveur, tous comptes confondus.' },
        { cle: 'candidatures_par_jour', libelle: 'Candidatures par jour et par compte', sorte: 'nombre', admin: true, min: 0, aide: '0 : sans limite.' },
        { cle: 'candidature_modele', libelle: 'Modèle', sorte: 'modele', admin: true, vide: 'Aucun' },
        { cle: 'jade_modele', libelle: 'Modèle de JADE', sorte: 'modele', admin: true, vide: 'Celui de la candidature', aide: "JADE juge l'offre et répond aux questions du formulaire." },
      ] },
    ] },
  { cle: 'documents', titre: 'Documents',
    aide: 'Ce qui vaut pour tous les CV et toutes les lettres de ce compte. Laissé vide, le constructeur décide : le tirage fait que deux CV ne se ressemblent pas.',
    sections: [
      { titre: 'CV', champs: [
        { cle: 'constructeur_fond', libelle: 'Fond imposé', sorte: 'choix', choix: FONDS.map((f): [string, string] => [f, f || 'Aléatoire']), aide: '« Aléatoire » : un tirage différent à chaque CV.' },
        { cle: 'constructeur_palette', libelle: 'Palette imposée', sorte: 'couleurs', aide: "Quatre couleurs au plus. Vide : la palette vient de l'identité de l'entreprise." },
      ] },
      { titre: 'Lettre', pieces: true, champs: [
        { cle: 'constructeur_modele', libelle: 'Modèle', sorte: 'modele', admin: true, vide: 'Aucun : le gabarit', aide: 'Celui qui rédige les lettres.' },
        { cle: 'constructeur_prompt_lettre', libelle: 'Prompt de la lettre', sorte: 'texte_long', aide: "Vide : la lettre est assemblée par le gabarit, qui ne sait pas lire l'annonce." },
        { cle: 'constructeur_notes_lettre', libelle: 'Vos notes (PROJETS)', sorte: 'texte_long', aide: 'Pour chaque projet : le contexte, les choix techniques, les difficultés, les chiffres, les liens vérifiables.' },
      ] },
    ] },
];

export default function PageReglages({ compte }: ProprietesPage) {
  return (
    <PageDock id="reglages" principal="reglages" panneau={null} fenetres={FENETRES_REGLAGES}>
      <Reglages admin={compte.admin} />
    </PageDock>
  );
}

function Reglages({ admin }: { admin: boolean }) {
  const { onglet, ouvrir, fermer } = usePanneau();
  // Réglages, groupe, filtre, tests et pièces gardés d'une visite à l'autre.
  const depart = repris<Parametres | null>('reglages:lus', null);
  const { dire, vue } = useAvis('avis', true);
  const [lignes, setLignes] = useState<Ligne[]>(() => (depart ? lignesDe(depart.identifiants ?? []) : []));
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const surErreur = useCallback((e: string) => {
    if (e) dire(e, true);
  }, [dire]);
  const champsVus = GROUPES.flatMap((g) => (g.sections ?? []).filter((s) => admin || !s.admin).flatMap((s) => s.champs.filter((c) => admin || !c.admin)));
  const { lus, valeurs, poser: poserValeur, changes, corps, secret, reprendre } = useFormParametres({
    depart, champs: champsVus, surErreur,
    surLu: (p) => {
      setLignes(lignesDe(p.identifiants ?? []));
      setSelection(new Set());
    },
  });
  const [groupe, setGroupe] = useState(() => repris('reglages:groupe', 'comptes'));
  const [filtre, setFiltre] = useState(() => repris('reglages:filtre', 'tous'));
  const [essais, setEssais] = useState(() => repris<Record<string, Essai>>('reglages:essais', {}));
  const [testEnCours, setTestEnCours] = useState(() => repris('reglages:testEnCours', ''));
  const [teste, setTeste] = useState(() => repris('reglages:teste', ''));
  const [pieces, setPieces] = useState(() => repris<Piece[] | null>('reglages:pieces', null));
  useGarder('reglages', { lus, groupe, filtre, essais, testEnCours, teste, pieces });
  const [renomme, setRenomme] = useState<{ nom: string; nouveau: string } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const { occupe, geste } = useGeste((t) => dire(`Enregistrement refusé : ${t}`, true));
  const fichiers = useRef<HTMLInputElement>(null);

  // Verdicts des tests suivis toutes les 2 s tant qu'un test tourne.
  const lireTests = useCallback(async () => {
    try {
      const vu = await appeler<{ essais: Record<string, Essai>; occupe: string }>('/vues/reglages/tests');
      setEssais(vu.essais);
      setTestEnCours(vu.occupe);
    } catch {
      setTestEnCours('');
    }
  }, []);
  useEffect(() => {
    void lireTests();
  }, [lireTests]);
  useSondage(lireTests, 2000, testEnCours !== '');

  const tester = async (site: string) => {
    setTeste(site);
    ouvrir('tester');
    try {
      await appeler(`/identifiants/${encodeURIComponent(site)}/tester`, { methode: 'POST' });
    } catch (e) {
      dire(message(e), true);
    }
    await lireTests();
  };

  const lirePieces = useCallback(() => {
    appeler<Piece[]>('/pieces-lettre').then(setPieces).catch((e) => dire(message(e), true));
  }, [dire]);
  useEffect(() => {
    if (groupe === 'documents') lirePieces();
  }, [groupe, lirePieces]);

  // Échap ferme la confirmation, sinon le panneau
  useEchap(() => {
    if (confirmation) setConfirmation(null);
    else if (onglet) fermer();
  });

  const comptesChanges = lus !== null && !egal(versEnvoi(lignes), versEnvoi(lignesDe(lus.identifiants ?? [])));
  const libelles = [...(comptesChanges ? ['Comptes des plateformes'] : []), ...changes.map((c) => c.libelle)];

  const enregistrer = (voulues = lignes) => {
    const envoi = corps();
    if (lus && !egal(versEnvoi(voulues), versEnvoi(lignesDe(lus.identifiants ?? [])))) envoi.identifiants = versEnvoi(voulues);
    if (!Object.keys(envoi).length) return;
    return geste(async () => {
      const r = await appeler<Parametres & { rejeu_bannis?: { ecartees?: number }; rejeu_mails?: number }>('/parametres', { methode: 'PUT', corps: envoi });
      reprendre(r);
      setConfirmation(null);
      // Mots bannis rejoués sur le stock : on le dit, sinon des offres disparaissent.
      const bannis = r.rejeu_bannis?.ecartees ? ` — mots bannis rejoués : ${r.rejeu_bannis.ecartees} offre(s) sortie(s) de la file` : '';
      dire(`Réglages enregistrés${bannis || ' — les lots les reprennent aussitôt'}.`);
    });
  };

  const pieceGeste = async (geste: () => Promise<unknown>, texte: string) => {
    try {
      await geste();
      dire(texte);
    } catch (e) {
      dire(message(e), true);
    }
    lirePieces();
  };
  const renommer = () => {
    if (!renomme) return;
    const { nom, nouveau } = renomme;
    setRenomme(null);
    if (!nouveau.trim() || nouveau.trim() === nom) return;
    void pieceGeste(() => appeler(`/pieces-lettre/${encodeURIComponent(nom)}/renommer`, { methode: 'POST', corps: { nom: nouveau.trim() } }), `${nom} renommé en ${nouveau.trim()}.`);
  };

  const controle = (c: Champ) => {
    const marque = c.admin && <MarqueAdmin />;
    const poser = (v: unknown) => poserValeur(c.cle, v);
    const v = valeurs[c.cle];
    const id = `rg-${c.cle}`;
    if (c.sorte === 'inter') {
      return <Interrupteur key={c.cle} libelle={<>{c.libelle}{marque}</>} title={c.aide} checked={!!v} onChange={(e) => poser(e.target.checked)} />;
    }
    if (c.sorte === 'nombre') {
      return (
        <label key={c.cle} className="reglage-n" title={c.aide}><span>{c.libelle}{marque}</span>
          <input className="saisie" type="number" inputMode="numeric" min={c.min} max={c.max} value={String(v ?? '')} onChange={(e) => poser(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
      );
    }
    let saisie: React.ReactNode;
    if (c.sorte === 'secret') {
      saisie = <SaisieSecrete id={id} pose={!!v} {...secret(c.cle)} />;
    } else if (c.sorte === 'choix' || c.sorte === 'modele') {
      const options = avecAbsent(c.sorte === 'choix' ? c.choix ?? [] : optionsModele(lus?.modeles ?? [], c.vide ?? 'Aucun'), String(v ?? ''));
      saisie = <select id={id} className="saisie" value={String(v ?? '')} onChange={(e) => poser(e.target.value)}>{options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}</select>;
    } else if (c.sorte === 'texte_long') {
      saisie = <textarea id={id} className="saisie" rows={3} value={String(v ?? '')} onChange={(e) => poser(e.target.value)} />;
    } else if (c.sorte === 'couleurs') {
      // Une couleur se choisit sans se taper ; le bouton disparaît au quatrième.
      const couleurs = (Array.isArray(v) ? v : []).map(String).slice(0, 4);
      saisie = (
        <div className="couleurs" id={id}>
          {couleurs.map((coul, n) => (
            <span key={n} className="couleur">
              <input type="color" value={coul} aria-label={`Couleur ${n + 1}`} onChange={(e) => poser(couleurs.map((x, i) => (i === n ? e.target.value : x)))} />
              <button type="button" title="Retirer cette couleur" aria-label={`Retirer la couleur ${n + 1}`} onClick={() => poser(couleurs.filter((_, i) => i !== n))}>×</button>
            </span>
          ))}
          {couleurs.length < 4 && <Action icone={ICONES.plus} onClick={() => poser([...couleurs, '#000091'])}>Couleur</Action>}
        </div>
      );
    } else {
      saisie = <input id={id} className="saisie" type="text" value={c.sorte === 'liste' && Array.isArray(v) ? v.join(', ') : String(v ?? '')} onChange={(e) => poser(e.target.value)} />;
    }
    return (
      <Champ key={c.cle} pour={id} groupe={c.sorte === 'couleurs'} titre={c.sorte === 'couleurs' ? undefined : c.aide} libelle={<>{c.libelle}{c.sorte !== 'couleurs' && marque}</>}
        aide={c.sorte === 'liste' || c.sorte === 'texte_long' || c.sorte === 'couleurs' ? c.aide : undefined}>
        {saisie}
      </Champ>
    );
  };

  const piecesLettre = (
    <Champ groupe libelle="Fichiers de renfort" aide="Fichiers texte joints aux notes de chaque lettre : un carnet de projet, un README, des chiffres. Chacun est titré de son nom pour que le modèle cite sa source." className="pieces">
      <ul className="liste-f fichiers">
        {pieces === null && <li className="d">Lecture des pièces…</li>}
        {pieces?.length === 0 && <li className="d">Aucun fichier.</li>}
        {pieces?.map((p) => (
          <li key={p.nom}>
            {renomme?.nom === p.nom ? (
              <input className="saisie" autoFocus aria-label={`Nouveau nom de ${p.nom}`} value={renomme.nouveau} onChange={(e) => setRenomme({ nom: p.nom, nouveau: e.target.value })}
                onBlur={() => setRenomme(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') renommer();
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setRenomme(null);
                  }
                }} />
            ) : <span className="mono" title={p.nom}>{p.nom}</span>}
            <span className="d">{poids(p.taille)}</span>
            <button type="button" className="mini" title="Renommer" aria-label={`Renommer ${p.nom}`} onClick={() => setRenomme({ nom: p.nom, nouveau: p.nom })}>✎</button>
            <button type="button" className="mini" title="Supprimer" aria-label={`Supprimer ${p.nom}`} onClick={() => setConfirmation({ sorte: 'piece', nom: p.nom })}>×</button>
          </li>
        ))}
      </ul>
      <Action icone={ICONES.televerser} onClick={() => fichiers.current?.click()}>Téléverser…</Action>
      <input ref={fichiers} type="file" accept=".md,.txt,.json,.csv,text/*" multiple hidden aria-label="Fichiers de renfort à téléverser"
        onChange={async (e) => {
          const choisis = [...(e.target.files ?? [])];
          e.target.value = '';
          for (const f of choisis) {
            // Lu en base64 sur le poste, rangé par le serveur dans la base sous ce compte.
            await pieceGeste(async () => appeler('/pieces-lettre', { methode: 'POST', corps: await televerser(f) }), `${f.name} téléversé.`);
          }
        }} />
    </Champ>
  );

  const g = GROUPES.find((x) => x.cle === groupe)!;
  const coches = lignes.filter((l) => selection.has(l.uid));
  const garde = FILTRES.find((f) => f.cle === filtre)!;
  const ligneTestee = lignes.find((l) => l.site === teste);
  const apparence = useOngletApparence({ actif: onglet === 'apparence', fermer, dire });
  const ajout = useOngletAjout({ actif: onglet === 'ajout', lignes, ajouter: (l) => setLignes((ls) => [...ls, l]), fermer, dire });
  // Seul l'onglet ouvert se montre ; trois ouvreurs ne tiennent pas dans 400 px.
  const onglets: Onglet[] = [apparence, ...(teste ? [ongletTester({ site: teste, essai: essais[teste], ligne: ligneTestee, occupe: testEnCours !== '', tester, fermer })] : []), ajout]
    .filter((o) => o.cle === onglet);

  return (
    <>
      <Fenetre id="reglages" className={`reglages-page${onglet ? ' resserre' : ''}`} titrePrise="Glisser pour détacher les réglages">
        <div className="outils">
          <TitreGroupe titre={g.titre} />
          {groupe === 'comptes' && (
            <MenuFiltre lib="État" titre="État des comptes" classeMenu="menu-etat" icone={ICONES.chevron_reglages} valeur={`${garde.libelle} · ${lignes.filter((l) => garde.garde(l, essais[l.site])).length}`}
              choix={FILTRES.map((f) => ({ cle: f.cle, libelle: f.libelle, n: lignes.filter((l) => f.garde(l, essais[l.site])).length }))}
              courant={filtre} actif={filtre !== 'tous'} choisir={setFiltre} />
          )}
          <span className="espace" />
          {groupe === 'comptes' && (
            <div className="actions" role="group" aria-label="Actions des comptes">
              {coches.length > 0 && (
                <ActionSupprimer n={coches.length} title={`Supprimer ${coches.length} site(s)`} onClick={() => setConfirmation({ sorte: 'sites' })} />
              )}
              <ActionOnglet cle="ajout" iconeApres={ICONES.plus} plein>
                Ajouter un site
              </ActionOnglet>
            </div>
          )}
        </div>
        {confirmation?.sorte === 'sites' && (
          <Confirmer question={`Supprimer ${coches.length} site(s) ?`} detail="Leurs mots de passe quittent le coffre ; les autres changements partent avec." action="Supprimer"
            occupe={occupe} onAnnuler={() => setConfirmation(null)} onConfirmer={() => enregistrer(lignes.filter((l) => !coches.includes(l)))} />
        )}
        {confirmation?.sorte === 'piece' && (
          <Confirmer question={`Supprimer ${confirmation.nom} ?`} detail="Il ne servira plus, et la suppression ne se défait pas." action="Supprimer"
            onAnnuler={() => setConfirmation(null)} onConfirmer={() => {
              const nom = confirmation.nom;
              setConfirmation(null);
              void pieceGeste(() => appeler(`/pieces-lettre/${encodeURIComponent(nom)}`, { methode: 'DELETE' }), `${nom} supprimé.`);
            }} />
        )}
        <CorpsGroupes nav={<>
            <RubriqueOnglet cle="apparence">Apparence</RubriqueOnglet>
            {GROUPES.slice(0, 1).map((x) => <BoutonGroupe key={x.cle} g={x} courant={groupe} choisir={setGroupe} />)}
            <LienIllusion vers="mails" className="rubrique" title="Les réglages des mails vivent sur la page Mails">Mails</LienIllusion>
            {GROUPES.slice(1).map((x) => <BoutonGroupe key={x.cle} g={x} courant={groupe} choisir={setGroupe} />)}
        </>}>
          <div className="groupe-contenu">
            {!lus ? <p className="aide-groupe">Lecture des réglages…</p> : groupe === 'comptes' ? (
              <div className="defile">
                <TableComptes lignes={lignes} setLignes={setLignes} essais={essais} filtre={filtre} selection={selection} setSelection={setSelection}
                  teste={onglet === 'tester' ? teste : null} tester={tester} />
                <div className="sous-tab">
                  <Interrupteur libelle="Créer un compte si l&apos;ATS l&apos;exige" checked={!!valeurs.candidature_inscription} onChange={(e) => poserValeur('candidature_inscription', e.target.checked)} />
                  <p className="aide-champ">Coupé, la candidature s&apos;arrête devant l&apos;écran d&apos;inscription : le dossier reste à finir à la main. L&apos;ordre des lignes, changé par ⠿, est celui des essais.</p>
                </div>
              </div>
            ) : (
              <div className="defile">
                {g.aide && <p className="aide-groupe">{g.aide}</p>}
                <div className="form-colonnes">
                  {(g.sections ?? []).filter((s) => admin || !s.admin).map((s) => (
                    <div key={s.titre} className="colonne-f">
                      <SectionFiche titre={<>{s.titre}{s.admin && <MarqueAdmin />}</>}>
                        {s.champs.filter((c) => admin || !c.admin).map(controle)}
                        {s.pieces && piecesLettre}
                      </SectionFiche>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <PiedGroupe libelles={libelles} disabled={!libelles.length || occupe} onClick={() => enregistrer()} />
          </div>
        </CorpsGroupes>
        {vue}
      </Fenetre>
      <Panneau onglets={onglets} />
    </>
  );
}

function BoutonGroupe({ g, courant, choisir }: { g: Groupe; courant: string; choisir: (c: string) => void }) {
  return <Rubrique actif={g.cle === courant} onClick={() => choisir(g.cle)}>{g.titre}</Rubrique>;
}

