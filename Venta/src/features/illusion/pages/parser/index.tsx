'use client';

import type { ProprietesPage } from '../liste';
import { PageFiches, useEtatFiches, CorpsAtelier, CorpsDejaBase, CorpsReglages, Lots, PiedAtelier, PiedDejaBase, PiedReglages, arbreFiches, useAtelier, useBriques, useReglages, type ChampReglage, type Lot } from '../collecte/fiches';
import { ActionOnglet } from '../../elements/Groupes';
import { ICONES } from '../../elements/icones';

const CHAMPS: ChampReglage[] = [
  { cle: 'parser_profondeur', libelle: 'Profondeur de crawl', type: 'nombre', aide: "Combien de clics le parser s'autorise depuis l'accueil. 1 : l'accueil seul. 3 : il descend jusqu'aux pages « Nous rejoindre » et « Contact »." },
  { cle: 'parser_seuil', libelle: "Seuil page d'offres", type: 'nombre', aide: "Score minimum pour qu'une page soit retenue comme LA page d'offres. Trop bas, une page « rejoignez-nous » sans annonce est retenue ; trop haut, aucune ne l'est." },
  { cle: 'parser_timeout_secondes', libelle: 'Timeout (s)', type: 'nombre' },
];
const LOTS: Lot[] = [{ brique: 'parser', famille: 'parser', libelle: 'Parser', aide: "Trouve le site, le lit, et fait avancer l'état de la fiche", icone: ICONES.executer, plein: true }];
// À 1366 px et moins, 420 px gardent les couleurs de l'identité sur leur ligne
const ARBRE = arbreFiches((l) => (l <= 1366 ? 420 : null));

export default function PageParser(_: ProprietesPage) {
  const etat = useEtatFiches();
  const { dire, selection, setConfirmation, relire } = etat;
  const briques = useBriques('parser');
  const atelier = useAtelier('parser', dire, relire);
  const reglages = useReglages('parser', CHAMPS, dire, atelier.recharger);

  return (
    <PageFiches section="parser" etat={etat} arbre={ARBRE} panneau="executer"
      actions={(
          <>
            <ActionOnglet cle="reglages" icone={ICONES.reglages} title="Réglages">Réglages</ActionOnglet>
            <ActionOnglet cle="executer" icone={ICONES.executer} title="Lance le parser à la main sur un site.">Exécuter</ActionOnglet>
            <Lots lots={LOTS} actives={briques.actives} selection={selection} dire={dire} relire={briques.lire} demander={setConfirmation} />
          </>
      )}
      avant={[
        { cle: 'reglages', titre: 'Réglages', label: 'Réglages · Parser', corps: <CorpsReglages champs={CHAMPS} r={reglages} />, pied: <PiedReglages r={reglages} /> },
        { cle: 'executer', titre: 'Exécuter', label: 'Parser · exécuter', corps: <CorpsAtelier at={atelier} />, pied: <PiedAtelier at={atelier} /> },
        ...(atelier.dejaBase ? [{ cle: 'deja-base', titre: 'Déjà en base', label: 'Cette entreprise est déjà en base', corps: <CorpsDejaBase at={atelier} />, pied: <PiedDejaBase at={atelier} /> }] : []),
      ]} />
  );
}
