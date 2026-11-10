/** Fond de l'application : palette demandée à l'IA ou reprise du profil */
import { lireJson, posterJson } from '@/lib/reseau';
import { create } from 'zustand';
import { COLOR_PALETTES, type ColorPalette } from './colorPalettes';

interface BackgroundState {
  currentPalette: ColorPalette;
  setBackground: (paletteId: string) => void;
  choisirFond: (paletteId: string) => void;
  resetBackground: () => void;
  loadPreference: () => Promise<void>;
}

// Clé tolérante : minuscules, sans accents ni ponctuation, mots reliés par _
function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const PALETTES = new Map(
  Object.values(COLOR_PALETTES).flatMap((p): [string, ColorPalette][] => [[normalizeKey(p.id), p], [normalizeKey(p.name), p]]),
);

function resolvePalette(paletteId: string): ColorPalette | undefined {
  const key = normalizeKey(paletteId);
  if (PALETTES.has(key)) return PALETTES.get(key);
  // Texte en trop après l'identifiant : préfixes d'un à trois mots
  const mots = key.split('_');
  return [1, 2, 3].map((n) => PALETTES.get(mots.slice(0, n).join('_'))).find(Boolean);
}

export const useBackgroundStore = create<BackgroundState>((set) => ({
  currentPalette: COLOR_PALETTES.default,

  // Le backend enregistre lui-même la préférence du fond qu'il demande
  setBackground: (paletteId) => {
    const palette = resolvePalette(paletteId);
    if (palette) set({ currentPalette: palette });
  },

  // Choix du visiteur : appliqué tout de suite, enregistré dans son profil
  choisirFond: (paletteId) => {
    const palette = resolvePalette(paletteId);
    if (!palette) return;
    set({ currentPalette: palette });
    posterJson('/api/preferences', { preference: 'backgroundColor', value: palette.id }).catch(() => {});
  },

  resetBackground: () => set({ currentPalette: COLOR_PALETTES.default }),

  // Préférence du profil de la session, sinon le fond par défaut
  loadPreference: async () => {
    const data = await lireJson<{ preferences?: { backgroundColor?: unknown } }>('/api/preferences', { signal: AbortSignal.timeout(5000) })
      .catch(() => null);
    const id = data?.preferences?.backgroundColor;
    set({ currentPalette: (typeof id === 'string' && resolvePalette(id)) || COLOR_PALETTES.default });
  },
}));
