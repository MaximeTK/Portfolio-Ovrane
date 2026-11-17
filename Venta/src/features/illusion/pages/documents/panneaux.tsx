'use client';
/* eslint-disable @next/next/no-img-element -- les aperçus viennent d'Illusion par le relais, avec la session : l'optimiseur de next/image ne les atteint pas */

import { useEffect, useId, useState } from 'react';
import { appeler, telecharger } from '../../api';
import { usePanneau, useVues } from '../../dock/Dock';
import { AuPied, Confirmer, MarqueAdmin, Panneau, type Elements, type Onglet } from '../../dock/Panneau';
import { ongletAjoutCompetence, ongletFicheOffre, type DemandeAjout } from '../../partage/FicheOffre';
import { Couleurs, FONDS, ListeFichiers, RELAIS, court, poids, useFichiers, type Fichier } from './commun';
import { MODELE_VIDE, type Documents, type Formulaire, type Genre, type Modele, type NomAtelier, type Parametres, type Production } from './index';
import { duree } from '../commun';
import { Action } from '../../elements/Action';
import { Champ, Interrupteur, ChampSaisie, ChampListe, ChampZone, SectionFiche, LibelleValeur } from '../../elements/Champ';
import { ICONES } from '../../elements/icones';
import { message, nomFichier, quand, sansJson } from '../../elements/format';

const LANGUES = ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl'];
const STATUTS: Record<string, string> = {
  POSTULEE: 'Envoyée', PRETE: 'Prête, pas encore déposée', A_LA_MAIN: 'À faire à la main', ECHEC: 'Échec', INADAPTEE: 'Inadaptée',
  IGNOREE: 'Écartée', EN_COURS: 'En cours',
};
const REPONSES: Record<string, string> = { positive: 'réponse positive', refus: 'refus', reponse: 'réponse reçue' };
// Ce que « Créer document » propose, un par genre de la galerie
const CREABLES: [Genre, string][] = [['cv', 'CV'], ['lettre', 'Lettre'], ['spontanes', 'Modèle de CV spontané']];
const hexa = (v?: string) => /^#[0-9a-f]{3,8}$/i.test(v ?? '');

// Éléments, puis sous-fenêtres en onglets ; ajout de compétence avec objet
export function PanneauDocuments({ d }: { d: Documents }) {
  const { onglet, ouvrir } = usePanneau();
  const ouverts = useVues().vues[0].objets;
  // L'ajout d'une compétence, et l'élément où revenir ensuite
  const [demande, setDemande] = useState<{ ajout: DemandeAjout; sorte: string; objet: string } | null>(null);
  // Refermé, le panneau oublie l'ajout en cours
  useEffect(() => {
    if (onglet === null) setDemande(null);
  }, [onglet]);
  const ajouter = (ajout: DemandeAjout, sorte: string, objet: string) => {
    setDemande({ ajout, sorte, objet });
    ouvrir('ajout-competence');
  };
  const elements: Elements = {
    fiche: (cle) => {
      const p = d.piece(cle);
      return p ? {
        cle: 'fiche', titre: `${p.nature === 'cv' ? 'CV' : 'Lettre'} · ${court(p.entreprise || '—', 14)}`, label: `Fiche de fabrication · ${p.entreprise || '—'}`,
        corps: <FichePiece p={p} d={d} ajouter={(dm) => ajouter(dm, 'fiche', cle)} />, pied: true,
      } : null;
    },
    'fiche-offre': (c) => ongletFicheOffre(c, { ajouterAuProfil: (dm) => ajouter(dm, 'fiche-offre', c) }),
    // Un modèle renommé garde sa fenêtre : la fiche ne disparaît pas sans nom
    spontane: (nom) => ({
      cle: 'spontane', titre: `Modèle ${court(nom, 14)}`, label: `Modèle de CV spontané · ${nom}`,
      corps: d.parametres ? <FicheModele depart={d.parametres.cv_spontanes?.find((m) => m.nom === nom)} d={d} enregistre={(n) => n !== nom && ouvrir('spontane', n)} />
        : <p className="texte-f">Lecture du modèle…</p>,
      pied: !!d.parametres,
    }),
  };
  const cv = useOngletFabrication(d, 'constructeur');
  const lettre = useOngletFabrication(d, 'lettre');
  const reglages = useOngletReglages(d, onglet === 'reglages');
  // Poste et profil, communs aux trois documents, tenus par les deux formulaires
  const f = d.formulaires.constructeur;
  // Un seul onglet pour créer : le document choisi en tête, son formulaire dessous
  const fabrique = d.creation === 'cv' ? cv : d.creation === 'lettre' ? lettre : {
    corps: <FicheModele key={d.vierge} depart={MODELE_VIDE} commun={{ profil: f.profil, poste: f.poste }} d={d} enregistre={(nom) => { d.viderModele(); ouvrir('spontane', nom); }} />, pied: true,
  };
  const creer: Onglet = {
    cle: 'creer-document', titre: 'Créer document',
    corps: (
      <>
        <ChampListe id="creer-genre" libelle="Document" value={d.creation} onChange={(e) => d.setCreation(e.target.value as Genre)}>
          {CREABLES.map(([g, nom]) => <option key={g} value={g}>{nom}</option>)}
        </ChampListe>
        <ChampSaisie id="creer-poste" titre="Repris en tête du CV. Vide : celui du profil." libelle="Poste visé" value={f.poste} onChange={(e) => d.changerFormulaire('constructeur', { poste: e.target.value })} />
        <ChampListe id="creer-profil" libelle="Profil du candidat *" value={f.profil} required onChange={(e) => d.changerFormulaire('constructeur', { profil: e.target.value })}>
          <option value="">— choisir un profil —</option>
          {d.profils.map((p) => <option key={p} value={p}>{sansJson(p)}</option>)}
        </ChampListe>
        {fabrique.corps}
      </>
    ),
    pied: fabrique.pied,
  };
  const objets = Object.keys(elements).filter((c) => ouverts[c] !== undefined && elements[c](ouverts[c])).length + (demande ? 1 : 0);
  // Deux objets ouverts : un onglet de geste ne reste que s'il est ouvert
  const peu = objets <= 1;
  const voulu = (o: Onglet, montre: boolean) => (montre || onglet === o.cle ? [o] : []);
  const onglets: Onglet[] = [
    ...(demande ? [ongletAjoutCompetence(demande.ajout, (texte) => {
      setDemande(null);
      if (texte) {
        d.dire(texte);
        // La puce change de camp sous les yeux : « manquante ici, ajoutée depuis »
        d.marquerAjoutee(demande.ajout.cle, demande.ajout.competence);
      }
      ouvrir(demande.sorte, demande.objet);
    })] : []),
    ...voulu(creer, peu),
    ...voulu(reglages, peu),
  ];
  return <Panneau elements={elements} onglets={onglets} />;
}

// Fiche d'une pièce, une par fenêtre : son pied garde sa confirmation
function FichePiece({ p, d, ajouter }: { p: Production; d: Documents; ajouter: (dm: DemandeAjout) => void }) {
  const { ouvrir, fermer } = usePanneau();
  const [confirmer, setConfirmer] = useState(false);
  const lien = `${RELAIS}/productions/${p.candidature}/${p.nature}`;
  const piece = p.nature === 'cv' ? 'CV' : 'Lettre';
  const exporter = () => {
    const nom: NomAtelier = p.nature === 'cv' ? 'constructeur' : 'lettre';
    const couleurs = [p.fond_accent, p.fond_secondaire].filter((c): c is string => /^#[0-9a-f]{6}$/i.test(c ?? ''));
    const repris: Partial<Formulaire> = {
      ...(d.profils.includes(p.profil) ? { profil: p.profil } : {}), ...(p.offre_reelle && p.url ? { offre: p.url } : {}),
      ...(p.poste ? { poste: p.poste } : {}), ...(p.entreprise ? { entreprise: p.entreprise } : {}),
      ...(nom === 'constructeur' && couleurs.length ? { palette: couleurs } : {}),
    };
    const n = Object.keys(repris).length;
    if (!n) return d.dire('Rien à reprendre : cette pièce ne porte aucun paramètre réutilisable.', true);
    d.changerFormulaire(nom, repris);
    d.dire(`${n} paramètre(s) repris dans « Créer document » — il ne reste qu'à relancer.`);
    d.setCreation(nom === 'constructeur' ? 'cv' : 'lettre');
    ouvrir('creer-document');
  };
  const supprimer = async () => {
    // La fiche supprime sa pièce, pas la sélection de la galerie
    if (await d.supprimer([p])) fermer();
  };
  const tirage = ([['fond_mode', 'Fond'], ['fond_accent', 'Accent'], ['fond_famille', 'Police'], ['fond_structure', 'Structure'], ['fond_secondaire', 'Secondaire'], ['fond_photo', 'Photo']] as const)
    .filter(([c]) => p[c]);
  const ligne = ([c, lib]: (typeof tirage)[number]) => (
    <LibelleValeur key={c} as="li" libelle={lib}>{c === 'fond_photo' ? <span className="d">{p[c] === 'True' ? 'oui' : 'non'}</span>
        : hexa(p[c]) ? <span className="d mono"><i className="pastille petite" style={{ background: p[c] }} />{p[c]}</span> : <span className="d">{p[c]}</span>}</LibelleValeur>
  );
  const donne = `${STATUTS[p.statut] ?? p.statut}${p.statut === 'POSTULEE' && !p.reponse ? ' · pas encore de réponse' : ''}`;
  return (
    <>
      {confirmer && (
        <Confirmer question={p.nature === 'cv' ? 'Supprimer ce CV ?' : 'Supprimer cette lettre ?'} action="Supprimer"
          detail={p.offre_reelle ? 'Le fichier part, la candidature envoyée reste.' : "Bâti sans annonce : rien d'autre n'en dépend."}
          onAnnuler={() => setConfirmer(false)} onConfirmer={supprimer} />
      )}
      <div className="docs-f">
        <div className="fiche">
          {p.apercu ? (
            <a href={lien} target="_blank" rel="noopener noreferrer" className="grande" title="Ouvrir le fichier">
              <img className="page-img" src={`${lien}/apercu?v=${encodeURIComponent(p.nom || p.date)}`} alt={`Aperçu ${p.nature === 'cv' ? 'du CV' : 'de la lettre'}`} />
            </a>
          ) : (
            <div className={`page grande${p.nature === 'lettre' ? ' lettre' : ''}`} style={{ ['--t' as string]: p.fond_accent || '#6E8FFE' }} role="img"
              aria-label="Pas d'aperçu : cette pièce est antérieure à la capture faite à l'export."><span className="format">{p.format || '?'}</span></div>
          )}
          <div>
            <ul className="liste-f">
              <LibelleValeur as="li" libelle="Pièce" d>{piece} · <span className="mono" title={p.nom}>{p.nom}</span></LibelleValeur>
              <LibelleValeur as="li" libelle="Poste" d>{p.poste || '(sans intitulé)'}</LibelleValeur>
              <LibelleValeur as="li" libelle="Entreprise" d>{p.entreprise || '—'}</LibelleValeur>
              <LibelleValeur as="li" libelle="Offre">{p.offre_reelle
                ? <button type="button" className="d lien" aria-haspopup="dialog" data-ouvre="fiche-offre" data-objet={p.offre} onClick={() => ouvrir('fiche-offre', p.offre)}>Voir la fiche de poste</button>
                : <span className="d">aucune annonce : bâti sans lien</span>}</LibelleValeur>
              <LibelleValeur as="li" libelle="Profil"><span className="d mono">{nomFichier(p.profil_chemin || p.profil) || '—'}</span></LibelleValeur>
              <LibelleValeur as="li" libelle="Fabriquée le" d>{quand(p.date)}{p.fabrication_s ? ` · en ${Math.round(p.fabrication_s)} s` : ''}</LibelleValeur>
              <LibelleValeur as="li" libelle="Ce qu&apos;elle a donné" d>{p.essai ? 'Essai de mise en page' : donne}
                {p.reponse && <> · <span className="t-rep">{REPONSES[p.reponse] ?? p.reponse}</span></>}{p.liens_suivis ? ` · ${p.clics} clic(s) sur ses liens` : ''}</LibelleValeur>
            </ul>
            {tirage.length > 0 && (
              <>
                <p className="sous-f">Mise en page</p>
                <div className="grille-2">
                  <ul className="liste-f">{tirage.filter(([c]) => ['fond_mode', 'fond_accent', 'fond_famille'].includes(c)).map(ligne)}</ul>
                  <ul className="liste-f">{tirage.filter(([c]) => !['fond_mode', 'fond_accent', 'fond_famille'].includes(c)).map(ligne)}</ul>
                </div>
              </>
            )}
          </div>
        </div>
        {(p.retenues.length > 0 || p.manquantes.length > 0 || p.implicites.length > 0) && (
          <div className="competences">
            <div><p className="lib-champ lib-bloc">Compétences retenues</p>
              {p.retenues.length ? <div className="puces">{p.retenues.map((c) => <span key={c} className="puce">{c}</span>)}</div> : <p className="aide-champ">—</p>}</div>
            <div><p className="lib-champ lib-bloc">Compétences manquantes</p>
              {p.manquantes.length ? (
                <div className="puces">{p.manquantes.map((c) => (p.ajoutees.includes(c)
                  ? <span key={c} className="puce ajoutee" title="Manquante sur cette candidature-là, ajoutée au profil depuis : les suivantes la trouveront.">{c}<b>✓</b></span>
                  : <button key={c} type="button" className="puce" title={`Ajouter « ${c} » au profil`} aria-haspopup="dialog"
                    onClick={() => ajouter({ cle: p.offre, competence: c, profil: p.profil })}>{c}<b>+</b></button>))}</div>
              ) : <p className="aide-champ">—</p>}</div>
            <div><p className="lib-champ lib-bloc">Exigences sous-entendues</p>
              {p.implicites.length ? <div className="puces">{p.implicites.map((c) => <span key={c} className="puce implicite">{c}</span>)}</div> : <p className="aide-champ">—</p>}</div>
          </div>
        )}
      </div>
      <AuPied>
        <Action className="gauche" rouge icone={ICONES.supprimer} onClick={() => setConfirmer(true)}>Supprimer</Action>
        <Action icone={ICONES.exporter} txt title="Exporter les paramètres" onClick={exporter}>Exporter les paramètres</Action>
        <Action plein iconeApres={ICONES.telecharger} onClick={() => telecharger(`/productions/${p.candidature}/${p.nature}`).catch((e) => d.dire(message(e), true))}>
          Télécharger
        </Action>
      </AuPied>
    </>
  );
}

// Atelier de la brique : champs, Exécuter devenu Arrêter, état du lancement
function useOngletFabrication(d: Documents, nom: NomAtelier): Pick<Onglet, 'corps' | 'pied'> {
  const f = d.formulaires[nom];
  const etat = d.etats[nom];
  const changer = (champs: Partial<Formulaire>) => d.changerFormulaire(nom, champs);
  const cv = nom === 'constructeur';
  const motif = f.profil ? '' : 'Profil du candidat est obligatoire';
  const lancer = () => {
    if (!etat?.en_cours && motif) return d.dire(`Impossible de lancer : ${motif}.`, true);
    void d.executer(nom);
  };
  const id = (c: string) => `${nom}-${c}`;
  const bascule = (c: 'deja_postule' | 'essai' | 'silencieux', libelle: string, aide: string, admin = false, inactif = false) => (
    <Interrupteur className={inactif ? 'inactif' : undefined} title={aide} libelle={<>{libelle}{admin && <MarqueAdmin />}</>} checked={f[c]} disabled={inactif} onChange={(e) => changer({ [c]: e.target.checked } as Partial<Formulaire>)} />
  );
  const options = (
    <>
      {bascule('deja_postule', 'Candidature manuelle', "Coché : vous avez postulé vous-même — l'offre sort de la file, la fiche entreprise est créée si elle manque. Décoché : même chose, mais l'offre rejoint ce qu'il reste à postuler.")}
      {d.admin && bascule('essai', 'Mode test', "Coché : rien n'est engagé. Le fichier paraît dans la galerie sous l'étiquette « essai » ; aucune fiche d'employeur, rien dans la file à postuler. Grisé tant que « Candidature manuelle » est coché.", true, f.deja_postule)}
      {d.admin && bascule('silencieux', 'Débogage', "Coché, la brique détaille tout ce qu'elle fait. Décoché, elle n'imprime que l'essentiel.", true)}
    </>
  );
  const badge = !etat || (!etat.en_cours && etat.ok == null) ? null
    : etat.en_cours ? <p className="etat-l cours" role="status"><span className="carre cours" />en cours · {duree(etat.depuis_s)}</p>
      : etat.ok ? <p className="etat-l" role="status"><span className="carre finie" />terminée en {duree(etat.duree_s)}</p>
        : <p className="etat-l echec" role="alert">en échec — {etat.erreur || 'voir le journal du serveur'}</p>;
  return {
    corps: (
      <form className="docs-f" aria-label={cv ? 'Créer un CV' : 'Créer une lettre'} onSubmit={(e) => { e.preventDefault(); lancer(); }}>
        {/* Les champs communs d'abord, à la même place pour le CV et la lettre */}
        <div className="section-f">
          <ChampSaisie id={id('url')} titre="L'annonce est ouverte et lue : elle donne l'intitulé, l'employeur et les compétences qui taillent le dossier. Vide : le dossier vaut pour lui-même." libelle="URL de l&apos;offre" type="url" placeholder="https://…/offre/12345" value={f.offre} onChange={(e) => changer({ offre: e.target.value })} />
          <ChampSaisie id={id('ent')} titre="Sert à nommer les fichiers ; n'apparaît pas sur le CV." libelle="Entreprise" value={f.entreprise} onChange={(e) => changer({ entreprise: e.target.value })} />
        </div>
        <SectionFiche titre="Options">
          {options}
          {cv ? (
            <Champ groupe libelle="Palette du fond" aide="Vide : celles de l&apos;identité de l&apos;entreprise.">
              <Couleurs valeurs={f.palette} changer={(palette) => changer({ palette })} libelle="Palette du fond" /></Champ>
          ) : (
            <ChampListe id={id('langue')} titre="Celle de l'offre : le corps, l'objet, la date et la formule s'y écrivent." libelle="Langue de la lettre" value={f.langue} onChange={(e) => changer({ langue: e.target.value })}>
                {LANGUES.map((l) => <option key={l} value={l}>{l}</option>)}
              </ChampListe>
          )}
        </SectionFiche>
        {badge}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    ),
    pied: (
      <>
        {cv && (
          <Action icone={ICONES.image} disabled={!!etat?.en_cours} title="Le même CV, mis en page pareil, sans son fond : le texte seul, en PNG transparent à 300 ppp. Rien n'entre en base ; le fichier se télécharge à la fin." onClick={() => (motif ? d.dire(`Impossible de lancer : ${motif}.`, true) : void d.executer(nom, { transparent: true, essai: true }))}>PNG transparent
          </Action>
        )}
        <Action plein iconeApres={etat?.en_cours ? ICONES.arret : ICONES.fleche} disabled={!etat?.en_cours && !!motif} title={!etat?.en_cours && motif ? `Impossible de lancer : ${motif}.` : undefined} onClick={lancer}>
          {etat?.en_cours ? 'Arrêter' : 'Exécuter'}
        </Action>
      </>
    ),
  };
}

// Réglages de tous les CV et lettres ; les renforts partent aussitôt
function useOngletReglages(d: Documents, actif: boolean): Onglet {
  const p = d.parametres;
  const depart = () => ({ fond: p?.constructeur_fond ?? '', palette: p?.constructeur_palette ?? [], modele: p?.constructeur_modele ?? '',
    prompt: p?.constructeur_prompt_lettre ?? '', notes: p?.constructeur_notes_lettre ?? '' });
  const [brouillon, setBrouillon] = useState(depart);
  const [aSupprimer, setASupprimer] = useState<Fichier | null>(null);
  const pieces = useFichiers('/pieces-lettre', d.dire, actif, 'documents');
  useEffect(() => {
    if (actif) setBrouillon(depart());
    // Le brouillon repart des réglages à l'ouverture et à l'enregistrement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, p]);
  const change = JSON.stringify(brouillon) !== JSON.stringify(depart());
  const enregistrer = () => void d.enregistrer({
    constructeur_fond: brouillon.fond, constructeur_palette: brouillon.palette, constructeur_prompt_lettre: brouillon.prompt,
    constructeur_notes_lettre: brouillon.notes, ...(d.admin ? { constructeur_modele: brouillon.modele } : {}),
  });
  const modeles = p?.modeles ?? [];
  return {
    cle: 'reglages',
    titre: 'Réglages',
    label: 'Réglages · Documents',
    corps: (
      <div className="docs-f" onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).matches('select') && change) enregistrer();
      }}>
        <SectionFiche titre="CV">
          <div className="grille-2">
            <ChampListe id="rg-fond" titre="Reprend le fond imposé à tous les CV : vide, un tirage différent à chaque CV." libelle="Fond" value={brouillon.fond} onChange={(e) => setBrouillon({ ...brouillon, fond: e.target.value })}>
                {FONDS.map((f) => <option key={f} value={f}>{f || 'Défaut'}</option>)}
              </ChampListe>
            <Champ groupe libelle="Palette imposée">
              <Couleurs valeurs={brouillon.palette} changer={(palette) => setBrouillon({ ...brouillon, palette })} libelle="Palette imposée" /></Champ>
          </div>
        </SectionFiche>
        <SectionFiche titre="Lettre">
          {d.admin && (
            <ChampListe id="rg-modele" titre="Celui qui rédige les lettres. Vide : aucune rédaction, le gabarit suffit." libelle={<>Modèle<MarqueAdmin /></>} value={brouillon.modele} onChange={(e) => setBrouillon({ ...brouillon, modele: e.target.value })}>
                {modeles.map((m) => <option key={m.nom} value={m.nom}>{m.modele && m.modele !== m.nom ? `${m.nom} · ${m.modele}` : m.nom}</option>)}
                <option value="">— aucun : le gabarit —</option>
              </ChampListe>
          )}
          <div className="grille-2">
            <ChampZone id="rg-prompt" titre="Ce que le modèle doit écrire, et comment. Vide : la lettre est assemblée par le gabarit, sans réseau ni jeton." libelle="Prompt de la lettre" rows={3} value={brouillon.prompt} onChange={(e) => setBrouillon({ ...brouillon, prompt: e.target.value })} />
            <ChampZone id="rg-notes" titre="Remises au modèle sous PROJETS : pour chaque projet, le contexte, la difficulté, la décision prise, ce que ça a donné." libelle="Vos notes (PROJETS)" rows={3} value={brouillon.notes} onChange={(e) => setBrouillon({ ...brouillon, notes: e.target.value })} />
          </div>
          <Champ titre="Fichiers texte joints aux notes de chaque lettre — un carnet de projet, un README, des chiffres. Rangés sous votre compte ; chacun est titré de son nom pour que le modèle cite sa source." groupe libelle="Fichiers de renfort">
            {aSupprimer && (
              <Confirmer question={`Supprimer ${aSupprimer.nom} ?`} detail={`${poids(aSupprimer.taille)} · il ne sera plus joint aux lettres.`} action="Supprimer"
                onAnnuler={() => setASupprimer(null)} onConfirmer={() => {
                  void pieces.supprimer(aSupprimer.nom);
                  setASupprimer(null);
                }} />
            )}
            <ListeFichiers route="/pieces-lettre" accept=".md,.txt,.json,.csv,text/*" compact sorte="Fichier de renfort" portee="propre à votre compte"
              gestion={pieces} aSupprimer={setASupprimer} vise={aSupprimer?.nom} />
          </Champ>
        </SectionFiche>
      </div>
    ),
    pied: <Action plein iconeApres={ICONES.fleche} disabled={!change} title={change ? undefined : "Rien n'a changé"} onClick={enregistrer}>Enregistrer</Action>,
  };
}

// Modèle de CV spontané, un par fenêtre, vierge dans « Créer document »
function FicheModele({ depart, commun, d, enregistre }: { depart?: Modele; commun?: { profil: string; poste: string }; d: Documents; enregistre: (nom: string) => void }) {
  const { fermer } = usePanneau();
  const [m, setM] = useState<(Modele & { original: string }) | null>(() => (depart ? { ...depart, ...commun, original: depart.nom } : null));
  const [rubriques, setRubriques] = useState<[string, string[]][] | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [batit, setBatit] = useState(false);
  const base = useId();
  const profil = m?.profil ?? '';
  useEffect(() => {
    if (!profil) return setRubriques([]);
    let vivant = true;
    setRubriques(null);
    // Compétences lues comme le Constructeur : par rubrique, liste ou texte
    appeler<{ contenu: string }>(`/profils-candidature/${encodeURIComponent(profil)}`).then((r) => {
      const lues = Object.entries((JSON.parse(r.contenu)?.competences ?? {}) as Record<string, string | string[]>)
        .map(([rub, l]): [string, string[]] => [rub, (typeof l === 'string' ? l.split(',') : l ?? []).map((c) => String(c).trim()).filter(Boolean)])
        .filter(([, l]) => l.length);
      if (vivant) setRubriques(lues);
    }).catch((e) => {
      if (vivant) setRubriques([]);
      d.dire(`Compétences du profil illisibles : ${message(e)}`, true);
    });
    return () => {
      vivant = false;
    };
    // Relues quand le profil choisi change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil]);
  const profilCommun = commun?.profil;
  const posteCommun = commun?.poste;
  // En création, le profil et le poste sont ceux de « Créer document »
  useEffect(() => {
    if (profilCommun === undefined || posteCommun === undefined) return;
    // Un autre profil n'a plus les mêmes compétences : la sélection repart de zéro
    setM((v) => v && { ...v, poste: posteCommun, ...(v.profil === profilCommun ? {} : { profil: profilCommun, competences: [] }) });
  }, [profilCommun, posteCommun]);
  // Modèle supprimé ailleurs ou introuvable : la fenêtre le dit
  if (!m || (m.original && !d.parametres?.cv_spontanes?.some((x) => x.nom === m.original))) return <p className="texte-f">Ce modèle n&apos;existe plus.</p>;
  const changer = (champs: Partial<Modele>) => setM({ ...m, ...champs });
  const choisies = new Set(m.competences.map((c) => c.toLowerCase()));
  const enregistrer = async (avis = true) => {
    const nom = m.nom.trim();
    if (!nom) {
      d.dire("Donnez un nom au modèle avant de l'enregistrer.", true);
      return null;
    }
    const { original, ...modele } = { ...m, nom, destination: m.destination.trim(), poste: m.poste.trim() };
    const liste = [...(d.parametres?.cv_spontanes ?? [])];
    const rang = liste.findIndex((x) => x.nom === original);
    if (rang >= 0) liste[rang] = modele;
    else liste.push(modele);
    if (!await d.enregistrer({ cv_spontanes: liste }, avis ? `Modèle « ${nom} » enregistré.` : '')) return null;
    setM({ ...modele, original: nom });
    return nom;
  };
  const sauver = async () => {
    const nom = await enregistrer();
    if (nom) enregistre(nom);
  };
  const batir = async () => {
    // La saisie part d'abord : le serveur bâtit le modèle tel qu'à l'écran
    const nom = await enregistrer(false);
    if (!nom) return;
    setBatit(true);
    try {
      const bati = await appeler<Modele>(`/cv-spontanes/${encodeURIComponent(nom)}/batir`, { methode: 'POST' });
      d.setParametres(await appeler<Parametres>('/parametres'));
      setM({ ...bati, original: bati.nom });
      d.dire(`CV spontané « ${bati.nom} » bâti.`);
      // Il ne change de fenêtre qu'une fois bâti, pour garder « Mise en page… »
      enregistre(bati.nom);
    } catch (e) {
      d.dire(message(e), true);
    }
    setBatit(false);
  };
  const reprendre = () => {
    const f = d.formulaires.constructeur;
    changer({ constructeur: false, fond: d.parametres?.constructeur_fond ?? '', palette: f.palette.length ? f.palette : d.parametres?.constructeur_palette ?? [],
      ...(d.profils.includes(f.profil) ? { profil: f.profil } : {}), ...(f.poste ? { poste: f.poste } : {}) });
    d.dire('Paramètres du Constructeur repris : ils ne valent plus que pour ce modèle. Enregistrez-le pour les garder.');
  };
  const envoyer = async () => {
    d.changerFormulaire('constructeur', { ...(d.profils.includes(m.profil) ? { profil: m.profil } : {}), poste: m.poste, ...(m.constructeur ? {} : { palette: m.palette }) });
    // Le fond du Constructeur est un réglage du compte, pour tous ses CV
    const fond = !m.constructeur && m.fond !== (d.parametres?.constructeur_fond ?? '');
    if (fond && !await d.enregistrer({ constructeur_fond: m.fond }, '')) return;
    d.dire(`Profil, poste${m.constructeur ? '' : ' et palette'} envoyés au Constructeur${fond ? `, et son fond réglé sur « ${m.fond || 'tiré au sort'} »` : ''}.`);
  };
  const supprimer = async () => {
    if (await d.enregistrer({ cv_spontanes: (d.parametres?.cv_spontanes ?? []).filter((x) => x.nom !== m.original) }, `Modèle « ${m.original} » supprimé.`)) fermer();
  };
  const id = (c: string) => `${base}-${c}`;
  const champNom = <ChampSaisie id={id('nom')} libelle="Nom" placeholder="ESN" value={m.nom} onChange={(e) => changer({ nom: e.target.value })} />;
  const miseEnPage = (
    <Champ groupe libelle="Mise en page">
      <div><Interrupteur libelle="celle du Constructeur" title={`Cochée : le fond et la palette réglés pour le Constructeur au moment de bâtir — aujourd'hui ${d.parametres?.constructeur_fond || 'fond tiré au sort'} —, sans rien recopier.`} checked={m.constructeur} onChange={(e) => changer({ constructeur: e.target.checked })} /></div></Champ>
  );
  return (
    <>
      {confirmer && (
        <Confirmer question={`Supprimer le modèle « ${m.original} » ?`} detail="Son PDF bâti n'est plus proposé aux candidatures spontanées." action="Supprimer"
          onAnnuler={() => setConfirmer(false)} onConfirmer={() => void supprimer()} />
      )}
      <form className="docs-f" aria-label="Modèle de CV spontané" onSubmit={(e) => { e.preventDefault(); void sauver(); }}>
        <div className="section-f">
          {/* En création, le poste et le profil sont au-dessus, communs aux trois documents */}
          {commun ? champNom : (
            <div className="grille-2">
              {champNom}
              <ChampSaisie id={id('poste')} libelle="Poste en tête du CV" placeholder="Vide : celui du profil" value={m.poste} onChange={(e) => changer({ poste: e.target.value })} />
            </div>
          )}
          <ChampZone id={id('dest')} titre="Ce que l'IA lit pour choisir ce CV face à un employeur." libelle="Destiné à" className="saisie court" rows={2} placeholder="ESN et cabinets de conseil qui placent des consultants chez leurs clients" value={m.destination} onChange={(e) => changer({ destination: e.target.value })} />
          {commun ? miseEnPage : (
            <div className="grille-2">
              <ChampListe id={id('profil')} libelle="Profil mis en page" value={m.profil} onChange={(e) => changer({ profil: e.target.value, competences: [] })}>
                  <option value="">— choisir un profil —</option>
                  {[...new Set([...d.profils, ...(m.profil ? [m.profil] : [])])].map((p) => <option key={p} value={p}>{sansJson(p)}</option>)}
                </ChampListe>
              {miseEnPage}
            </div>
          )}
          {!m.constructeur && (
            <div className="grille-2">
              <ChampListe id={id('fond')} libelle="Fond" value={m.fond} onChange={(e) => changer({ fond: e.target.value })}>
                  {FONDS.map((f) => <option key={f} value={f}>{f || 'Tiré au sort'}</option>)}
                </ChampListe>
              <Champ groupe libelle="Palette"><Couleurs valeurs={m.palette} changer={(palette) => changer({ palette })} libelle="Palette du modèle" /></Champ>
            </div>
          )}
          <div className="gestes">
            <Action icone={ICONES.reprendre} title="Recopie dans ce modèle le profil et le poste du CV de « Créer document », son fond et sa palette : ils ne valent plus que pour ce modèle." onClick={reprendre}>Reprendre du Constructeur</Action>
            <Action icone={ICONES.envoyer} title="Recopie dans le CV de « Créer document » le profil, le poste et la palette de ce modèle. Son fond devient celui de tous vos CV." onClick={() => void envoyer()}>Envoyer au Constructeur</Action>
          </div>
        </div>
        <SectionFiche titre="Compétences">
          <p className="lib-champ lib-bloc">Mises en avant, en tête du CV <span className="compteur">{m.competences.length}</span></p>
          {m.competences.length ? (
            <div className="puces">{m.competences.map((c) => (
              <button key={c} type="button" className="puce" title="Retirer" aria-label={`Retirer ${c}`} onClick={() => changer({ competences: m.competences.filter((x) => x !== c) })}>{c}<b>−</b></button>
            ))}</div>
          ) : <p className="aide-champ">Aucune : le CV garde l&apos;ordre du profil.</p>}
          <p className="lib-champ lib-bloc profil-c">Compétences du profil</p>
          {!m.profil ? <p className="aide-champ">Choisissez le profil : ses compétences s&apos;affichent ici.</p>
            : rubriques === null ? <p className="aide-champ">Lecture du profil…</p>
              : !rubriques.length ? <p className="aide-champ">Ce profil ne déclare aucune compétence.</p>
                : rubriques.map(([rub, noms]) => (
                  <div key={rub} className="rubrique"><span className="lib-r" title={rub}>{rub}</span>
                    <div className="puces">{noms.map((c) => (choisies.has(c.toLowerCase())
                      ? <button key={c} type="button" className="puce actif" title="Ne plus la mettre en avant" onClick={() => changer({ competences: m.competences.filter((x) => x.toLowerCase() !== c.toLowerCase()) })}>{c}<b>−</b></button>
                      : <button key={c} type="button" className="puce" title="La mettre en avant" onClick={() => changer({ competences: [...m.competences, c] })}>{c}<b>+</b></button>))}</div>
                  </div>
                ))}
        </SectionFiche>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      <AuPied>
        {m.original && <Action className="gauche" rouge icone={ICONES.supprimer} onClick={() => setConfirmer(true)}>Supprimer</Action>}
        <Action onClick={() => void sauver()}>Enregistrer</Action>
        <Action plein iconeApres={ICONES.fleche} disabled={batit} onClick={() => void batir()}>
          {batit ? 'Mise en page…' : m.cv ? 'Rebâtir le CV' : 'Bâtir le CV'}
        </Action>
      </AuPied>
    </>
  );
}

