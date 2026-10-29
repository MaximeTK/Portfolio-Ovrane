import type { ComponentType } from 'react';
import type { ProprietesPage } from './liste';
import Accueil from './accueil';
import Offres from './offres';
import Candidatures from './candidatures';
import Documents from './documents';
import Mails from './mails';
import Appels from './appels';
import Relations from './relations';
import Profil from './profil';
import Reglages from './reglages';
import Collecte from './collecte';
import Parser from './parser';
import Audit from './audit';
import Veille from './veille';
import Workflows from './workflows';
import Constructeur from './constructeur';
import Lapis from './lapis';
import Metriques from './metriques';
import ParametresServeur from './parametres-serveur';

// Slug de l'adresse → export par défaut du dossier de la page ; une page ne change que les fichiers de son dossier
export const REGISTRE: Record<string, ComponentType<ProprietesPage>> = {
  accueil: Accueil,
  offres: Offres,
  candidatures: Candidatures,
  documents: Documents,
  mails: Mails,
  appels: Appels,
  relations: Relations,
  profil: Profil,
  reglages: Reglages,
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
