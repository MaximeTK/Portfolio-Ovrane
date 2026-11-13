'use client';

import './reglages.css';
import { Dock, Fenetre } from '../../dock/Dock';
import { RacineIllusion } from '../../ossature/RacineIllusion';
import { FENETRES_REGLAGES, useApparenceReglages } from './apparence';
import { useAvis } from '../../elements/Avis';
import { TitreGroupe } from '../../elements/Menu';
import { CorpsGroupes, Rubrique } from '../../elements/Groupes';

// Réglages d'un visiteur d'Ovrane : la même fenêtre, l'apparence seule
export default function ReglagesVisiteur() {
  return (
    <RacineIllusion page="reglages-visiteur">
      <Dock id="reglages-visiteur" principal="reglages" fenetres={FENETRES_REGLAGES}>
        <Contenu />
      </Dock>
    </RacineIllusion>
  );
}

function Contenu() {
  const { dire, vue } = useAvis('avis', true);
  const apparence = useApparenceReglages({ actif: true, dire });
  return (
    <Fenetre id="reglages" className="reglages-page" titrePrise="Glisser pour détacher les réglages">
      <div className="outils">
        <TitreGroupe titre="Apparence" />
        <span className="espace" />
      </div>
      <CorpsGroupes nav={<Rubrique actif>Apparence</Rubrique>}>
        <div className="groupe-contenu">
          <div className="defile">{apparence.corps}</div>
          <footer className="f-pied">{apparence.pied}</footer>
        </div>
      </CorpsGroupes>
      {vue}
    </Fenetre>
  );
}
