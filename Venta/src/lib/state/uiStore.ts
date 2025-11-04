/**
 * Store Zustand pour l'état de l'UI (overlay d'images, highlight de sections)
 */
import { create } from 'zustand';

interface ImageOverlay {
  visible: boolean;
  assetId?: string;
  alt?: string;
}

interface UIState {
  // État de l'overlay d'image
  imageOverlay: ImageOverlay;
  
  // ID de la section actuellement highlightée
  highlightedId?: string;
  
  // Actions
  showImage: (assetId: string, alt?: string) => void;
  hideImage: () => void;
  highlight: (id: string) => void;
  clearHighlight: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  imageOverlay: {
    visible: false,
  },
  
  highlightedId: undefined,
  
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
