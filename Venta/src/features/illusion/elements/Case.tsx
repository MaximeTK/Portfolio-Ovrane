import type { ComponentPropsWithoutRef } from 'react';

export function Case(props: ComponentPropsWithoutRef<'input'>) {
  return <input type="checkbox" className="case" {...props} />;
}

// Cocher une ligne ou tout le tableau, sans perdre le reste de la sélection
export function useCoches<T extends string | number>(selection: Set<T>, choisir: (s: Set<T>) => void, cles: T[]) {
  const toutes = cles.length > 0 && cles.every((c) => selection.has(c));
  const cocher = (liste: T[], oui: boolean) => {
    const s = new Set(selection);
    liste.forEach((c) => (oui ? s.add(c) : s.delete(c)));
    choisir(s);
  };
  return { toutes, cocher };
}

// Une ligne qui ouvre sa fiche, au clic comme au clavier ; sans objet, elle reste inerte
export const ouvrable = (ouvre: string, objet: string | number | null | undefined, agir: () => unknown) => (objet !== '' && objet != null ? {
  tabIndex: 0, 'data-ouvre': ouvre, 'data-objet': objet, onClick: agir,
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) agir(); },
} : {});
