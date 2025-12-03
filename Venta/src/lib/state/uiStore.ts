/**
 * Store Zustand pour l'état de l'UI (overlay d'images, highlight de sections, intro)
 */
import { create } from 'zustand';

interface ImageOverlay {
  visible: boolean;
  assetId?: string;
  alt?: string;
}

interface TextWindow {
  id: string;
  visible: boolean;
  content?: string;
  title?: string;
  x: number;
  y: number;
  zIndex: number;
}

// Nouveaux états pour l'intro
export type AppState = 'sleeping' | 'processing' | 'awake';

interface UIState {
  // État global de l'application
  appState: AppState;
  userName: string | null;
  welcomeMessage: string | null;

  // État de l'overlay d'image
  imageOverlay: ImageOverlay;
  textWindows: TextWindow[];
  
  // Gestion globale du Z-Index pour toutes les fenêtres (Texte + Commandes)
  maxZIndex: number;
  incrementMaxZIndex: () => number; // Retourne la nouvelle valeur
  
  // ID de la section actuellement highlightée
  highlightedId?: string;
  
  // Actions
  setAppState: (state: AppState) => void;
  setUserName: (name: string) => void;
  setWelcomeMessage: (message: string) => void;
  
  showImage: (assetId: string, alt?: string) => void;
  hideImage: () => void;
  addTextWindow: (content: string, title?: string, position?: { x: number; y: number }) => void;
  closeTextWindow: (id: string) => void;
  setTextWindowPosition: (id: string, x: number, y: number) => void;
  bringTextWindowToFront: (id: string) => void;
  highlight: (id: string) => void;
  clearHighlight: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  appState: 'sleeping',
  userName: null,
  welcomeMessage: null,
  
  imageOverlay: {
    visible: false,
  },
  textWindows: [],
  
  maxZIndex: 50, // Commence à 50
  
  highlightedId: undefined,
  
  // Actions
  incrementMaxZIndex: () => {
    const newMax = get().maxZIndex + 1;
    set({ maxZIndex: newMax });
    return newMax;
  },
  
  setAppState: (appState) => set({ appState }),
  setUserName: (userName) => set({ userName }),
  setWelcomeMessage: (welcomeMessage) => set({ welcomeMessage }),
  
  showImage: (assetId: string, alt?: string) => {
    set({
      imageOverlay: {
        visible: true,
        assetId,
        alt,
      },
    });
  },
  
  hideImage: () => {
    set({
      imageOverlay: {
        visible: false,
        assetId: undefined,
        alt: undefined,
      },
    });
  },
  
  addTextWindow: (content: string, title?: string, position?: { x: number; y: number }) => {
    const id = Math.random().toString(36).substring(7);
    const randomOffset = Math.floor(Math.random() * 40) - 20; 
    const zIndex = get().incrementMaxZIndex();
    
    set((state) => ({
      textWindows: [
        ...state.textWindows,
        {
          id,
          visible: true,
          content,
          title: title ?? 'Réponse',
          x: (position?.x ?? 160) + randomOffset,
          y: (position?.y ?? 160) + randomOffset,
          zIndex,
        }
      ]
    }));
  },
  
  closeTextWindow: (id: string) => {
    set((state) => ({
      textWindows: state.textWindows.filter((window) => window.id !== id),
    }));
  },

  setTextWindowPosition: (id: string, x: number, y: number) => {
    set((state) => ({
      textWindows: state.textWindows.map((window) => 
        window.id === id ? { ...window, x, y } : window
      ),
    }));
  },
  
  bringTextWindowToFront: (id: string) => {
    const currentMax = get().maxZIndex;
    const window = get().textWindows.find(w => w.id === id);
    
    // Si la fenêtre est déjà au premier plan (zIndex == maxZIndex), inutile d'incrémenter
    if (window && window.zIndex === currentMax) return;
    
    const newZIndex = get().incrementMaxZIndex();
    set((state) => ({
      textWindows: state.textWindows.map((w) => 
        w.id === id ? { ...w, zIndex: newZIndex } : w
      ),
    }));
  },
  
  highlight: (id: string) => {
    set({ highlightedId: id });
    
    // Auto-clear après 4 secondes
    setTimeout(() => {
      set((state) => {
        if (state.highlightedId === id) {
          return { highlightedId: undefined };
        }
        return state;
      });
    }, 4000);
  },
  
  clearHighlight: () => {
    set({ highlightedId: undefined });
  },
}));
