'use client';

import { useCallback, useEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode, type RefObject } from 'react';
import { Verre } from '@/features/fenetres/Verre';
import { ICONES } from './icones';

// Tant que le menu est ouvert, un clic hors de son hôte le ferme
export function useClicDehors(ouvert: boolean, fermer: () => void) {
  const hote = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!hote.current?.contains(e.target as Node)) fermer();
    };
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [ouvert, fermer]);
  return hote;
}

// Menu autonome : Échap le ferme avant la page ; `arreter` la laisse sourde
export function useMenu(arreter = false) {
  const [ouvert, setOuvert] = useState(false);
  const fermer = useCallback(() => setOuvert(false), []);
  const hote = useClicDehors(ouvert, fermer);
  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (arreter) e.stopPropagation();
      fermer();
    };
    document.addEventListener('keydown', echap, true);
    return () => document.removeEventListener('keydown', echap, true);
  }, [ouvert, arreter, fermer]);
  return { ouvert, setOuvert, fermer, hote };
}

// Le menu en verre, posé sous son bouton ; le rayon des halos vient de .menu
export function Menu({ className, ...reste }: ComponentPropsWithRef<'div'>) {
  return <Verre className={`menu${className ? ` ${className}` : ''}`} {...reste} />;
}

// Une ligne de menu ; `actif` l'allume et la dit choisie aux lecteurs d'écran
export function OptionMenu({ actif = false, className, ...reste }: ComponentPropsWithRef<'button'> & { actif?: boolean }) {
  return <button type="button" role="option" aria-selected={actif} className={`menu-option${actif ? ' actif' : ''}${className ? ` ${className}` : ''}`} {...reste} />;
}

// Le bouton d'un filtre : son libellé, sa valeur, son chevron
export function BoutonFiltre({ lib, valeur, actif, icone = ICONES.chevron, ...bouton }: Omit<ComponentPropsWithRef<'button'>, 'value'> & { lib?: ReactNode; valeur: ReactNode; actif?: boolean; icone?: ReactNode }) {
  return (
    <button type="button" className={`filtre${actif ? ' actif' : ''}`} aria-haspopup="listbox" {...bouton}>
      <span>{lib && <span className="lib">{lib}</span>}{valeur}</span>{icone}
    </button>
  );
}

// Le nom d'un groupe, à la place d'un filtre et dessiné comme lui
export function TitreGroupe({ titre }: { titre: ReactNode }) {
  return <p className="filtre titre-groupe"><span><span className="lib">Groupe</span>{titre}</span></p>;
}

export type ChoixMenu = { cle: string; libelle: ReactNode; n?: number; fin?: ReactNode };
type ProprietesFiltre = Omit<ComponentPropsWithRef<'button'>, 'value'> & {
  lib?: string; valeur: ReactNode; actif?: boolean; icone?: ReactNode;
  // Le nom du menu pour les lecteurs d'écran, par défaut le libellé
  titre?: string;
  choix?: ChoixMenu[]; courant?: string; choisir?: (cle: string) => void;
  classeHote?: string; classeMenu?: string; children?: ReactNode;
};

function FiltreEtMenu({ hote, ouvert, basculer, fermer, lib, titre = lib, choix, courant, choisir, classeHote, classeMenu, children, ...bouton }: ProprietesFiltre & {
  hote: RefObject<HTMLDivElement | null>; ouvert: boolean; basculer: () => void; fermer: () => void;
}) {
  return (
    <div ref={hote} className={`menu-hote${classeHote ? ` ${classeHote}` : ''}`}>
      <BoutonFiltre lib={lib} aria-expanded={ouvert} onClick={basculer} {...bouton} />
      {ouvert && (
        <Menu className={classeMenu} role="listbox" aria-label={titre}>
          {choix?.map((c) => (
            <OptionMenu key={c.cle} actif={c.cle === courant} onClick={() => {
              choisir?.(c.cle);
              fermer();
            }}>
              {c.libelle}{c.n !== undefined && <span className="compteur">{c.n}</span>}{c.fin}
            </OptionMenu>
          ))}
          {children}
        </Menu>
      )}
    </div>
  );
}

// Un filtre et son menu : clic ailleurs ou Échap le referme
export function MenuFiltre({ arreter, ...filtre }: ProprietesFiltre & { arreter?: boolean }) {
  const { ouvert, setOuvert, fermer, hote } = useMenu(arreter);
  return <FiltreEtMenu hote={hote} ouvert={ouvert} basculer={() => setOuvert((o) => !o)} fermer={fermer} {...filtre} />;
}

// Le même, tenu par la page : un seul de ses menus reste ouvert à la fois
export function MenuTenu({ ouvert, basculer, fermer, ...filtre }: ProprietesFiltre & { ouvert: boolean; basculer: () => void; fermer: () => void }) {
  const hote = useClicDehors(ouvert, fermer);
  return <FiltreEtMenu hote={hote} ouvert={ouvert} basculer={basculer} fermer={fermer} {...filtre} />;
}

// Les options d'une page en choix de menu : un compte négatif ne s'affiche pas
export const choixDe = (options: { valeur: string; nom: string; compte: number }[]): ChoixMenu[] =>
  options.map((o) => ({ cle: o.valeur, libelle: o.nom, n: o.compte >= 0 ? o.compte : undefined }));
