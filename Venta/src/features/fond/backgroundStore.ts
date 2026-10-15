/**
 * Fond de l'application : palette demandée à l'IA, ou reprise des préférences du profil
 */
import { create } from 'zustand';
import { COLOR_PALETTES, getDefaultPalette, type ColorPalette } from './colorPalettes';

interface BackgroundState {
  currentPalette: ColorPalette;
  setBackground: (paletteId: string) => void;
  choisirFond: (paletteId: string) => void;
  resetBackground: () => void;
  loadPreference: () => Promise<void>;
}

// Clé tolérante : minuscules, sans accents ni ponctuation, mots reliés par « _ »
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
  // Texte en trop après l'identifiant (« spectre. Voilà ») : préfixes d'un à trois mots
  const mots = key.split('_');
  return [1, 2, 3].map((n) => PALETTES.get(mots.slice(0, n).join('_'))).find(Boolean);
}

export const useBackgroundStore = create<BackgroundState>((set) => ({
  currentPalette: getDefaultPalette(),

  // Le backend enregistre lui-même la préférence du fond qu'il demande
  setBackground: (paletteId) => {
    const palette = resolvePalette(paletteId);
    if (palette) set({ currentPalette: palette });
  },

  // Choix du visiteur dans les réglages : appliqué tout de suite, enregistré dans son profil
  choisirFond: (paletteId) => {
    const palette = resolvePalette(paletteId);
    if (!palette) return;
    set({ currentPalette: palette });
    fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preference: 'backgroundColor', value: palette.id }),
    }).catch(() => {});
  },

  resetBackground: () => set({ currentPalette: getDefaultPalette() }),

  // Préférence du profil de la session, sinon le fond par défaut
  loadPreference: async () => {
    const data = await fetch('/api/preferences', { signal: AbortSignal.timeout(5000) })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    const id = data?.preferences?.backgroundColor;
    set({ currentPalette: (typeof id === 'string' && resolvePalette(id)) || getDefaultPalette() });
  },
}));
