'use client';


import { Fenetre, type ArbreDepart } from '../../dock/Dock';
import type { ProprietesPage } from '../liste';
import { PageDock } from '../../activite/PageDock';

// L'Activité à sa largeur de page, le reste à la place vide
const ARBRE: ArbreDepart = (zone) => ({ dir: 'row', enfants: [{ id: 'activite' }, { id: 'principal' }], parts: [228, zone.w - 228 - 16] });

// Accueil du logo, pas construit : place vide, l'Activité seule à gauche
export default function PageAccueil(_: ProprietesPage) {
  return (
    <PageDock id="accueil" arbre={ARBRE}>
      <Fenetre id="principal" className="tableau" aria-hidden="true" />
    </PageDock>
  );
}
