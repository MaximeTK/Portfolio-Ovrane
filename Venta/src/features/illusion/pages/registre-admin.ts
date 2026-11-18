import type { ComponentType } from 'react';
import type { ProprietesPage } from './liste';
import Entreprises from './entreprises';
import Veille from './veille';
import Workflows from './workflows';
import Constructeur from './constructeur';
import Relations from './relations';
import Metriques from './metriques';
import ParametresServeur from './parametres-serveur';

// Pages d'administration, à part : leur code ne part qu'aux comptes admin
export const REGISTRE_ADMIN: Record<string, ComponentType<ProprietesPage>> = {
  entreprises: Entreprises,
  veille: Veille,
  workflows: Workflows,
  constructeur: Constructeur,
  relations: Relations,
  metriques: Metriques,
  'parametres-serveur': ParametresServeur,
};
