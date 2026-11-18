import type { Compte } from '../api';

// Ce que reçoit chaque page d'Illusion, avec la recherche de son adresse
export type ProprietesPage = { compte: Compte; recherche?: string };

type InfoPage = { slug: string; titre: string };

// LAPIS ouvert à tous sous ce nom provisoire : à changer ici, sans accent
export const NOM_LAPIS = 'Radar';
export const SLUG_LAPIS = NOM_LAPIS.toLowerCase();

// Pages des canaux sans composants : l'en-tête les liste sans les charger
export const MON_ESPACE: InfoPage[] = [
  { slug: 'offres', titre: 'Offres' },
  { slug: 'ma-veille', titre: 'Ma veille' },
  { slug: 'candidatures', titre: 'Candidatures' },
  { slug: 'documents', titre: 'Documents' },
  { slug: 'mails', titre: 'Mails' },
  { slug: 'adresses', titre: 'Adresses' },
  { slug: 'appels', titre: 'Appels' },
  { slug: SLUG_LAPIS, titre: NOM_LAPIS },
  { slug: 'statistiques', titre: 'Statistiques' },
  { slug: 'profil', titre: 'Profil' },
  { slug: 'reglages', titre: 'Réglages' },
];

export const ADMINISTRATION: InfoPage[] = [
  { slug: 'entreprises', titre: 'Entreprises' },
  { slug: 'veille', titre: 'Veille' },
  { slug: 'workflows', titre: 'Workflows' },
  { slug: 'constructeur', titre: 'Constructeur' },
  { slug: 'relations', titre: 'Relations' },
  { slug: 'metriques', titre: 'Métriques' },
  { slug: 'parametres-serveur', titre: 'Paramètres serveur' },
];

export const PAGE_DEPART = 'candidatures';

// Anciennes adresses : vers Entreprises et le nouveau nom de LAPIS
export const ALIAS_PAGES: Record<string, string> = { collecte: 'entreprises', parser: 'entreprises', audit: 'entreprises', lapis: SLUG_LAPIS };

export const titreDe = (slug: string) => [...MON_ESPACE, ...ADMINISTRATION].find((p) => p.slug === slug)?.titre ?? 'Accueil';
export const estAdmin = (slug: string) => ADMINISTRATION.some((p) => p.slug === slug);

// Une seule promesse : le rendu y attend le code des pages d'administration
let administration: Promise<typeof import('./registre-admin')> | undefined;
export const chargerAdministration = () => (administration ??= import('./registre-admin'));
