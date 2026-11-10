import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react';

// Le verre et sa lumière : fenêtre, carte ou menu n'y ajoutent que leur contenu
export function Verre<T extends ElementType = 'div'>({
  as,
  className = '',
  children,
  ...props
}: { as?: T; className?: string; children?: ReactNode } & Omit<ComponentPropsWithRef<T>, 'as' | 'className' | 'children'>) {
  const Balise: ElementType = as ?? 'div';
  return (
    <Balise className={`verre${className ? ` ${className}` : ''}`} {...props}>
      <span className="verre-halos" aria-hidden="true" />
      {children}
    </Balise>
  );
}
