'use client';

import './groupes.css';
import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from 'react';
import { usePanneau } from '../dock/Dock';
import { Action } from './Action';
import { ICONES } from './icones';

// Cadre des pages à groupes : la navigation à gauche, le contenu à droite
export function CorpsGroupes({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="corps-groupes">
      <nav className="groupes" aria-label="Groupes">{nav}</nav>
      {children}
    </div>
  );
}

// Une entrée de la navigation : `actif` pour le groupe montré
export function Rubrique({ actif, allume, className, ...bouton }: ComponentPropsWithoutRef<'button'> & { actif?: boolean; allume?: boolean }) {
  return <button type="button" className={`rubrique${actif ? ' actif' : ''}${allume ? ' allume' : ''}${className ? ` ${className}` : ''}`} aria-current={actif ? 'page' : undefined} {...bouton} />;
}

// Une entrée qui ouvre un onglet du panneau, ou le referme
export function RubriqueOnglet({ cle, ...bouton }: ComponentPropsWithoutRef<'button'> & { cle: string }) {
  const { onglet, ouvrir, fermer } = usePanneau();
  return <Rubrique allume={onglet === cle} aria-expanded={onglet === cle} onClick={() => (onglet === cle ? fermer() : ouvrir(cle))} {...bouton} />;
}

// Action de rangée qui ouvre un onglet du panneau, allumée tant qu'il l'est
export function ActionOnglet({ cle, ...action }: ComponentProps<typeof Action> & { cle: string }) {
  const { onglet, ouvrir } = usePanneau();
  return <Action allume={onglet === cle} txt aria-haspopup="dialog" aria-expanded={onglet === cle} onClick={() => ouvrir(cle)} {...action} />;
}

// Le pied d'un groupe : ce qui attend, sinon `repos`, et son bouton
export function PiedGroupe({ libelles, repos = '', ...bouton }: ComponentPropsWithoutRef<'button'> & { libelles: string[]; repos?: string }) {
  const n = libelles.length;
  return (
    <div className="pied-groupe">
      <span className="etat-changes">{n ? `${n} changement${n > 1 ? 's' : ''} non enregistré${n > 1 ? 's' : ''} : ${libelles.slice(0, 3).join(', ')}${n > 3 ? '…' : ''}` : repos}</span>
      <Action iconeApres={ICONES.valider_metriques} plein {...bouton}>Enregistrer</Action>
    </div>
  );
}
