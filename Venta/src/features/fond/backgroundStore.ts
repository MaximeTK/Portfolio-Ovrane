/** Fond de l'application : palette demandée à l'IA ou reprise du profil */
import { lireJson, posterJson } from '@/lib/reseau';
import { create } from 'zustand';
import { COLOR_PALETTES, type ColorPalette } from './colorPalettes';

// Photos proposées comme fond, servies depuis public/fonds
export const PHOTOS = [
  { id: 'foret-automne', nom: "Forêt d'automne" },
  { id: 'feuille-rosee', nom: 'Feuille et rosée' },
  { id: 'fougeres', nom: 'Fougères' },
  { id: 'alchemille', nom: 'Alchémille' },
  { id: 'sentier', nom: 'Sentier fleuri' },
  { id: 'torrent', nom: 'Torrent' },
  { id: 'ruisseau', nom: 'Ruisseau au soleil' },
  { id: 'montagnes', nom: 'Montagnes' },
  { id: 'lac', nom: 'Lac de montagne' },
  { id: 'feu-de-camp', nom: 'Feu de camp' },
  { id: 'ble', nom: 'Blé' },
];
export const urlPhoto = (id: string) => `/fonds/${id}.jpg`;

// Fond vivant de la Bande 16, ses bokeh seuls, dégradé de la palette, ou une photo
export type Fond = 'organique' | 'bokeh' | 'degrade' | `photo:${string}`;
const fondConnu = (v: unknown): v is Fond => v === 'organique' || v === 'bokeh' || v === 'degrade' || PHOTOS.some((p) => v === `photo:${p.id}`);

interface BackgroundState {
  currentPalette: ColorPalette;
  fond: Fond;
  setBackground: (paletteId: string) => void;
  choisirFond: (paletteId: string) => void;
  essayerFond: (fond: Fond) => void;
  garderFond: (fond: Fond) => void;
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
  fond: 'organique',

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

  // Fond montré sans être enregistré : un essai des réglages
  essayerFond: (fond) => set({ fond }),

  // Fond enregistré dans le profil, comme la palette
  garderFond: (fond) => {
    set({ fond });
    posterJson('/api/preferences', { preference: 'fond', value: fond }).catch(() => {});
  },

  resetBackground: () => set({ currentPalette: COLOR_PALETTES.default, fond: 'organique' }),

  // Préférences du profil de la session, sinon le fond par défaut
  loadPreference: async () => {
    const data = await lireJson<{ preferences?: { backgroundColor?: unknown; fond?: unknown } }>('/api/preferences', { signal: AbortSignal.timeout(5000) })
      .catch(() => null);
    const id = data?.preferences?.backgroundColor;
    const fond = data?.preferences?.fond;
    set({ currentPalette: (typeof id === 'string' && resolvePalette(id)) || COLOR_PALETTES.default, fond: fondConnu(fond) ? fond : 'organique' });
  },
}));
