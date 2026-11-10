'use client';

import type { ProprietesPage } from '../liste';
import { PageFiches, useEtatFiches, CorpsAtelier, CorpsReglages, Lots, PiedAtelier, PiedReglages, arbreFiches, useAtelier, useBriques, useReglages, type ChampReglage, type Lot } from '../collecte/fiches';
import { ActionOnglet } from '../../elements/Groupes';
import { ICONES } from '../../elements/icones';

const CHAMPS: ChampReglage[] = [
  { cle: 'intitule_poste', libelle: 'Poste visé', type: 'texte', exemple: 'Développeur back-end', aide: "Cadre l'analyse sur ce que le poste demande." },
  { cle: 'audit_mois', libelle: "Fenêtre d'actualités (mois)", type: 'nombre' },
  { cle: 'audit_timeout_secondes', libelle: 'Timeout (s)', type: 'nombre' },
  { cle: 'audit_modele', libelle: 'Modèle', type: 'modele', admin: true, aide: 'Un des modèles définis dans les Paramètres serveur.' },
  { cle: 'audit_analyse', libelle: 'Analyse par le modèle', type: 'booleen', aide: 'Désactivé : collecte seule, fiche préalable sans dépenser de tokens.' },
];
// Les trois temps de l'audit écrivent la même fiche : bloqués entre eux
const LOTS: Lot[] = [
  { brique: 'audit-agregation', famille: 'audit', libelle: 'Audit Brut', icone: ICONES.loupe,
    aide: "Rassemble registres, site et actualités SANS appeler le modèle : aucun token dépensé. Prend les fiches qui n'ont pas encore de brut" },
  { brique: 'audit', famille: 'audit', libelle: 'Audit Net', icone: ICONES.executer,
    aide: "Met en forme le brut DÉJÀ collecté, sans le recollecter. Prend les fiches qui ont un brut et pas encore d'analyse" },
  { brique: 'audit-actualisation', famille: 'audit', libelle: 'Actualiser Audit', icone: ICONES.reprendre,
    aide: "Refait le brut de toutes les fiches qui en ont un — et refait l'analyse seulement là où il y en avait une" },
];
// Panneau élargi à 560 px (480 px sous 1366 px) pour que les gestes tiennent
const ARBRE = arbreFiches((l) => (l <= 1366 ? 480 : 560));

export default function PageAudit(_: ProprietesPage) {
  const etat = useEtatFiches();
  const { dire, selection, setConfirmation, relire } = etat;
  const briques = useBriques('audit');
  const atelier = useAtelier('audit', dire, relire);
  const reglages = useReglages('audit', CHAMPS, dire, atelier.recharger);

  return (
    <PageFiches section="audit" etat={etat} arbre={ARBRE} fenetres={{panneau: { pref: [560, 320], flot: [560, 600] } }} panneau={null}
      actions={(
          <>
            <Lots lots={LOTS} actives={briques.actives} selection={selection} dire={dire} relire={briques.lire} demander={setConfirmation} />
            <ActionOnglet cle="executer" icone={ICONES.executer} title="Lance l'audit à la main sur une entreprise.">Exécuter</ActionOnglet>
            <ActionOnglet cle="reglages" icone={ICONES.reglages} title="Réglages">Réglages</ActionOnglet>
          </>
      )}
      apres={[
        { cle: 'reglages', titre: 'Réglages', label: 'Réglages · Audit', corps: <CorpsReglages champs={CHAMPS} r={reglages} />, pied: <PiedReglages r={reglages} /> },
        { cle: 'executer', titre: 'Exécuter', label: 'Audit · exécuter', corps: <CorpsAtelier at={atelier} />, pied: <PiedAtelier at={atelier} /> },
      ]} />
  );
}
