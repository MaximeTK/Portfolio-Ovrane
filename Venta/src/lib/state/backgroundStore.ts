/**
 * Store Zustand pour gérer le background de l'application
 */
import { create } from 'zustand';
import { COLOR_PALETTES, getDefaultPalette, type ColorPalette } from '../colorPalettes';
import { getOrCreateUserId } from '../userId';

interface BackgroundState {
  currentPalette: ColorPalette;
  setBackground: (paletteId: string, shouldSave?: boolean, userId?: string) => void;
  resetBackground: () => void;
  loadUserPreference: (userId: string) => Promise<void>;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:3001';

/**
 * Sauvegarde la préférence de couleur sur le backend
 */
async function savePreferenceToBackend(paletteId: string, userId?: string) {
  try {
    // Utiliser l'userId fourni ou récupérer depuis localStorage
    const userIdToUse = userId || (typeof window !== 'undefined' ? getOrCreateUserId() : null);
    
    console.log('🔍 [DEBUG] savePreferenceToBackend appelée', {
      paletteId,
      userId,
      userIdToUse,
      BACKEND_URL
    });
    
    if (!userIdToUse) {
      console.warn('⚠️ Aucun userId trouvé, impossible de sauvegarder la préférence');
      return;
    }

    const payload = { 
      currentUserId: userIdToUse, 
      preference: 'backgroundColor', 
      value: paletteId 
    };
    
    console.log('📤 [DEBUG] Envoi requête POST vers:', `${BACKEND_URL}/api/preferences`, payload);

    const response = await fetch(`${BACKEND_URL}/api/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000) // Timeout de 5 secondes
    });

    console.log('📥 [DEBUG] Réponse reçue:', { status: response.status, ok: response.ok });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Préférence de couleur sauvegardée pour ${userIdToUse}: ${paletteId}`, data);
    } else {
      const errorText = await response.text();
      console.error('⚠️ Erreur lors de la sauvegarde de la préférence:', response.status, errorText);
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
    console.log(`📡 [BACKEND API] GET /api/preferences/${userId}`);
    const response = await fetch(`${BACKEND_URL}/api/preferences/${userId}`, {
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
    const palette = COLOR_PALETTES[paletteId];
    if (palette) {
      console.log(`🎨 Changement du fond vers: ${palette.name}`, { shouldSave, userId });
      set({ currentPalette: palette });
      
      // Sauvegarder automatiquement la préférence
      if (shouldSave) {
        console.log('💾 [DEBUG] Appel de savePreferenceToBackend...');
        savePreferenceToBackend(paletteId, userId);
      } else {
        console.log('⏭️ [DEBUG] Sauvegarde désactivée (shouldSave = false)');
      }
    } else {
      console.warn(`⚠️ Palette inconnue: ${paletteId}`);
    }
  },
  
  resetBackground: () => {
    set({ currentPalette: getDefaultPalette() });
  },
  
  loadUserPreference: async (userId: string) => {
    console.log(`🔍 [BACKGROUND STORE] Chargement des préférences pour userId: ${userId}`);
    const savedPaletteId = await loadPreferenceFromBackend(userId);
    if (savedPaletteId && COLOR_PALETTES[savedPaletteId]) {
      console.log(`🎨 [BACKGROUND STORE] Palette trouvée: ${savedPaletteId} (${COLOR_PALETTES[savedPaletteId].name})`);
      set({ currentPalette: COLOR_PALETTES[savedPaletteId] });
      console.log(`✅ [BACKGROUND STORE] Palette appliquée avec succès`);
    } else {
      console.log(`⚠️ [BACKGROUND STORE] Aucune préférence trouvée, réinitialisation au défaut (Noir)`);
      set({ currentPalette: getDefaultPalette() });
    }
  },
}));

