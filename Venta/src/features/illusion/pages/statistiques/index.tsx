'use client';

import '../metriques/metriques.css';
import './statistiques.css';
import { useCallback, useEffect, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Fenetre, usePanneau } from '../../dock/Dock';
import { Panneau, type Onglet } from '../../dock/Panneau';
import { ongletFicheEntreprise } from '../../partage/FicheEntreprise';
import { ongletFicheOffre } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import {
  Carte, CarteWinrate, CorpsFantomes, CorpsMetiers, CorpsWinrate, jours, nombre, pluriel, pourcent, useLignesQuiTiennent, winrate,
  type Bilan, type Fantome, type PageMetriques,
} from '../metriques/panneaux';
import { useEchap } from '../commun';
import { MenuFiltre } from '../../elements/Menu';
import { Action } from '../../elements/Action';
import { message } from '../../elements/format';
import { PageDock } from '../../activite/PageDock';

// Ce que /metriques/utilisateur rend : les chiffres du compte, sans aucun coût
type PageStats = Pick<PageMetriques, 'periode' | 'profils' | 'metiers' | 'postes' | 'fantomes'> & {
  resume: Pick<PageMetriques['resume'], 'offres' | 'envoyees' | 'reponses' | 'entretiens' | 'taux_reponse' | 'taux_entretien' | 'delai_median_jours'>;
};

const RACCOURCIS: [number, string][] = [[7, '7 jours'], [30, '30 jours'], [90, '90 jours'], [0, 'Tout']];
const iso = (d: Date) => d.toLocaleDateString('sv-SE');
const requete = (j: number, compte: string) => new URLSearchParams(Object.entries({
  debut: j ? iso(new Date(Date.now() - (j - 1) * 864e5)) : '', fin: j ? iso(new Date()) : '', compte,
}).filter(([, v]) => v)).toString();
const DETAILS: Record<string, string> = { winrate: 'Winrate des profils · détail', metiers: 'Métiers et postes', fantomes: 'Offres fantômes' };

export default function PageStatistiques({ compte: moi }: ProprietesPage) {
  return (
    <PageDock id="statistiques" principal="metriques" panneau={null}
      fenetres={{ metriques: { mini: [560, 420], pref: [760, 480], flot: [920, 620] }, panneau: { flot: [480, 600] } }}>
      <Statistiques admin={moi.admin} />
    </PageDock>
  );
}

function Statistiques({ admin }: { admin: boolean }) {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const [duree, setDuree] = useState(() => repris<number>('statistiques:jours', 30));
  // « » : mon compte ; l'admin peut lire celui de n'importe qui
  const [compte, setCompte] = useState(() => repris<string>('statistiques:compte', ''));
  const [comptes, setComptes] = useState<string[]>([]);
  const [page, setPage] = useState(() => repris<PageStats | null>('statistiques:page', null));
  const [erreur, setErreur] = useState('');
  const [fantomes, setFantomes] = useState<Fantome[] | null>(null);
  const [erreurFantomes, setErreurFantomes] = useState('');
  useGarder('statistiques', { jours: duree, compte, page });

  useEffect(() => {
    let vivant = true;
    const q = requete(duree, compte);
    appeler<PageStats>(`/metriques/utilisateur?${q}`).then((p) => {
      if (!vivant) return;
      setPage(p);
      setErreur('');
    }).catch((e) => {
      if (vivant) setErreur(message(e));
    });
    appeler<Fantome[]>(`/vues/metriques/fantomes?${q}`).then((f) => {
      if (!vivant) return;
      setFantomes(f);
      setErreurFantomes('');
    }).catch((e) => {
      if (vivant) setErreurFantomes(message(e));
    });
    return () => {
      vivant = false;
    };
  }, [duree, compte]);

  useEffect(() => {
    if (admin) appeler<string[]>('/metriques/comptes').then(setComptes).catch(() => undefined);
  }, [admin]);

  useEchap(() => {
    if (onglet) fermer();
  });
  const ouvrirDetail = useCallback((d: string) => ouvrir('detail', d), [ouvrir]);
  const voirOffre = (c: string) => ouvrir('fiche-offre', c);
  const voirEntreprise = (s: string) => ouvrir('fiche-entreprise', s);

  const corps: Record<string, React.ReactNode> = page ? {
    winrate: <CorpsWinrate page={page} />, metiers: <CorpsMetiers page={page} />,
    fantomes: <CorpsFantomes page={page} fantomes={fantomes} erreur={erreurFantomes} voir={voirOffre} />,
  } : {};
  const elements = {
    detail: (d: string): Onglet | null => (DETAILS[d] ? {
      cle: 'detail', titre: DETAILS[d], corps: corps[d] ?? <p className="texte-f">Lecture des statistiques…</p>,
      pied: <Action onClick={fermer}>Fermer</Action>,
    } : null),
    'fiche-offre': (c: string) => ongletFicheOffre(c, { ouvrirEntreprise: voirEntreprise }),
    'fiche-entreprise': (s: string) => ongletFicheEntreprise(s, { ouvrirOffre: voirOffre }),
  };
  const [premier, ...autres] = comptes;

  return (
    <>
      <Fenetre id="metriques" className="tableau statistiques" aria-label="Statistiques" titrePrise="Glisser pour détacher vos statistiques">
        <div className="outils">
          {comptes.length > 1 && (
            <MenuFiltre lib="Compte" valeur={compte || 'Le mien'} actif={!!compte} courant={compte} choisir={setCompte}
              choix={[{ cle: '', libelle: `Le mien · ${premier}` }, ...autres.map((c) => ({ cle: c, libelle: c }))]} />
          )}
          <span className="raccourcis" role="group" aria-label="Période">
            {RACCOURCIS.map(([j, lib]) => (
              <button key={j} type="button" className={`filtre${duree === j ? ' actif' : ''}`} aria-pressed={duree === j} onClick={() => setDuree(j)}>{lib}</button>
            ))}
          </span>
        </div>
        {page ? <Tableau page={page} ouvert={onglet === 'detail' ? objet : null} ouvrir={ouvrirDetail} />
          : <p className={`attente-m${erreur ? ' erreur' : ''}`} role={erreur ? 'alert' : 'status'}>{erreur ? `Statistiques illisibles. ${erreur}` : 'Lecture des statistiques…'}</p>}
      </Fenetre>
      <Panneau elements={elements} onglets={[]} />
    </>
  );
}

function Tableau({ page, ouvert, ouvrir }: { page: PageStats; ouvert: string | null; ouvrir: (d: string) => void }) {
  const r = page.resume;
  const tuiles: [string, string, string, string?][] = [
    ['c-offres', 'Offres détectées', nombre(r.offres)], ['c-envoi', 'Envoyées', nombre(r.envoyees)],
    ['c-reponse', 'Réponses %', pourcent(r.taux_reponse), `${nombre(r.reponses)} réponse(s)`],
    ['c-entretien', 'Entretiens %', pourcent(r.taux_entretien), `${nombre(r.entretiens)} entretien(s)`],
    ['', 'Délai de réponse', jours(r.delai_median_jours), 'Délai médian entre l’envoi et la première réponse'],
  ];
  return (
    <div className="metriques">
      <div className="tuiles-m">
        {tuiles.map(([classe, lib, valeur, titre]) => (
          <div key={lib} className={`tuile-m${classe ? ` ${classe}` : ''}`} title={titre}><p className="etiquette">{lib}</p><b>{valeur}</b></div>
        ))}
      </div>
      <div className="cartes">
        <CarteWinrate page={page} ouvert={ouvert} ouvrir={ouvrir} />
        <CarteBilans titre="Métiers" colonne="Métier" detail="metiers" d={pluriel(page.metiers.length, 'métier')} ouvert={ouvert} ouvrir={ouvrir}
          lignes={page.metiers.map((b) => ({ ...b, nom: b.metier }))} cle={page} />
        <CarteBilans titre="Postes" colonne="Poste" detail="metiers" d={pluriel(page.postes.length, 'intitulé')} ouvert={ouvert} ouvrir={ouvrir}
          lignes={page.postes.map((b) => ({ ...b, nom: b.poste }))} cle={page} />
        <CarteBilans titre="Publication" colonne="Publication" detail="fantomes" d="Postes neufs ou republiés" ouvert={ouvert} ouvrir={ouvrir}
          lignes={page.fantomes.map((b) => ({ ...b, nom: b.publication }))} cle={page} />
      </div>
    </div>
  );
}

// Une carte de bilans : nom, envois et winrate, autant de lignes qu'il en tient
function CarteBilans({ titre, colonne, detail, d, lignes, cle, ouvert, ouvrir }: {
  titre: string; colonne: string; detail: string; d: string; lignes: (Bilan & { nom: string })[]; cle: unknown; ouvert: string | null; ouvrir: (d: string) => void;
}) {
  const boite = useLignesQuiTiennent(cle);
  return (
    <Carte titre={titre} detail={detail} d={d} ouvert={ouvert} ouvrir={ouvrir}>
      <div ref={boite} className="corps-carte">
        {lignes.length ? (
          <table className="compact t-stats">
            <thead><tr><th>{colonne}</th><th>Offres</th><th>Envoyées</th><th>Entretiens</th></tr></thead>
            <tbody>
              {lignes.map((b, i) => (
                <tr key={i} data-ligne><td title={b.nom}>{b.nom}</td><td>{nombre(b.offres)}</td><td>{nombre(b.envoyees)}</td><td>{winrate(b)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="vide-m">Aucune offre dans la période.</p>}
      </div>
    </Carte>
  );
}
