/**
 * Store Zustand pour gérer le background de l'application
 */
import { create } from 'zustand';
import { COLOR_PALETTES, getDefaultPalette, type ColorPalette } from '../colorPalettes';

interface BackgroundState {
  currentPalette: ColorPalette;
  setBackground: (paletteId: string, shouldSave?: boolean, userId?: string) => void;
  resetBackground: () => void;
  loadUserPreference: (userId: string) => Promise<void>;
}

// IMPORTANT (prod): on passe par l'API Next (same-origin) pour éviter les erreurs CORS
// quand le backend est sur un autre domaine (Render).
const PREFERENCES_API_BASE = '/api/preferences';

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function cleanPaletteInput(value: string) {
  // Nettoyage tolérant: trim + suppression guillemets/ponctuation fréquente
  let v = String(value ?? '').trim();
  v = v.replace(/^[\s"'`“”«»]+/, '').replace(/[\s"'`“”«»]+$/, '').trim();
  // Retirer ponctuation/parenthèses finales (ex: "ocean.", "doré,", "forêt)")
  v = v.replace(/[.,;:!?]+$/g, '').replace(/[)\]}>]+$/g, '').trim();
  // Retirer parenthèses ouvrantes accidentelles
  v = v.replace(/^[([{<]+/g, '').trim();
  return v;
}

function normalizeKey(value: string) {
  const cleaned = cleanPaletteInput(value).toLowerCase();
  return stripDiacritics(cleaned)
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const PALETTE_LOOKUP = (() => {
  const map = new Map<string, ColorPalette>();
  Object.values(COLOR_PALETTES).forEach((palette) => {
    map.set(normalizeKey(palette.id), palette);
    map.set(normalizeKey(palette.name), palette);
  });
  return map;
})();

function resolvePalette(paletteId: string) {
  const cleaned = cleanPaletteInput(paletteId);
  if (!cleaned) return { palette: null as ColorPalette | null, canonicalId: null as string | null, cleaned };

  // 1) Match exact (IDs sensibles aux accents)
  const direct = COLOR_PALETTES[cleaned as keyof typeof COLOR_PALETTES] as ColorPalette | undefined;
  if (direct) return { palette: direct, canonicalId: direct.id, cleaned };

  // 2) Match minuscule exact
  const lower = COLOR_PALETTES[cleaned.toLowerCase() as keyof typeof COLOR_PALETTES] as ColorPalette | undefined;
  if (lower) return { palette: lower, canonicalId: lower.id, cleaned };

  // 3) Match tolérant (sans accents/espaces/ponctuation)
  const normalized = normalizeKey(cleaned);
  const directNormalized = PALETTE_LOOKUP.get(normalized) || null;
  if (directNormalized) {
    return { palette: directNormalized, canonicalId: directNormalized.id, cleaned };
  }

  // 4) Fallback: si le paramètre contient du texte additionnel (ex: "spectre. Voilà"),
  // on essaie des préfixes tokenisés (ex: ["spectre"] puis ["spectre","..."]).
  const parts = normalized.split('_').filter(Boolean);
  // Les IDs actuels sont courts (souvent 1 ou 2 tokens), on limite pour éviter des matches hasardeux.
  for (let take = 1; take <= Math.min(3, parts.length); take += 1) {
    const key = parts.slice(0, take).join('_');
    const hit = PALETTE_LOOKUP.get(key);
    if (hit) {
      return { palette: hit, canonicalId: hit.id, cleaned };
    }
  }

  return { palette: null, canonicalId: null, cleaned };
}

/**
 * Sauvegarde la préférence de couleur sur le backend
 */
async function savePreferenceToBackend(paletteId: string, userId?: string) {
  try {
    // IMPORTANT: ne jamais créer d'userId implicitement.
    const userIdToUse = userId || null;
    
    if (!userIdToUse) {
      return;
    }

    const payload = { 
      currentUserId: userIdToUse, 
      preference: 'backgroundColor', 
      value: paletteId 
    };
    
    const response = await fetch(PREFERENCES_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000) // Timeout de 5 secondes
    });

    if (response.ok) {
      await response.json().catch(() => null);
    } else {
      const errorText = await response.text();
      console.error('⚠️ Erreur sauvegarde préférence:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ Erreur sauvegarde préférence:', error);
  }
}

/**
 * Charge la préférence de couleur depuis le backend
 */
async function loadPreferenceFromBackend(userId: string): Promise<string | null> {
  try {
    console.log(`📡 [BACKEND API] GET ${PREFERENCES_API_BASE}/${userId}`);
    const response = await fetch(`${PREFERENCES_API_BASE}/${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000) // Timeout de 5 secondes
    });
    if (response.ok) {
      const data = await response.json();
      const bgColor = data.preferences?.backgroundColor || null;
      console.log(`📥 [BACKEND API] Préférence reçue:`, { backgroundColor: bgColor, allPrefs: data.preferences });
      return bgColor;
    }
    console.warn(`⚠️ [BACKEND API] Réponse non-OK: ${response.status}`);
    return null;
  } catch (error) {
    // Ne pas bloquer l'application si le fetch échoue (timeout, CORS, etc.)
    console.warn('⚠️ [BACKEND API] Erreur chargement préférence (non-bloquant):', error);
    return null;
  }
}

export const useBackgroundStore = create<BackgroundState>((set) => ({
  currentPalette: getDefaultPalette(),
  
  setBackground: (paletteId: string, shouldSave = true, userId?: string) => {
    const { palette, canonicalId, cleaned } = resolvePalette(paletteId);
    if (palette) {
      console.log(`🎨 Changement du fond vers: ${palette.name}`, { shouldSave, userId });
      set({ currentPalette: palette });
      
      // Sauvegarder automatiquement la préférence
      if (shouldSave) {
        // Toujours sauvegarder l'ID canonique (évite de persister "ocean." ou une variante)
        savePreferenceToBackend(canonicalId || palette.id, userId);
      } else {
      }
    } else {
      console.warn(`⚠️ Palette inconnue: "${paletteId}" (nettoyé: "${cleaned}")`);
    }
  },
  
  resetBackground: () => {
    set({ currentPalette: getDefaultPalette() });
  },
  
  loadUserPreference: async (userId: string) => {
    console.log(`🔍 [BACKGROUND STORE] Chargement des préférences pour userId: ${userId}`);
    const savedPaletteId = await loadPreferenceFromBackend(userId);
    if (savedPaletteId) {
      const { palette } = resolvePalette(savedPaletteId);
      if (palette) {
        console.log(`🎨 [BACKGROUND STORE] Palette trouvée: ${savedPaletteId} (${palette.name})`);
        set({ currentPalette: palette });
        console.log(`✅ [BACKGROUND STORE] Palette appliquée avec succès`);
        return;
      }
      console.warn(`⚠️ [BACKGROUND STORE] Palette sauvegardée inconnue: ${savedPaletteId}`);
    }

    if (savedPaletteId) {
      console.log(`⚠️ [BACKGROUND STORE] Préférence invalide (${savedPaletteId}), réinitialisation au défaut (Noir)`);
    } else {
      console.log(`⚠️ [BACKGROUND STORE] Aucune préférence trouvée, réinitialisation au défaut (Noir)`);
    }
    set({ currentPalette: getDefaultPalette() });
  },
}));

