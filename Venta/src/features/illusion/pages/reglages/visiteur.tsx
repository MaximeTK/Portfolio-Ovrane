'use client';

import './reglages.css';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Panneau } from '../../dock/Panneau';
import { RacineIllusion } from '../../ossature/RacineIllusion';
import { FENETRES_REGLAGES, useOngletApparence } from './apparence';
import { useAvis } from '../../elements/Avis';
import { TitreGroupe } from '../../elements/Menu';
import { CorpsGroupes, RubriqueOnglet } from '../../elements/Groupes';

// Réglages d'un visiteur d'Ovrane : la même fenêtre, l'apparence seule
export default function ReglagesVisiteur() {
  return (
    <RacineIllusion page="reglages-visiteur">
      <Dock id="reglages-visiteur" principal="reglages" panneau="apparence" fenetres={FENETRES_REGLAGES}>
        <Contenu />
      </Dock>
    </RacineIllusion>
  );
}

function Contenu() {
  const { onglet, fermer } = usePanneau();
  const { dire, vue } = useAvis('avis', true);
  const apparence = useOngletApparence({ actif: onglet === 'apparence', fermer, dire });
  return (
    <>
      <Fenetre id="reglages" className={`reglages-page${onglet ? ' resserre' : ''}`} titrePrise="Glisser pour détacher les réglages">
        <div className="outils">
          <TitreGroupe titre="Apparence" />
          <span className="espace" />
        </div>
        <CorpsGroupes nav={<RubriqueOnglet cle="apparence">Apparence</RubriqueOnglet>}>
          <div className="groupe-contenu" />
        </CorpsGroupes>
        {vue}
      </Fenetre>
      <Panneau onglets={onglet === 'apparence' ? [apparence] : []} />
    </>
  );
}
