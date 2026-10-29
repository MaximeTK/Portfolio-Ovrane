'use client';

import { Activite } from '../activite/Activite';
import { Dock, Fenetre } from '../dock/Dock';
import { Panneau } from '../dock/Panneau';

// Page pas encore construite : l'Activité, une fenêtre principale vide et un panneau vide
export function Provisoire({ slug, titre }: { slug: string; titre: string }) {
  return (
    <Dock id={slug} panneau="vide">
      <Activite />
      <Fenetre id="principal" className="tableau" aria-label={titre} titrePrise={`Glisser pour détacher ${titre}`}>
        <div className="outils"><span className="etiquette">{titre}</span></div>
      </Fenetre>
      <Panneau onglets={[{ cle: 'vide', titre: 'Panneau', corps: null }]} />
    </Dock>
  );
}
