'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Dock, usePanneau } from '../../dock/Dock';
import { Activite } from '../../activite/Activite';
import { messageDe } from '../../partage/FicheEntreprise';
import type { ProprietesPage } from '../liste';
import {
  ActionOnglet, CorpsReglages, FLECHE, ICONES, PanneauFiches, PiedReglages, TableauFiches, arbreFiches, useAvis, useReglages,
  type ChampReglage, type Confirmation, type Dire,
} from './fiches';

const CHAMPS: ChampReglage[] = [
  { cle: 'codes_naf', libelle: 'Secteurs visés', type: 'catalogue', catalogue: 'naf', aide: 'Les activités interrogées dans le registre.' },
  { cle: 'departements', libelle: 'Départements', type: 'catalogue', catalogue: 'departements', aide: 'Vide : toute la France.' },
  { cle: 'communes', libelle: 'Villes', type: 'catalogue', catalogue: 'communes', aide: "S'ajoute aux départements. Vide : aucun filtre de ville." },
  { cle: 'effectif_min_salaries', libelle: 'Effectif minimum', type: 'nombre', aide: 'Écarte les structures trop petites pour embaucher un junior.' },
  { cle: 'pages_par_collecte', libelle: 'Pages par collecte', type: 'nombre', aide: "25 entreprises par page et par code NAF. 0 : lire jusqu'au bout du listing, sous les plafonds." },
  { cle: 'collecte_page_max', libelle: 'Page maximale', type: 'nombre', aide: "Ne jamais dépasser cette page du registre. 0 : jusqu'à la dernière qui répond." },
  { cle: 'plafond_entreprises', libelle: "Plafond d'entreprises", type: 'nombre', aide: "Total en base à ne pas dépasser ; la collecte s'arrête net une fois atteint. 0 : pas de plafond." },
  { cle: 'collecte_page_depart', libelle: 'Reprendre à la page', type: 'nombre', aide: "0 : là où la collecte s'était arrêtée — la page en cours est indiquée sous ce bloc." },
  { cle: 'extensions_domaines', libelle: 'Extensions de site acceptées', type: 'liste', exemple: '.fr, .com', aide: 'Ex. .fr, .com, .group — tout le reste est écarté (clones d’annuaires en .wf, .xyz…).' },
];
const ARBRE = arbreFiches(() => null);

type Candidat = { siren: string; nom: string; secteur: string | null; localisation: string | null; effectif: string | null; deja_en_base: boolean };

// Importer une société nommément : par SIREN elle est créée, par nom Sirene propose des candidats
function useImport(dire: Dire, relire: () => void) {
  // La recherche et ses candidats restent d'une visite à l'autre
  const [requete, setRequete] = useState(() => repris('collecte:import:requete', ''));
  const [candidats, setCandidats] = useState(() => repris<Candidat[] | null>('collecte:import:candidats', null));
  useGarder('collecte:import', { requete, candidats });
  const [occupe, setOccupe] = useState(false);
  const chercher = async (q: string) => {
    if (!q.trim()) return dire('Indiquez un nom ou un SIREN.', true);
    setOccupe(true);
    try {
      const r = await appeler<{ siren?: string; nom?: string; deja_en_base?: boolean; candidats?: Candidat[] }>('/entreprises/importer', { methode: 'POST', corps: { requete: q } });
      if (r.siren) {
        dire(r.deja_en_base ? `${r.nom} est déjà en base (${r.siren}).` : `${r.nom} importée (${r.siren}).`, r.deja_en_base);
        setCandidats((c) => c && c.map((x) => (x.siren === r.siren ? { ...x, deja_en_base: true } : x)));
        relire();
      } else {
        setCandidats(r.candidats ?? []);
        if (!r.candidats?.length) dire('Aucune société active de ce nom dans Sirene.', true);
      }
    } catch (e) {
      dire(messageDe(e), true);
    }
    setOccupe(false);
  };
  return { requete, setRequete, candidats, setCandidats, occupe, chercher };
}
type Import = ReturnType<typeof useImport>;

function CorpsImport({ i }: { i: Import }) {
  return (
    <div className="pf">
      <div className="section-f">
        <div className="champ">
          <label htmlFor="im-soc">Nom ou SIREN</label>
          <input id="im-soc" className="saisie" value={i.requete} placeholder="Exemple SA — ou 123456789" onChange={(e) => i.setRequete(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !i.occupe && i.chercher(i.requete)} />
        </div>
        <p className="aide-champ">Cherchée dans Sirene et créée telle quelle, sans passer par les filtres de la collecte.</p>
      </div>
      {i.candidats && i.candidats.length > 0 && (
        <div className="section-f">
          <h3>Laquelle ?</h3>
          <ul className="liste-f resultats">
            {i.candidats.map((c) => (
              <li key={c.siren}>
                <span className="soc"><b>{c.nom}</b><span className="siren">{c.siren}</span></span>
                <span className="soc-d">{c.secteur ?? '—'}<br />{[c.localisation, c.effectif].filter(Boolean).join(' · ') || '—'}</span>
                {c.deja_en_base ? <span className="tag-f">déjà en base</span>
                  : <button type="button" className="action" disabled={i.occupe} onClick={() => i.chercher(c.siren)}><span className="ico">{ICONES.importer}</span>Importer</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PiedImport({ i }: { i: Import }) {
  const { fermer } = usePanneau();
  return (
    <>
      <button type="button" className="action" onClick={() => {
        i.setRequete('');
        i.setCandidats(null);
        fermer();
      }}>Annuler</button>
      <button type="button" className="action plein" disabled={i.occupe} onClick={() => i.chercher(i.requete)}>Chercher{FLECHE}</button>
    </>
  );
}

export default function PageCollecte(_: ProprietesPage) {
  const { avis, dire } = useAvis();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [version, setVersion] = useState(0);
  const [curseur, setCurseur] = useState(() => repris<Record<string, number> | null>('collecte:curseur', null));
  useGarder('collecte', { curseur });
  const relire = useCallback(() => setVersion((v) => v + 1), []);
  const reglages = useReglages('collecte', CHAMPS, dire);
  const imp = useImport(dire, relire);

  // Où en est la collecte, secteur par secteur
  const lireCurseur = useCallback(() => {
    appeler<Record<string, number>>('/pipeline/curseur-collecte').then(setCurseur).catch((e) => dire(messageDe(e), true));
  }, [dire]);
  useEffect(() => {
    lireCurseur();
  }, [lireCurseur]);
  const codes = Object.keys(curseur ?? {}).sort();
  const prochaine = curseur && (codes.length
    ? <>Prochaine page — {codes.map((c, n) => <Fragment key={c}>{n > 0 && ' · '}<b>{c}</b> p.{curseur[c]}</Fragment>)}</>
    : 'Aucune page lue : la collecte partira de la page 1.');

  const collecter = async () => {
    try {
      await appeler('/pipeline/collecter', { methode: 'POST', corps: {} });
      dire('Collecte lancée.');
      setTimeout(lireCurseur, 4000);
    } catch (e) {
      dire(messageDe(e), true);
    }
  };
  const reparer = () => setConfirmation({
    question: 'Réparer les sites de toutes les fiches ?',
    detail: "Chaque site officiel est recalculé avec le barème courant, puis les liens qui ne répondent qu'en « www. » sont redressés ; les fiches dont le site change repartent en Collecter. Compter quelques minutes.",
    action: 'Réparer',
    faire: async () => {
      try {
        await appeler('/entreprises/resoudre-sites', { methode: 'POST' });
        dire('Réparation lancée — suivez le journal.');
      } catch (e) {
        dire(messageDe(e), true);
      }
    },
  });

  return (
    <Dock id="collecte" principal="fiches" arbre={ARBRE} fenetres={{ fiches: { mini: [470, 220] } }} panneau="reglages">
      <Activite />
      <TableauFiches section="collecte" titre="Fiches entreprises" avis={avis} note={prochaine} version={version} selection={selection} choisir={setSelection}
        confirmation={confirmation} annuler={() => setConfirmation(null)}
        actions={(
          <>
            <ActionOnglet cle="reglages" libelle="Réglages" icone={ICONES.reglages} />
            <ActionOnglet cle="importer" libelle="Importer" icone={ICONES.importer} titre="Crée la fiche d'une société nommément, sans passer par les filtres de la collecte." />
            <button type="button" className="action" aria-haspopup="dialog" title="Re-résout le site officiel de chaque fiche, puis redresse les liens qui ne répondent qu'en « www. »." onClick={reparer}>
              <span className="ico">{ICONES.reparer}</span><span className="txt">Réparer Sites</span>
            </button>
            <button type="button" className="action plein" title="Interroge Sirene selon les secteurs réglés." onClick={collecter}><span className="txt">Collecter</span>{FLECHE}</button>
          </>
        )} />
      <PanneauFiches avant={[
        { cle: 'reglages', titre: 'Réglages', label: 'Réglages · Collecte Sirene', corps: <CorpsReglages champs={CHAMPS} r={reglages} aide={prochaine} />, pied: <PiedReglages r={reglages} /> },
        { cle: 'importer', titre: 'Importer', label: 'Importer une société', corps: <CorpsImport i={imp} />, pied: <PiedImport i={imp} /> },
      ]} />
    </Dock>
  );
}
