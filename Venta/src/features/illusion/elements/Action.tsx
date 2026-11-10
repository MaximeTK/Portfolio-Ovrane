import type { ComponentPropsWithRef, ReactNode } from 'react';
import { ICONES } from './icones';

// Bouton d'action : `icone` avant le texte, `iconeApres` après, `txt` le texte qui se replie
export function Action({ icone, iconeApres, txt, plein, rouge, allume, className, children, ...bouton }: ComponentPropsWithRef<'button'> & {
  icone?: ReactNode; iconeApres?: ReactNode; txt?: boolean; plein?: boolean; rouge?: boolean; allume?: boolean;
}) {
  return (
    <button type="button" className={`action${plein ? ' plein' : ''}${rouge ? ' rouge' : ''}${allume ? ' allume' : ''}${className ? ` ${className}` : ''}`} {...bouton}>
      {icone && <span className="ico">{icone}</span>}
      {txt ? <span className="txt">{children}</span> : children}
      {iconeApres && <span className="ico">{iconeApres}</span>}
    </button>
  );
}

// Supprimer la sélection : le texte se replie, le nombre reste
export function ActionSupprimer({ n, ...bouton }: ComponentPropsWithRef<'button'> & { n: ReactNode }) {
  return <Action rouge icone={ICONES.supprimer} {...bouton}><span><span className="txt">Supprimer </span>({n})</span></Action>;
}
