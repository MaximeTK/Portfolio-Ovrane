import { useState } from 'react';
import { parVirgules } from '../../elements/format';
import { useParametresOuverts } from '../commun';

export const egal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Réglages lus, brouillon, secrets ; `surErreur`, stable, reçoit '' si tout va
export function useFormParametres<P extends Record<string, unknown>, C extends { cle: string; sorte: string }>({ depart, champs, surLu, surErreur }: {
  depart: P | null; champs: C[]; surLu?: (p: P) => void; surErreur: (e: string) => void;
}) {
  const [lus, setLus] = useState(depart);
  const [valeurs, setValeurs] = useState<Record<string, unknown>>(depart ?? {});
  const [secrets, setSecrets] = useState<Record<string, { saisie: string; effacer: boolean }>>({});
  const reprendre = (p: P) => {
    setLus(p);
    setValeurs(p);
    setSecrets({});
    surLu?.(p);
  };
  useParametresOuverts(true, reprendre, surErreur);

  // Ce qui partira : chaque champ dans sa forme, secrets retapés ou effacés
  const envoi = (c: C): unknown => {
    const v = valeurs[c.cle];
    if (c.sorte === 'liste') return Array.isArray(v) ? v : parVirgules(String(v ?? ''));
    if (c.sorte === 'nombre') return v === '' ? 0 : Number(v);
    return v;
  };
  const changes = lus ? champs.filter((c) => (c.sorte === 'secret' ? !!(secrets[c.cle]?.saisie.trim() || secrets[c.cle]?.effacer) : !egal(envoi(c), lus[c.cle]))) : [];

  return {
    lus, setLus, valeurs, setValeurs, changes, reprendre,
    poser: (cle: string, v: unknown) => setValeurs((x) => ({ ...x, [cle]: v })),
    corps: (): Record<string, unknown> => Object.fromEntries(changes.map((c) => [c.cle, c.sorte === 'secret' ? secrets[c.cle].saisie.trim() : envoi(c)])),
    secret: (cle: string) => {
      const s = secrets[cle] ?? { saisie: '', effacer: false };
      return {
        valeur: s.saisie, efface: s.effacer, titre: "Retire ce secret du coffre à l'enregistrement.",
        changer: (v: string) => setSecrets((x) => ({ ...x, [cle]: { saisie: v, effacer: false } })),
        effacer: () => setSecrets((x) => ({ ...x, [cle]: { saisie: '', effacer: true } })),
      };
    },
  };
}
