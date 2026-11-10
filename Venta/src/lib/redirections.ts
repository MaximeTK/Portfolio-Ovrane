/** Liens suivis du CV et de la lettre : /redirect<cible>[/<jeton>] */

export const REDIRECT_TARGETS = {
  cvdesign: '/assets/CV_Maxime_Thiong-kay.pdf',
  cv: '/assets/CV_Maxime_Thiong-kay_Imprimable.pdf',
  linkedin: 'https://www.linkedin.com/in/maxime-thiong-kay/',
  github: 'https://github.com/MaximeTK',
  portfolio: '/',
} as const;

type RedirectCible = keyof typeof REDIRECT_TARGETS;

/** Ordre de test : redirectcvdesign avant redirectcv, qu'il contient. */
const CIBLES: RedirectCible[] = ['cvdesign', 'cv', 'linkedin', 'github', 'portfolio'];

/** Cookie portant le jeton du recruteur arrivé par redirectportfolio */
export const JETON_COOKIE = 'ovrane_jeton';

/** Jeton d'une candidature : 10 caractères [a-z0-9], chemin en minuscules */
const FORMAT_JETON = '[a-z0-9]{10}';
const JETON = new RegExp(`^${FORMAT_JETON}$`);

export function isValidJeton(value: unknown): value is string {
  return typeof value === 'string' && JETON.test(value);
}

// Mot-clé en tête d'un segment, anciens suffixes gardés ; puis /<jeton>
const LIEN = new RegExp(`(?:^|/)redirect(${CIBLES.join('|')})(?:/(${FORMAT_JETON})(?:/|$))?`);

/** Cible et jeton éventuel d'un chemin en minuscules, null hors lien suivi. */
export function parseRedirectPath(path: string): { cible: RedirectCible; jeton: string | null } | null {
  const lien = LIEN.exec(path);
  return lien ? { cible: lien[1] as RedirectCible, jeton: lien[2] ?? null } : null;
}
