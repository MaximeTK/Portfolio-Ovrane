'use client';

import { Activite } from '../../activite/Activite';
import { Dock, Fenetre, type ArbreDepart } from '../../dock/Dock';
import type { ProprietesPage } from '../liste';

// L'Activité à sa largeur de page, le reste à la place vide
const ARBRE: ArbreDepart = (zone) => ({ dir: 'row', enfants: [{ id: 'activite' }, { id: 'principal' }], parts: [228, zone.w - 228 - 16] });

// Accueil, ouvert par le logo : pas encore construit, sa place reste vide (cachée par .vue-accueil) et l'Activité est seule à gauche
export default function PageAccueil(_: ProprietesPage) {
  return (
    <Dock id="accueil" arbre={ARBRE}>
      <Activite />
      <Fenetre id="principal" className="tableau" aria-hidden="true" />
    </Dock>
  );
}
