import type { ReactNode } from 'react';

// Ce que partagent les pages du site : étiquette, cadre, libellés, lueur
export const ETIQUETTE = 'text-[10px] font-bold uppercase tracking-[0.25em] text-white/60';

// Trait arrondi des icônes du site ; épaisseur et taille restent à l'appel
export const TRAIT_ROND = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

// Fait défiler la vue jusqu'à une section sans toucher à l'URL
export function allerA(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// Allumé : la lueur de l'œil ; au repos, `repos` et plus vif au survol
export const etatLueur = (actif: boolean, repos = 'text-white/60') =>
  `transition-[color,filter] duration-500 ${actif ? 'text-white drop-shadow-[0_0_3px_#fff]' : `${repos} hover:text-white`}`;

// Un libellé et sa valeur dans une liste de définitions
export function Info({ libelle, className, classeValeur, children }: { libelle: ReactNode; className?: string; classeValeur?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <dt className={ETIQUETTE}>{libelle}</dt>
      <dd className={`mt-1${classeValeur ? ` ${classeValeur}` : ''}`}>{children}</dd>
    </div>
  );
}

type ProprietesPage = { id: string; etiquette: ReactNode; titre: ReactNode; etroite?: boolean; classeTitre?: string; enTete?: ReactNode; children: ReactNode };

// Une page du site : un article nommé par son titre ; `enTete` s'y range dessous
export function PageSite({ id, etiquette, titre, etroite, classeTitre = 'md:text-5xl', enTete, children }: ProprietesPage) {
  const tete = (
    <>
      <p className={ETIQUETTE}>{etiquette}</p>
      <h1 id={id} className={`mt-4 text-3xl font-semibold tracking-tight ${classeTitre}`}>{titre}</h1>
      {enTete}
    </>
  );
  return (
    <article aria-labelledby={id} className={`mx-auto px-4 pb-24 pt-28 font-sans text-white ${etroite ? 'max-w-md' : 'max-w-4xl md:px-8'}`}>
      {enTete ? <header>{tete}</header> : tete}
      {children}
    </article>
  );
}
