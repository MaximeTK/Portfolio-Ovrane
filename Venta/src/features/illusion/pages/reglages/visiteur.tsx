'use client';

import './reglages.css';
import { useState } from 'react';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Panneau } from '../../dock/Panneau';
import { RacineIllusion } from '../../ossature/RacineIllusion';
import { useAvisBref, type Avis } from '../commun';
import { useOngletApparence } from './apparence';

// Réglages d'un visiteur d'Ovrane : la même fenêtre, l'apparence seule
export default function ReglagesVisiteur() {
  return (
    <RacineIllusion page="reglages-visiteur">
      <Dock id="reglages-visiteur" principal="reglages" panneau="apparence"
        fenetres={{ reglages: { mini: [540, 320], pref: [780, 420], flot: [900, 600] }, panneau: { flot: [440, 600] } }}>
        <Contenu />
      </Dock>
    </RacineIllusion>
  );
}

function Contenu() {
  const { onglet, ouvrir, fermer } = usePanneau();
  const [avis, setAvis] = useState<Avis>(null);
  useAvisBref(avis, setAvis);
  const apparence = useOngletApparence({ actif: onglet === 'apparence', fermer, dire: (texte, erreur = false) => setAvis({ texte, erreur }) });
  return (
    <>
      <Fenetre id="reglages" className={`reglages-page${onglet ? ' resserre' : ''}`} titrePrise="Glisser pour détacher les réglages">
        <div className="outils">
          <p className="filtre titre-groupe"><span><span className="lib">Groupe</span>Apparence</span></p>
          <span className="espace" />
        </div>
        <div className="corps-groupes">
          <nav className="groupes" aria-label="Groupes">
            <button type="button" className={`rubrique${onglet === 'apparence' ? ' allume' : ''}`} aria-expanded={onglet === 'apparence'}
              onClick={() => (onglet === 'apparence' ? fermer() : ouvrir('apparence'))}>Apparence</button>
          </nav>
          <div className="groupe-contenu" />
        </div>
        {avis && <p className={`avis${avis.erreur ? ' erreur' : ''}`} role={avis.erreur ? 'alert' : 'status'} onClick={() => setAvis(null)}>{avis.texte}</p>}
      </Fenetre>
      <Panneau onglets={onglet === 'apparence' ? [apparence] : []} />
    </>
  );
}
