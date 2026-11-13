import { retenirLocal } from '@/lib/uiStore';
import { useEffect, useLayoutEffect } from 'react';
import { create } from 'zustand';
import { useUIStore } from '@/lib/uiStore';
import { appeler } from './api';

export type Matiere = 'verre' | 'teinte';
export type Theme = 'verre' | 'clair' | 'sombre';

// Classes de la racine : la disposition commune, puis le dessin du thème
export const classesTheme = (t: Theme) => `trame th-${t}${t === 'verre' ? '' : ' th-plein'}`;

type Reglage = { matiere: Matiere; theme: Theme };
type EtatApparence = Reglage & {
  // Ce qui est gardé dans les réglages d'Illusion du compte
  enregistree: Matiere;
  themeEnregistre: Theme;
  choisirMatiere: (m: Matiere) => void;
  choisirTheme: (t: Theme) => void;
  relire: () => void;
  charger: () => Promise<void>;
  enregistrer: (r: Reglage) => Promise<void>;
};

// Dernier réglage du navigateur : sans clignotement, et celui d'un visiteur
const CLE_THEME = 'illusion:theme';
const CLE_MATIERE = 'illusion:matiere';
function retenir({ matiere, theme }: Reglage) {
  retenirLocal(CLE_THEME, theme);
  retenirLocal(CLE_MATIERE, matiere);
}

// Un choix fait pendant la lecture l'emporte sur ce qu'elle rapporte
let choix = 0;
let enCours: Promise<void> | null = null;

// Thème ou matière changé : un instant, tout glisse vers ses nouvelles valeurs
let finPassage = 0;
function passer() {
  document.documentElement.classList.add('th-passe');
  clearTimeout(finPassage);
  finPassage = window.setTimeout(() => document.documentElement.classList.remove('th-passe'), 800);
}

const magasin = create<EtatApparence>((set, get) => ({
  matiere: 'verre',
  enregistree: 'verre',
  theme: 'verre',
  themeEnregistre: 'verre',
  choisirMatiere: (matiere) => {
    choix += 1;
    if (matiere !== get().matiere) passer();
    set({ matiere });
  },
  choisirTheme: (theme) => {
    choix += 1;
    if (theme !== get().theme) passer();
    set({ theme });
  },
  relire: () => {
    try {
      const theme = localStorage.getItem(CLE_THEME);
      const matiere = localStorage.getItem(CLE_MATIERE);
      if (!choix && (theme === 'clair' || theme === 'sombre')) set({ theme, themeEnregistre: theme });
      if (!choix && (matiere === 'verre' || matiere === 'teinte')) set({ matiere, enregistree: matiere });
    } catch {
      // Stockage bloqué : l'apparence par défaut reste
    }
  },
  charger: () => {
    // Un visiteur n'a que ce navigateur
    if (!useUIStore.getState().compteIllusion) return Promise.resolve();
    enCours ??= (async () => {
      const avant = choix;
      try {
        const { matiere, theme = 'verre' } = await appeler<Partial<Reglage>>('/parametres', { signal: null });
        if (matiere !== 'verre' && matiere !== 'teinte') return;
        retenir({ matiere, theme });
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
    if (useUIStore.getState().compteIllusion) await appeler('/parametres', { methode: 'PUT', corps: { matiere, theme } });
    choix += 1;
    retenir({ matiere, theme });
    set({ matiere, enregistree: matiere, theme, themeEnregistre: theme });
  },
}));

// Apparence gardée avec le compte, relue à chaque montage de l'ossature
function useApparenceDuCompte<T>(lire: (s: EtatApparence) => T): T {
  useLayoutEffect(() => magasin.getState().relire(), []);
  useEffect(() => {
    void magasin.getState().charger();
  }, []);
  return magasin(lire);
}

export const useApparence = Object.assign(useApparenceDuCompte, { getState: magasin.getState });
