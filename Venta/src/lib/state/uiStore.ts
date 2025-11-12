/**
 * Store Zustand pour l'état de l'UI (overlay d'images, highlight de sections)
 */
import { create } from 'zustand';

interface ImageOverlay {
  visible: boolean;
  assetId?: string;
  alt?: string;
}

interface TextWindow {
  visible: boolean;
  content?: string;
  title?: string;
  x: number;
  y: number;
}

interface UIState {
  // État de l'overlay d'image
  imageOverlay: ImageOverlay;
  textWindow: TextWindow;
  
  // ID de la section actuellement highlightée
  highlightedId?: string;
  
  // Actions
  showImage: (assetId: string, alt?: string) => void;
  hideImage: () => void;
  showTextWindow: (content: string, title?: string, position?: { x: number; y: number }) => void;
  hideTextWindow: () => void;
  setTextWindowPosition: (x: number, y: number) => void;
  highlight: (id: string) => void;
  clearHighlight: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  imageOverlay: {
    visible: false,
  },
  textWindow: {
    visible: false,
    x: 160,
    y: 160,
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
  
  showTextWindow: (content: string, title?: string, position?: { x: number; y: number }) => {
    set({
      textWindow: {
        visible: true,
        content,
        title,
        x: position?.x ?? 160,
        y: position?.y ?? 160,
      },
    });
  },
  
  hideTextWindow: () => {
    set((state) => ({
      textWindow: {
        ...state.textWindow,
        visible: false,
        content: undefined,
        title: undefined,
      },
    }));
  },

  setTextWindowPosition: (x: number, y: number) => {
    set((state) => ({
      textWindow: {
        ...state.textWindow,
        x,
        y,
      },
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
