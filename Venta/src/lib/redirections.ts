/**
 * Liens suivis du CV et de la lettre : /redirect<cible>[/<jeton>].
 * Fonctions pures, partagées par le middleware et le relai d'API.
 */

export const REDIRECT_TARGETS = {
  cvdesign: '/assets/CV_Maxime_Thiong-kay.pdf',
  cv: '/assets/CV_Maxime_Thiong-kay_Imprimable.pdf',
  linkedin: 'https://www.linkedin.com/in/maxime-thiong-kay/',
  github: 'https://github.com/MaximeTK',
  portfolio: '/',
} as const;

export type RedirectCible = keyof typeof REDIRECT_TARGETS;

/** Ordre de test : redirectcvdesign avant redirectcv, qu'il contient. */
const CIBLES: RedirectCible[] = ['cvdesign', 'cv', 'linkedin', 'github', 'portfolio'];

/** Cookie de session qui porte le jeton du recruteur arrivé par redirectportfolio. */
export const JETON_COOKIE = 'ovrane_jeton';

/** Jeton d'une candidature Illusion : 10 caractères [a-z0-9], le chemin étant passé en minuscules. */
export function isValidJeton(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]{10}$/.test(value);
}

/** Cible et jeton éventuel d'un chemin en minuscules, null hors lien suivi. */
export function parseRedirectPath(path: string): { cible: RedirectCible; jeton: string | null } | null {
  const cible = CIBLES.find((c) => path.includes(`redirect${c}`));
  if (!cible) return null;
  // Le jeton est le segment qui suit le mot-clé ; tout autre suffixe garde l'ancien comportement
  const jeton = path.match(new RegExp(`redirect${cible}/([a-z0-9]{10})(?:/|$)`))?.[1] ?? null;
  return { cible, jeton };
}
