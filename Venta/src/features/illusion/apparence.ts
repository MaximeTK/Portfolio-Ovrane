import { useEffect } from 'react';
import { create } from 'zustand';
import { appeler } from './api';

export type Matiere = 'verre' | 'teinte';

type EtatApparence = {
  // Matière montrée, essayée ou gardée
  matiere: Matiere;
  // Matière gardée dans les réglages d'Illusion du compte
  enregistree: Matiere;
  choisirMatiere: (m: Matiere) => void;
  charger: () => Promise<void>;
  enregistrer: (m: Matiere) => Promise<void>;
};

// Un choix fait pendant la lecture l'emporte sur ce qu'elle rapporte
let choix = 0;
let enCours: Promise<void> | null = null;

const magasin = create<EtatApparence>((set) => ({
  matiere: 'teinte',
  enregistree: 'teinte',
  choisirMatiere: (matiere) => {
    choix += 1;
    set({ matiere });
  },
  charger: () => {
    enCours ??= (async () => {
      const avant = choix;
      try {
        const { matiere } = await appeler<{ matiere?: Matiere }>('/parametres');
        if (matiere !== 'verre' && matiere !== 'teinte') return;
        set(avant === choix ? { matiere, enregistree: matiere } : { enregistree: matiere });
      } catch {
        // Sans session ni Illusion, la matière par défaut reste
      } finally {
        enCours = null;
      }
    })();
    return enCours;
  },
  enregistrer: async (matiere) => {
    await appeler('/parametres', { methode: 'PUT', corps: { matiere } });
    choix += 1;
    set({ matiere, enregistree: matiere });
  },
}));

// Matière d'Illusion, gardée avec le compte : relue des réglages d'Illusion à chaque montage de l'ossature
function useApparenceDuCompte<T>(lire: (s: EtatApparence) => T): T {
  useEffect(() => {
    void magasin.getState().charger();
  }, []);
  return magasin(lire);
}

export const useApparence = Object.assign(useApparenceDuCompte, { getState: magasin.getState, setState: magasin.setState, subscribe: magasin.subscribe });
