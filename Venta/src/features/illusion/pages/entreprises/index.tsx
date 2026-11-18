'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { usePanneau } from '../../dock/Dock';
import type { ProprietesPage } from '../liste';
import { FLECHE } from '../../partage/FicheEntreprise';
import { PageFiches, useEtatFiches, CorpsAtelier, CorpsDejaBase, CorpsReglages, Lots, PiedAtelier, PiedDejaBase, PiedReglages, arbreFiches, useAtelier, useBriques, useReglages, type ChampReglage, type Lot } from '../collecte/fiches';
import { useGeste } from '../commun';
import { Action } from '../../elements/Action';
import type { Dire } from '../../elements/Avis';
import { ActionOnglet } from '../../elements/Groupes';
import { ChampListe, ChampSaisie, SectionFiche } from '../../elements/Champ';
import { ICONES } from '../../elements/icones';
import { message } from '../../elements/format';

// Collecte Sirene, parser et audit : les mêmes fiches, une seule page
const COLLECTE: ChampReglage[] = [
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
const PARSER: ChampReglage[] = [
  { cle: 'parser_profondeur', libelle: 'Profondeur de crawl', type: 'nombre', aide: "Combien de clics le parser s'autorise depuis l'accueil. 1 : l'accueil seul. 3 : il descend jusqu'aux pages « Nous rejoindre » et « Contact »." },
  { cle: 'parser_seuil', libelle: "Seuil page d'offres", type: 'nombre', aide: "Score minimum pour qu'une page soit retenue comme LA page d'offres. Trop bas, une page « rejoignez-nous » sans annonce est retenue ; trop haut, aucune ne l'est." },
  { cle: 'parser_timeout_secondes', libelle: 'Timeout (s)', type: 'nombre' },
];
const AUDIT: ChampReglage[] = [
  { cle: 'intitule_poste', libelle: 'Poste visé', type: 'texte', exemple: 'Développeur back-end', aide: "Cadre l'analyse sur ce que le poste demande." },
  { cle: 'audit_mois', libelle: "Fenêtre d'actualités (mois)", type: 'nombre' },
  { cle: 'audit_timeout_secondes', libelle: 'Timeout (s)', type: 'nombre' },
  { cle: 'audit_modele', libelle: 'Modèle', type: 'modele', admin: true, aide: 'Un des modèles définis dans les Paramètres serveur.' },
  { cle: 'audit_analyse', libelle: 'Analyse par le modèle', type: 'booleen', aide: 'Désactivé : collecte seule, fiche préalable sans dépenser de tokens.' },
];
const REGLAGES = [...COLLECTE, ...PARSER, ...AUDIT];
// Le parser, puis les trois temps de l'audit, bloqués entre eux
const LOTS: Lot[] = [
  { brique: 'parser', famille: 'parser', libelle: 'Parser', aide: "Trouve le site, le lit, et fait avancer l'état de la fiche", icone: ICONES.executer },
  { brique: 'audit-agregation', famille: 'audit', libelle: 'Audit Brut', icone: ICONES.loupe,
    aide: "Rassemble registres, site et actualités SANS appeler le modèle : aucun token dépensé. Prend les fiches qui n'ont pas encore de brut" },
  { brique: 'audit', famille: 'audit', libelle: 'Audit Net', icone: ICONES.executer,
    aide: "Met en forme le brut DÉJÀ collecté, sans le recollecter. Prend les fiches qui ont un brut et pas encore d'analyse" },
  { brique: 'audit-actualisation', famille: 'audit', libelle: 'Actualiser Audit', icone: ICONES.reprendre,
    aide: "Refait le brut de toutes les fiches qui en ont un — et refait l'analyse seulement là où il y en avait une" },
];
// Panneau à 560 px (480 sous 1366 px) : les gestes de l'audit y tiennent
const ARBRE = arbreFiches((l) => (l <= 1366 ? 480 : 560));

type Candidat = { siren: string; nom: string; secteur: string | null; localisation: string | null; effectif: string | null; deja_en_base: boolean };

// Par SIREN la société est créée, par nom Sirene propose des candidats
function useImport(dire: Dire, relire: () => void) {
  // La recherche et ses candidats restent d'une visite à l'autre
  const [requete, setRequete] = useState(() => repris('entreprises:import:requete', ''));
  const [candidats, setCandidats] = useState(() => repris<Candidat[] | null>('entreprises:import:candidats', null));
  useGarder('entreprises:import', { requete, candidats });
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const chercher = (q: string) => {
    if (!q.trim()) return dire('Indiquez un nom ou un SIREN.', true);
    return geste(async () => {
      const r = await appeler<{ siren?: string; nom?: string; deja_en_base?: boolean; candidats?: Candidat[] }>('/entreprises/importer', { methode: 'POST', corps: { requete: q } });
      if (r.siren) {
        dire(r.deja_en_base ? `${r.nom} est déjà en base (${r.siren}).` : `${r.nom} importée (${r.siren}).`, r.deja_en_base);
        setCandidats((c) => c && c.map((x) => (x.siren === r.siren ? { ...x, deja_en_base: true } : x)));
        relire();
      } else {
        setCandidats(r.candidats ?? []);
        if (!r.candidats?.length) dire('Aucune société active de ce nom dans Sirene.', true);
      }
    });
  };
  return { requete, setRequete, candidats, setCandidats, occupe, chercher };
}
type Import = ReturnType<typeof useImport>;

function CorpsImport({ i }: { i: Import }) {
  return (
    <div className="pf">
      <div className="section-f">
        <ChampSaisie id="im-soc" libelle="Nom ou SIREN" value={i.requete} placeholder="Exemple SA — ou 123456789" onChange={(e) => i.setRequete(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !i.occupe && i.chercher(i.requete)} />
        <p className="aide-champ">Cherchée dans Sirene et créée telle quelle, sans passer par les filtres de la collecte.</p>
      </div>
      {i.candidats && i.candidats.length > 0 && (
        <SectionFiche titre="Laquelle ?">
          <ul className="liste-f resultats">
            {i.candidats.map((c) => (
              <li key={c.siren}>
                <span className="soc"><b>{c.nom}</b><span className="siren">{c.siren}</span></span>
                <span className="soc-d">{c.secteur ?? '—'}<br />{[c.localisation, c.effectif].filter(Boolean).join(' · ') || '—'}</span>
                {c.deja_en_base ? <span className="tag-f">déjà en base</span>
                  : <Action icone={ICONES.importer} disabled={i.occupe} onClick={() => i.chercher(c.siren)}>Importer</Action>}
              </li>
            ))}
          </ul>
        </SectionFiche>
      )}
    </div>
  );
}

function PiedImport({ i }: { i: Import }) {
  const { fermer } = usePanneau();
  return (
    <>
      <Action onClick={() => {
        i.setRequete('');
        i.setCandidats(null);
        fermer();
      }}>Annuler</Action>
      <Action plein disabled={i.occupe} onClick={() => i.chercher(i.requete)}>Chercher{FLECHE}</Action>
    </>
  );
}

export default function PageEntreprises(_: ProprietesPage) {
  const etat = useEtatFiches();
  const { dire, selection, setConfirmation, relire } = etat;
  const [curseur, setCurseur] = useState(() => repris<Record<string, number> | null>('entreprises:curseur', null));
  // L'atelier choisi pour « Exécuter » reste d'une visite à l'autre
  const [execute, setExecute] = useState(() => repris<'parser' | 'audit'>('entreprises:execute', 'parser'));
  useGarder('entreprises', { curseur, execute });
  const briques = useBriques('entreprises');
  const parser = useAtelier('parser', dire, relire);
  const audit = useAtelier('audit', dire, relire);
  const atelier = execute === 'parser' ? parser : audit;
  const reglages = useReglages('entreprises', REGLAGES, dire, () => {
    parser.recharger();
    audit.recharger();
  });
  const imp = useImport(dire, relire);

  // Où en est la collecte, secteur par secteur
  const lireCurseur = useCallback(() => {
    appeler<Record<string, number>>('/pipeline/curseur-collecte').then(setCurseur).catch((e) => dire(message(e), true));
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
      dire(message(e), true);
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
        dire(message(e), true);
      }
    },
  });

  return (
    <PageFiches section="entreprises" etat={etat} arbre={ARBRE} fenetres={{ panneau: { pref: [560, 320], flot: [560, 600] } }} panneau="reglages" note={prochaine}
      actions={(
          <>
            <ActionOnglet cle="reglages" icone={ICONES.reglages} title="Réglages de la collecte, du parser et de l'audit">Réglages</ActionOnglet>
            <ActionOnglet cle="importer" icone={ICONES.importer} title="Crée la fiche d'une société nommément, sans passer par les filtres de la collecte.">Importer</ActionOnglet>
            <ActionOnglet cle="executer" icone={ICONES.executer} title="Lance le parser ou l'audit à la main sur une entreprise.">Exécuter</ActionOnglet>
            <Action icone={ICONES.reparer} txt aria-haspopup="dialog" title="Re-résout le site officiel de chaque fiche, puis redresse les liens qui ne répondent qu'en « www. »." onClick={reparer}>Réparer Sites
            </Action>
            <Lots lots={LOTS} actives={briques.actives} selection={selection} dire={dire} relire={briques.lire} demander={setConfirmation} />
            <Action plein title="Interroge Sirene selon les secteurs réglés." onClick={collecter}><span className="txt">Collecter</span>{FLECHE}</Action>
          </>
      )}
      avant={[
        { cle: 'reglages', titre: 'Réglages', label: 'Réglages · Entreprises', pied: <PiedReglages r={reglages} />, corps: (
          <>
            <SectionFiche titre="Collecte Sirene"><CorpsReglages champs={COLLECTE} r={reglages} aide={prochaine} /></SectionFiche>
            <SectionFiche titre="Parser"><CorpsReglages champs={PARSER} r={reglages} /></SectionFiche>
            <SectionFiche titre="Audit"><CorpsReglages champs={AUDIT} r={reglages} /></SectionFiche>
          </>
        ) },
        { cle: 'importer', titre: 'Importer', label: 'Importer une société', corps: <CorpsImport i={imp} />, pied: <PiedImport i={imp} /> },
        { cle: 'executer', titre: 'Exécuter', label: `Exécuter · ${execute === 'parser' ? 'parser' : 'audit'}`, pied: <PiedAtelier at={atelier} />, corps: (
          <>
            <div className="pf"><div className="section-f">
              <ChampListe id="ex-brique" libelle="Brique" value={execute} onChange={(e) => setExecute(e.target.value as 'parser' | 'audit')}>
                <option value="parser">Parser</option>
                <option value="audit">Audit</option>
              </ChampListe>
            </div></div>
            <CorpsAtelier at={atelier} />
          </>
        ) },
        ...(parser.dejaBase ? [{ cle: 'deja-base', titre: 'Déjà en base', label: 'Cette entreprise est déjà en base', corps: <CorpsDejaBase at={parser} />, pied: <PiedDejaBase at={parser} /> }] : []),
      ]} />
  );
}
