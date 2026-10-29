'use client';

import './planche.css';
import { useLayoutEffect, useState } from 'react';
import { Activite } from '@/features/illusion/activite/Activite';
import type { DonneesActivite } from '@/features/illusion/activite/useActivite';
import { useApparence, type Matiere } from '@/features/illusion/apparence';
import { Dock, Fenetre, usePanneau } from '@/features/illusion/dock/Dock';
import { Confirmer, Panneau } from '@/features/illusion/dock/Panneau';

// Matière demandée par l'adresse du banc, posée avant la première peinture
export function ReglerMatiere({ matiere }: { matiere?: Matiere }) {
  useLayoutEffect(() => {
    if (matiere) useApparence.getState().choisirMatiere(matiere);
  }, [matiere]);
  return null;
}

const ACTIVITE: DonneesActivite = {
  bilan: { envoi: 3, reponse: 2, entretien: 0, relance: 1, offres: 12, afaire: 1 },
  enCours: 'ALTEN, le formulaire se remplit',
  toutVoir: () => {},
  fil: [
    { id: '1', sorte: 'envoi', heure: '14:02', phrase: 'Candidature envoyée chez Margo.' },
    { id: '2', sorte: 'offres', heure: '13:47', phrase: '12 nouvelles offres.' },
    { id: '3', sorte: 'reponse', heure: '13:15', phrase: 'JurIA a répondu.' },
    { id: '4', sorte: 'afaire', heure: '12:41', phrase: 'Thales : captcha à finir à la main.' },
    { id: '5', sorte: 'envoi', heure: '11:58', phrase: 'Candidature envoyée chez Ledger.' },
    { id: '6', sorte: 'relance', heure: '10:20', phrase: 'Relance envoyée à Klee.' },
    { id: '7', sorte: 'reponse', heure: '09:31', phrase: 'Pennylane a répondu.' },
    { id: '8', sorte: 'envoi', heure: '09:05', phrase: 'Candidature envoyée chez Back Market.' },
    { id: 'j1', jour: "Aujourd'hui" },
    { id: '9', sorte: 'entretien', heure: '18:10', phrase: 'Entretien fixé chez Aleysia, jeudi 10:00.' },
    { id: '10', sorte: 'envoi', heure: '16:22', phrase: 'Candidature envoyée chez JurIA.' },
    { id: '11', sorte: 'offres', heure: '14:47', phrase: '9 nouvelles offres.' },
    { id: '12', sorte: 'envoi', heure: '13:05', phrase: 'Candidature envoyée chez Alan.' },
    { id: '13', sorte: 'reponse', heure: '11:40', phrase: 'Malt a répondu.' },
    { id: '14', sorte: 'relance', heure: '09:12', phrase: 'Relance envoyée à Doctolib.' },
    { id: 'j2', jour: 'Hier' },
    { id: '15', sorte: 'envoi', heure: '17:45', phrase: 'Candidature envoyée chez Swile.' },
    { id: '16', sorte: 'afaire', heure: '16:02', phrase: 'Qonto : une question libre à remplir.' },
    { id: '17', sorte: 'offres', heure: '10:30', phrase: '21 nouvelles offres.' },
    { id: '18', sorte: 'envoi', heure: '09:14', phrase: 'Candidature envoyée chez Mirakl.' },
    { id: 'j3', jour: 'Lundi 26/10' },
  ],
};

// Publiée, entreprise, intitulé, lieu, profil, profil auto, source, étape (classe, texte, infobulle), timer
type Ligne = [string, string, string, string, string, boolean, string, string, string, string, string];
const W = 'Welcome to the Jungle', P = 'developpeur-python', B = 'backend-en';
const LIGNES: Ligne[] = [
  ['26/10', 'ALTEN', 'Développeur back-end Python', 'Paris · CDI', P, true, W, '', 'À postuler', '', ''],
  ['26/10', 'Padoa', 'Développeur full-stack', 'Bordeaux · CDI', 'fullstack-js', true, W, '', 'À postuler', '', ''],
  ['25/10', 'Thales', 'Ingénieur logiciel', 'Vélizy · CDI', P, false, 'SuccessFactors', 'main', 'À faire à la main', "Captcha avant l'envoi", ''],
  ['24/10', 'Margo', 'Développeur Python', 'Paris · CDI', P, true, W, 'env', 'Envoyée', '', '0:00:12:04'],
  ['24/10', 'Klee', 'Développeur Django', 'Paris · CDI', P, true, W, '', 'À postuler', '', ''],
  ['23/10', 'JurIA', 'Développeur back-end', 'Paris · CDI', P, true, W, 'env', 'Envoyée', '', '1:19:21:47'],
  ['23/10', 'Doctolib', 'Développeur Python', 'Paris · CDI', P, true, W, '', 'À postuler', '', ''],
  ['22/10', 'Malt', 'Développeur Python senior', 'Lyon · CDI', P, true, W, 'inad', 'Inadaptée', "Demande 8 ans d'expérience", ''],
  ['22/10', 'Qonto', 'Back-end engineer', 'Paris · CDI', B, true, 'LinkedIn', 'ech', 'Échec', "Page de l'offre retirée", ''],
  ['21/10', 'Aleysia', 'Ingénieur Python', 'Paris · CDI', P, false, W, 'env', 'Envoyée', '', '6:22:40:15'],
  ['21/10', 'ALTEN', 'Ingénieur Python confirmé', 'Toulouse · CDI', P, true, W, 'env', 'Envoyée', '', '6:04:47:12'],
  ['20/10', 'Swile', 'Développeur Python', 'Montpellier · CDI', P, true, W, 'eca', 'Écartée', '', ''],
  ['20/10', 'Alan', 'Backend engineer', 'Paris · CDI', B, true, 'LinkedIn', '', 'À postuler', '', ''],
  ['19/10', 'Ledger', 'Développeur back-end', 'Paris · CDI', P, true, W, 'env', 'Envoyée', '', '0:02:16:40'],
  ['18/10', 'Mirakl', 'Développeur Python', 'Paris · CDI', P, true, W, '', 'À postuler', '', ''],
  ['18/10', 'Algolia', 'Backend engineer', 'Paris · CDI', B, true, 'LinkedIn', 'env', 'Envoyée', '', '9:04:12:33'],
  ['17/10', 'Spendesk', 'Développeur back-end', 'Paris · CDI', P, true, W, 'inad', 'Inadaptée', '', ''],
  ['17/10', 'PayFit', 'Développeur Python', 'Paris · CDI', P, false, W, 'env', 'Envoyée', '', '9:22:47:09'],
  ['16/10', 'Alma', 'Développeur Django', 'Paris · CDI', P, true, W, '', 'À postuler', '', ''],
  ['16/10', 'Sorare', 'Backend engineer', 'Paris · CDI', B, true, 'LinkedIn', 'eca', 'Écartée', '', ''],
  ['15/10', 'Libeo', 'Développeur back-end', 'Nantes · CDI', P, true, W, 'env', 'Envoyée', '', '8:20:05:51'],
  ['15/10', 'Agicap', 'Développeur Python', 'Lyon · CDI', P, true, 'Lever', 'ech', 'Échec', '', ''],
  ['14/10', 'Swan', 'Développeur Python', 'Paris · CDI', P, true, W, '', 'À postuler', '', ''],
];

const CARRE = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', 'aria-hidden': true } as const;
const CHEVRON = <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
const BAS = <svg {...CARRE}><path d="m6 9 6 6 6-6" /></svg>;
const FLECHE = <span className="ico"><svg {...CARRE}><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>;

function Tableau() {
  const { onglet, ouvrir } = usePanneau();
  const [coches, setCoches] = useState<number[]>([0, 1]);
  const [ouverte, setOuverte] = useState(10);
  const [confirmer, setConfirmer] = useState(false);
  const cocher = (i: number) => setCoches((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]));
  const n = coches.length;

  return (
    <Fenetre id="tableau" as="div" className="tableau" titrePrise="Glisser pour détacher les Candidatures">
      <div className="outils">
        <button type="button" className="filtre" aria-haspopup="listbox" aria-label="Étape : Total"><span>Total</span>{CHEVRON}</button>
        <button type="button" className="filtre actif" aria-haspopup="listbox"><span><span className="lib">Métier</span>Développement · 150</span>{CHEVRON}</button>
        <button type="button" className="filtre" aria-haspopup="listbox"><span><span className="lib">Langue</span>toutes</span>{CHEVRON}</button>
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          <button type="button" className="action rouge" title={`Supprimer ${n} offres`} onClick={() => setConfirmer(true)}>
            <span className="ico"><svg {...CARRE} strokeLinejoin="miter"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></span>
            <span><span className="txt">Supprimer </span>({n})</span>
          </button>
          <button type="button" className={`action${onglet === 'reglages' ? ' allume' : ''}`} title="Réglages" onClick={() => ouvrir('reglages')}>
            <span className="ico"><svg {...CARRE} strokeLinejoin="miter"><polygon points="22.3,10.2 22.3,13.8 19.4,13.8 18.5,15.9 20.6,18.0 18.0,20.6 15.9,18.5 13.8,19.4 13.8,22.3 10.2,22.3 10.2,19.4 8.1,18.5 6.0,20.6 3.4,18.0 5.5,15.9 4.6,13.8 1.7,13.8 1.7,10.2 4.6,10.2 5.5,8.1 3.4,6.0 6.0,3.4 8.1,5.5 10.2,4.6 10.2,1.7 13.8,1.7 13.8,4.6 15.9,5.5 18.0,3.4 20.6,6.0 18.5,8.1 19.4,10.2" /><circle cx="12" cy="12" r="3" /></svg></span>
            <span className="txt">Réglages</span>
          </button>
          <button type="button" className="action plein" onClick={() => ouvrir('ajout')}>
            <span className="txt">Ajouter une offre</span>
            <span className="ico"><svg {...CARRE} strokeWidth={2.6} strokeLinejoin="miter"><path d="M12 5v14M5 12h14" /></svg></span>
          </button>
        </div>
      </div>
      {confirmer && (
        <Confirmer
          question={`Supprimer ${n} offres ?`}
          detail="Leurs dossiers sont effacés."
          action="Supprimer"
          onAnnuler={() => setConfirmer(false)}
          onConfirmer={() => {
            setCoches([]);
            setConfirmer(false);
          }}
        />
      )}
      <div className="defile">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" className="case" aria-label="Tout sélectionner" checked={n === LIGNES.length} onChange={() => setCoches(n === LIGNES.length ? [] : LIGNES.map((_, i) => i))} /></th>
              <th>Publiée</th><th>Entreprise</th><th>Intitulé</th><th>Lieu / contrat</th><th>Profil</th><th>Source</th><th>Étape</th><th>Timer</th>
            </tr>
          </thead>
          <tbody>
            {LIGNES.map(([publiee, ent, intitule, lieu, profil, auto, source, eo, etape, aide, timer], i) => (
              <tr
                key={i}
                className={coches.includes(i) ? 'coche' : i === ouverte && onglet === 'fiche' ? 'ouverte' : undefined}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('input,a')) return;
                  setOuverte(i);
                  ouvrir('fiche');
                }}
              >
                <td><input type="checkbox" className="case" aria-label={`Sélectionner ${ent}`} checked={coches.includes(i)} onChange={() => cocher(i)} /></td>
                <td className="d">{publiee}</td>
                <td><a href="#" className="ent">{ent}</a></td>
                <td>{intitule}</td>
                <td>{lieu}</td>
                <td className="d">{profil}{auto && <span className="auto">auto</span>}</td>
                <td className="d">{source}</td>
                <td title={aide || undefined}><span className={`eo${eo ? ' ' + eo : ''}`}>{etape}</span></td>
                <td className={`chrono${timer ? '' : ' vide'}`}>{timer || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <select aria-label="Lignes par page"><option>auto (16)</option><option>25</option><option>50</option></select>
        <nav className="pages" aria-label="Pages">
          <button type="button" className="pl" disabled aria-label="Page précédente">‹</button>
          <button type="button" className="pl actif" aria-current="page">1</button>
          <button type="button" className="pl">2</button>
          <button type="button" className="pl">3</button>
          <input type="text" className="aller" inputMode="numeric" placeholder="…" size={3} aria-label="Aller à la page" />
          <button type="button" className="pl">8</button>
          <button type="button" className="pl">9</button>
          <button type="button" className="pl">10</button>
          <button type="button" className="pl" aria-label="Page suivante">›</button>
        </nav>
      </div>
    </Fenetre>
  );
}

const FICHE = (
  <>
    <div className="f-tete">
      <h3>Ingénieur Python confirmé</h3>
      <p className="f-meta"><span>Welcome to the Jungle</span><span className="eo env">Envoyée</span><span className="t-rep">Réponse reçue</span><span>rattachée à une fiche</span></p>
    </div>
    <div className="section-f">
      <div className="grille-fiche">
        <div><span className="lib-champ">Entreprise</span><span>ALTEN <small>SIREN 412 078 316</small></span></div>
        <div><span className="lib-champ">Site de l&apos;entreprise</span><a href="#" className="lien">alten.fr</a></div>
        <div><span className="lib-champ">Publiée le</span><span>21/10</span></div>
        <div><span className="lib-champ">Lieu</span><span>Toulouse (31)</span></div>
        <div><span className="lib-champ">Contrat</span><span>CDI</span></div>
        <div><span className="lib-champ">Langue</span><span>FR</span></div>
        <div><span className="lib-champ">Métiers</span><span>Développement, Back-end</span></div>
        <div><span className="lib-champ">Candidater</span><a href="#" className="lien">alten.fr/candidater</a></div>
        <div><span className="lib-champ">Annonce</span><a href="#" className="lien">welcometothejungle.com</a></div>
      </div>
    </div>
    <div className="section-f">
      <h3>Candidature</h3>
      <dl className="def">
        <dt className="lib-champ">Envoyée le</dt><dd>22/10 à 09:41</dd>
        <dt className="lib-champ">Suivi</dt><dd><span className="carre bleu" /><b>En process</b> <span className="d">· depuis 6 jours · 1 relance(s)</span></dd>
        <dt className="lib-champ">Profil employé</dt><dd>developpeur-python</dd>
        <dt className="lib-champ">Profil de recherche</dt><dd>Développeur Python FR</dd>
        <dt className="lib-champ">Gestes</dt><dd>38 aboutis sur 41</dd>
        <dt className="lib-champ">CV déposé</dt><dd><a href="#" className="lien">CV-ALTEN-2210.pdf</a> <button type="button" className="lien-d">Changer</button></dd>
        <dt className="lib-champ">Lettre</dt><dd><span className="d">non jointe</span> <button type="button" className="lien-d">Choisir</button></dd>
        <dt className="lib-champ">Compétences retenues</dt><dd><span className="puces">{['Python', 'Django', 'PostgreSQL', 'Docker', 'API REST'].map((c) => <span key={c} className="puce">{c}</span>)}</span></dd>
        <dt className="lib-champ">Compétences manquantes</dt><dd><span className="puces">{['Kubernetes', 'Kafka'].map((c) => <span key={c} className="puce manque">{c}<button type="button" aria-haspopup="dialog" title={`Ajouter « ${c} » au profil`}>+</button></span>)}</span></dd>
        <dt className="lib-champ">Sous-entendues</dt><dd><span className="puces">{['Git', 'Tests unitaires', 'Anglais technique'].map((c) => <span key={c} className="puce implicite">{c}</span>)}</span></dd>
      </dl>
    </div>
    <details className="bloc-f"><summary>Préparation de l&apos;entretien{BAS}</summary><div><p className="texte-f">Aucun rendez-vous proposé pour l&apos;instant : la préparation se rédige quand un mail en propose un.</p><button type="button" className="action">Préparer</button></div></details>
    <details className="bloc-f"><summary>Courrier<span className="compteur">2</span>{BAS}</summary><div><ul className="liste-f"><li>Votre candidature chez ALTEN<span className="d">rh@exemple.fr · 22/10</span></li><li>Échange téléphonique<span className="d">rh@exemple.fr · 25/10</span></li></ul></div></details>
    <details className="bloc-f"><summary>L&apos;annonce{BAS}</summary><div><p className="texte-f">Au sein de notre centre de Toulouse, vous concevez et maintenez des services back-end en Python pour des clients de l&apos;aéronautique : API REST, traitements de données, tests et mise en production.</p></div></details>
  </>
);

const REGLAGES = (
  <div className="section-f">
    <label className="reglage">Candidatures par lancement<input className="saisie" type="number" defaultValue={5} /></label>
    <label className="reglage">Candidatures en même temps<input className="saisie" type="number" defaultValue={2} /></label>
    <label className="reglage">Timeout (s)<input className="saisie" type="number" defaultValue={600} /></label>
    <label className="inter">Créer un compte si l&apos;ATS l&apos;exige<input type="checkbox" defaultChecked /></label>
    <label className="inter">Rejouer le chemin appris<input type="checkbox" defaultChecked /></label>
    <label className="inter">Créer la fiche entreprise<input type="checkbox" defaultChecked /></label>
  </div>
);

const AJOUT = (
  <>
    <div className="section-f">
      <div className="champ"><label htmlFor="aj-url">Adresse de l&apos;offre</label><input id="aj-url" className="saisie" type="url" placeholder="https://…" defaultValue="https://alten.fr/offres/2210" /></div>
      <div className="grille-2">
        <div className="champ"><label htmlFor="aj-ent">Entreprise</label><input id="aj-ent" className="saisie" defaultValue="ALTEN" /></div>
        <div className="champ"><label htmlFor="aj-int">Intitulé</label><input id="aj-int" className="saisie" defaultValue="Développeur Python" /></div>
      </div>
      <div className="champ"><label htmlFor="aj-prof">Profil du candidat</label><select id="aj-prof" className="saisie"><option>developpeur-python</option><option>fullstack-js</option><option>backend-en</option></select></div>
    </div>
    <div className="section-f">
      <h3>Options</h3>
      <label className="inter">Candidature spontanée<input type="checkbox" /></label>
      <label className="inter">Postuler sans tri<input type="checkbox" /></label>
    </div>
  </>
);

// La planche du prototype : Activité, Candidatures et panneau à onglets, mêmes données fixes
export function Planche() {
  return (
    <Dock id="essai-candidatures" principal="tableau" panneau="fiche">
      <Activite donnees={ACTIVITE} cachees={['entretien']} />
      <Tableau />
      <Panneau
        onglets={[
          {
            cle: 'fiche', titre: 'Fiche · ALTEN', label: 'Fiche offre · ALTEN', corps: FICHE,
            pied: <><button type="button" className="action gauche" aria-haspopup="dialog">Voir la fiche entreprise</button><a href="#" className="action plein">Page de l&apos;offre{FLECHE}</a></>,
          },
          { cle: 'reglages', titre: 'Réglages', label: 'Réglages · Candidatures', corps: REGLAGES, pied: <><button type="button" className="action">Annuler</button><button type="button" className="action plein">Enregistrer{FLECHE}</button></> },
          { cle: 'ajout', titre: 'Ajouter', label: 'Ajouter une offre', corps: AJOUT, pied: <><button type="button" className="action">Ajouter à la file</button><button type="button" className="action plein">Postuler maintenant{FLECHE}</button></> },
        ]}
      />
    </Dock>
  );
}
