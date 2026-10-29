'use client';

import { useCallback, useState } from 'react';
import { Dock } from '../../dock/Dock';
import { Activite } from '../../activite/Activite';
import type { ProprietesPage } from '../liste';
import {
  ActionOnglet, CorpsAtelier, CorpsReglages, ICONES, Lots, PiedAtelier, PanneauFiches, PiedReglages, TableauFiches,
  arbreFiches, useAtelier, useAvis, useBriques, useReglages, type ChampReglage, type Confirmation, type Lot,
} from '../collecte/fiches';

const CHAMPS: ChampReglage[] = [
  { cle: 'intitule_poste', libelle: 'Poste visé', type: 'texte', exemple: 'Développeur back-end', aide: "Cadre l'analyse sur ce que le poste demande." },
  { cle: 'audit_mois', libelle: "Fenêtre d'actualités (mois)", type: 'nombre' },
  { cle: 'audit_timeout_secondes', libelle: 'Timeout (s)', type: 'nombre' },
  { cle: 'audit_modele', libelle: 'Modèle', type: 'modele', admin: true, aide: 'Un des modèles définis dans les Paramètres serveur.' },
  { cle: 'audit_analyse', libelle: 'Analyse par le modèle', type: 'booleen', aide: 'Désactivé : collecte seule, fiche préalable sans dépenser de tokens.' },
];
// Les trois temps de l'audit écrivent la même fiche : une même famille, bloqués entre eux
const LOTS: Lot[] = [
  { brique: 'audit-agregation', famille: 'audit', libelle: 'Audit Brut', icone: ICONES.loupe,
    aide: "Rassemble registres, site et actualités SANS appeler le modèle : aucun token dépensé. Prend les fiches qui n'ont pas encore de brut" },
  { brique: 'audit', famille: 'audit', libelle: 'Audit Net', icone: ICONES.executer,
    aide: "Met en forme le brut DÉJÀ collecté, sans le recollecter. Prend les fiches qui ont un brut et pas encore d'analyse" },
  { brique: 'audit-actualisation', famille: 'audit', libelle: 'Actualiser Audit', icone: ICONES.actualiser,
    aide: "Refait le brut de toutes les fiches qui en ont un — et refait l'analyse seulement là où il y en avait une" },
];
// La fiche s'ouvre dans un panneau élargi à 560 px, 480 px à 1366 px et moins : ses gestes tiennent sur leur ligne
const ARBRE = arbreFiches((l) => (l <= 1366 ? 480 : 560));

export default function PageAudit(_: ProprietesPage) {
  const { avis, dire } = useAvis();
  const [siren, setSiren] = useState<string | null>(null);
  const [cleOffre, setCleOffre] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [version, setVersion] = useState(0);
  const relire = useCallback(() => setVersion((v) => v + 1), []);
  const briques = useBriques();
  const atelier = useAtelier('audit', dire, relire);
  const reglages = useReglages(CHAMPS, dire, atelier.recharger);

  return (
    <Dock id="audit" principal="fiches" arbre={ARBRE} fenetres={{ fiches: { mini: [470, 220] }, panneau: { pref: [560, 320], flot: [560, 600] } }} panneau={null}>
      <Activite />
      <TableauFiches titre="Fiches entreprises" avis={avis} version={version} selection={selection} choisir={setSelection}
        siren={siren} ouvrirFiche={setSiren} confirmation={confirmation} annuler={() => setConfirmation(null)}
        actions={(
          <>
            <Lots lots={LOTS} actives={briques.actives} selection={selection} dire={dire} relire={briques.lire} demander={setConfirmation} />
            <ActionOnglet cle="executer" libelle="Exécuter" icone={ICONES.executer} titre="Lance l'audit à la main sur une entreprise." />
            <ActionOnglet cle="reglages" libelle="Réglages" icone={ICONES.reglages} />
          </>
        )} />
      <PanneauFiches siren={siren} choisirSiren={setSiren} cleOffre={cleOffre} choisirOffre={setCleOffre} apres={[
        { cle: 'reglages', titre: 'Réglages', label: 'Réglages · Audit', corps: <CorpsReglages champs={CHAMPS} r={reglages} />, pied: <PiedReglages r={reglages} /> },
        { cle: 'executer', titre: 'Exécuter', label: 'Audit · exécuter', corps: <CorpsAtelier at={atelier} />, pied: <PiedAtelier at={atelier} /> },
      ]} />
    </Dock>
  );
}
