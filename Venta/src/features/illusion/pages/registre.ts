import type { ComponentType } from 'react';
import { SLUG_LAPIS, type ProprietesPage } from './liste';
import Accueil from './accueil';
import Offres from './offres';
import MaVeille from './ma-veille';
import Candidatures from './candidatures';
import Documents from './documents';
import Mails from './mails';
import Adresses from './adresses';
import Appels from './appels';
import Lapis from './lapis';
import Statistiques from './statistiques';
import Profil from './profil';
import Reglages from './reglages';

// Slug de l'adresse → export par défaut du dossier de la page
export const REGISTRE: Record<string, ComponentType<ProprietesPage>> = {
  accueil: Accueil,
  offres: Offres,
  'ma-veille': MaVeille,
  candidatures: Candidatures,
  documents: Documents,
  mails: Mails,
  adresses: Adresses,
  appels: Appels,
  [SLUG_LAPIS]: Lapis,
  statistiques: Statistiques,
  profil: Profil,
  reglages: Reglages,
};
