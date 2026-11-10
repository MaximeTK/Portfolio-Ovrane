import type { ComponentType } from 'react';
import type { ProprietesPage } from './liste';
import Accueil from './accueil';
import Offres from './offres';
import Candidatures from './candidatures';
import Documents from './documents';
import Mails from './mails';
import Adresses from './adresses';
import Appels from './appels';
import Relations from './relations';
import Profil from './profil';
import Reglages from './reglages';

// Slug de l'adresse → export par défaut du dossier de la page
export const REGISTRE: Record<string, ComponentType<ProprietesPage>> = {
  accueil: Accueil,
  offres: Offres,
  candidatures: Candidatures,
  documents: Documents,
  mails: Mails,
  adresses: Adresses,
  appels: Appels,
  relations: Relations,
  profil: Profil,
  reglages: Reglages,
};
