import type { ComponentType } from 'react';
import type { ProprietesPage } from './liste';
import Collecte from './collecte';
import Parser from './parser';
import Audit from './audit';
import Veille from './veille';
import Workflows from './workflows';
import Constructeur from './constructeur';
import Lapis from './lapis';
import Metriques from './metriques';
import ParametresServeur from './parametres-serveur';

// Pages d'administration, à part : leur code ne part qu'aux comptes admin
export const REGISTRE_ADMIN: Record<string, ComponentType<ProprietesPage>> = {
  collecte: Collecte,
  parser: Parser,
  audit: Audit,
  veille: Veille,
  workflows: Workflows,
  constructeur: Constructeur,
  lapis: Lapis,
  metriques: Metriques,
  'parametres-serveur': ParametresServeur,
};
