import { useEffect, useLayoutEffect } from 'react';
import { create } from 'zustand';
import { appeler } from './api';

export type Matiere = 'verre' | 'teinte';
export type Theme = 'verre' | 'clair' | 'sombre';

// Classes de la racine : le verre, ou l'un des deux thèmes pleins
export const classesTheme = (t: Theme) => `th-${t}${t === 'verre' ? '' : ' th-plat'}`;

type Reglage = { matiere: Matiere; theme: Theme };
type EtatApparence = Reglage & {
  // Ce qui est gardé dans les réglages d'Illusion du compte
  enregistree: Matiere;
  themeEnregistre: Theme;
  choisirMatiere: (m: Matiere) => void;
  choisirTheme: (t: Theme) => void;
  relireTheme: () => void;
  charger: () => Promise<void>;
  enregistrer: (r: Reglage) => Promise<void>;
};

// Dernier thème de ce navigateur, pour ne pas clignoter avant la réponse
const CLE_THEME = 'illusion:theme';
function retenirTheme(theme: Theme) {
  try {
    localStorage.setItem(CLE_THEME, theme);
  } catch {
    // Stockage bloqué : le thème viendra du serveur
  }
}

// Un choix fait pendant la lecture l'emporte sur ce qu'elle rapporte
let choix = 0;
let enCours: Promise<void> | null = null;

const magasin = create<EtatApparence>((set) => ({
  matiere: 'teinte',
  enregistree: 'teinte',
  theme: 'verre',
  themeEnregistre: 'verre',
  choisirMatiere: (matiere) => {
    choix += 1;
    set({ matiere });
  },
  choisirTheme: (theme) => {
    choix += 1;
    set({ theme });
  },
  relireTheme: () => {
    try {
      const lu = localStorage.getItem(CLE_THEME);
      if (!choix && (lu === 'clair' || lu === 'sombre')) set({ theme: lu });
    } catch {
      // Stockage bloqué : le thème viendra du serveur
    }
  },
  charger: () => {
    enCours ??= (async () => {
      const avant = choix;
      try {
        const { matiere, theme = 'verre' } = await appeler<Partial<Reglage>>('/parametres', { signal: null });
        if (matiere !== 'verre' && matiere !== 'teinte') return;
        retenirTheme(theme);
        const garde = { enregistree: matiere, themeEnregistre: theme };
        set(avant === choix ? { ...garde, matiere, theme } : garde);
      } catch {
        // Sans session ni Illusion, l'apparence par défaut reste
      } finally {
        enCours = null;
      }
    })();
    return enCours;
  },
  enregistrer: async ({ matiere, theme }) => {
    await appeler('/parametres', { methode: 'PUT', corps: { matiere, theme } });
    choix += 1;
    retenirTheme(theme);
    set({ matiere, enregistree: matiere, theme, themeEnregistre: theme });
  },
}));

// Apparence gardée avec le compte, relue à chaque montage de l'ossature
function useApparenceDuCompte<T>(lire: (s: EtatApparence) => T): T {
  useLayoutEffect(() => magasin.getState().relireTheme(), []);
  useEffect(() => {
    void magasin.getState().charger();
  }, []);
  return magasin(lire);
}

export const useApparence = Object.assign(useApparenceDuCompte, { getState: magasin.getState });
