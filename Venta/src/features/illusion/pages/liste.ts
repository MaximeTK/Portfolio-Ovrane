import type { Compte } from '../api';

// Ce que reçoit chaque page d'Illusion
export type ProprietesPage = { compte: Compte };

export type InfoPage = { slug: string; titre: string };

// Pages des canaux, sans leurs composants : l'en-tête les liste sans les charger
export const MON_ESPACE: InfoPage[] = [
  { slug: 'offres', titre: 'Offres' },
  { slug: 'candidatures', titre: 'Candidatures' },
  { slug: 'documents', titre: 'Documents' },
  { slug: 'mails', titre: 'Mails' },
  { slug: 'appels', titre: 'Appels' },
  { slug: 'relations', titre: 'Relations' },
  { slug: 'profil', titre: 'Profil' },
  { slug: 'reglages', titre: 'Réglages' },
];

export const ADMINISTRATION: InfoPage[] = [
  { slug: 'collecte', titre: 'Collecte' },
  { slug: 'parser', titre: 'Parser' },
  { slug: 'audit', titre: 'Audit' },
  { slug: 'veille', titre: 'Veille' },
  { slug: 'workflows', titre: 'Workflows' },
  { slug: 'constructeur', titre: 'Constructeur' },
  { slug: 'lapis', titre: 'LAPIS' },
  { slug: 'metriques', titre: 'Métriques' },
  { slug: 'parametres-serveur', titre: 'Paramètres serveur' },
];

export const PAGE_DEPART = 'candidatures';

export const titreDe = (slug: string) => [...MON_ESPACE, ...ADMINISTRATION].find((p) => p.slug === slug)?.titre ?? 'Accueil';
export const estAdmin = (slug: string) => ADMINISTRATION.some((p) => p.slug === slug);
