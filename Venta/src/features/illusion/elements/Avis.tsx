'use client';

import './avis.css';
import { useCallback, useEffect, useState } from 'react';

// Un avis à l'écran : un clic le ferme quand `fermer` est donné
export function AvisBref({ texte, erreur, classe = 'avis', fermer }: { texte: React.ReactNode; erreur?: boolean; classe?: string; fermer?: () => void }) {
  return <p className={`${classe}${erreur ? ' erreur' : ''}`} role={erreur ? 'alert' : 'status'} onClick={fermer}>{texte}</p>;
}

// Un avis se lit 3,5 s, une erreur 8 s
export const dureeAvis = (erreur?: boolean) => (erreur ? 8000 : 3500);

export type Avis = { texte: string; erreur?: boolean } | null;
export type Dire = (texte: string, erreur?: boolean) => void;

// `vue` montre l'avis, `dire` le remplace ; `panne` se montre à défaut d'avis
export function useAvis(classe = 'avis', fermable = false, panne?: string) {
  const [avis, setAvis] = useState<{ texte: string; erreur: boolean; n: number } | null>(null);
  const dire: Dire = useCallback((texte, erreur = false) => setAvis((a) => ({ texte, erreur, n: (a?.n ?? 0) + 1 })), []);
  useEffect(() => {
    if (!avis) return;
    const t = window.setTimeout(() => setAvis(null), dureeAvis(avis.erreur));
    return () => window.clearTimeout(t);
  }, [avis]);
  const fermer = useCallback(() => setAvis(null), []);
  const montre = avis ?? (panne ? { texte: panne, erreur: true, n: 0 } : null);
  const vue = montre ? <AvisBref key={montre.n} texte={montre.texte} erreur={montre.erreur} classe={classe} fermer={fermable ? fermer : undefined} /> : null;
  return { avis, dire, vue, fermer };
}
