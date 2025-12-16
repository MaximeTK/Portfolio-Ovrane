import { create } from 'zustand';

interface TextWindow {
  id: string;
  content: string;
  title?: string;
  x: number;
  y: number;
  zIndex: number;
}

interface UIState {
  viewMode: 'dashboard' | 'messaging';
  appState: 'sleeping' | 'processing' | 'awake';
  userName?: string;
  maxZIndex: number;
  textWindows: TextWindow[];
  
  // Actions
  setViewMode: (mode: 'dashboard' | 'messaging') => void;
  setAppState: (state: 'sleeping' | 'processing' | 'awake') => void;
  setUserName: (name: string) => void;
  incrementMaxZIndex: () => number;
  
  // Gestion des fenêtres de texte (ex-TextWindow)
  addTextWindow: (content: string, title?: string, position?: { x: number; y: number }) => void;
  closeTextWindow: (id: string) => void;
  setTextWindowPosition: (id: string, x: number, y: number) => void;
  bringTextWindowToFront: (id: string) => void;
  closeAllWindows: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  viewMode: 'dashboard',
  appState: 'sleeping',
  userName: undefined,
  maxZIndex: 100,
  
  // États initiaux des composants
  textWindows: [],

  setViewMode: (mode) => set({ viewMode: mode }),
  
  setAppState: (state) => set({ appState: state }),
  setUserName: (name) => set({ userName: name }),
  
  incrementMaxZIndex: () => {
    const newZ = get().maxZIndex + 1;
    set({ maxZIndex: newZ });
    return newZ;
  },

  // Gestion des fenêtres de texte (Réponse IA)
  addTextWindow: (content, title = 'Réponse', position) => {
    const newZ = get().incrementMaxZIndex();
    const id = `text-window-${Date.now()}`;
    
    // Position par défaut centrée ou décalée si plusieurs
    const defaultX = typeof window !== 'undefined' ? window.innerWidth / 2 - 200 : 100;
    const defaultY = typeof window !== 'undefined' ? window.innerHeight / 2 - 150 : 100;
    
    // Léger décalage aléatoire pour éviter l'empilement parfait
    const randomOffset = Math.floor(Math.random() * 30);
    
    const newWindow: TextWindow = {
      id,
      content,
      title,
      x: position?.x ?? (defaultX + randomOffset),
      y: position?.y ?? (defaultY + randomOffset),
      zIndex: newZ
    };

    set((state) => ({
      textWindows: [...state.textWindows, newWindow]
    }));
  },

  closeTextWindow: (id) => {
    set((state) => ({
      textWindows: state.textWindows.filter((w) => w.id !== id)
    }));
  },

  setTextWindowPosition: (id, x, y) => {
    set((state) => ({
      textWindows: state.textWindows.map((w) => 
        w.id === id ? { ...w, x, y } : w
      )
    }));
  },

  bringTextWindowToFront: (id) => {
    const newZ = get().incrementMaxZIndex();
    set((state) => ({
      textWindows: state.textWindows.map((w) => 
        w.id === id ? { ...w, zIndex: newZ } : w
      )
    }));
  },

  closeAllWindows: () => {
    set({ textWindows: [] });
  }
}));
