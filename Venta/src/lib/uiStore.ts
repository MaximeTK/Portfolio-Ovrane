import { create } from 'zustand';

type ViewMode = 'dashboard' | 'messaging';
type AppState = 'sleeping' | 'processing' | 'awake';

// Choix « voix coupée » et teinte des boîtes, gardés dans ce navigateur
export const CLE_SON = 'ovrane:son-coupe';
export const CLE_VERRE = 'ovrane:verre';
export const VERRE_DEFAUT = 0.55;
const MAX_FENETRES = 10;

/** Fenêtre flottante du tableau de bord : texte Markdown d'une réponse, ou nom d'une image de public/assets. */
export interface Fenetre {
  id: string;
  kind: 'text' | 'image';
  content: string;
  x: number;
  y: number;
  zIndex: number;
}

interface UIState {
  viewMode: ViewMode;
  appState: AppState;
  page: string | null;
  isAppLocked: boolean;
  lockedMessage?: string;
  windows: Fenetre[];
  maxZIndex: number;
  sonCoupe: boolean;
  verreOpacite: number;

  setViewMode: (mode: ViewMode) => void;
  basculerSon: () => void;
  reglerVerre: (opacite: number) => void;
  setAppState: (state: AppState) => void;
  setPage: (page: string | null) => void;
  setAppLocked: (locked: boolean, message?: string) => void;
  addWindow: (kind: Fenetre['kind'], content: string, position?: { x: number; y: number }) => void;
  closeWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  focusWindow: (id: string) => void;
  closeAllWindows: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'dashboard',
  appState: 'sleeping',
  page: null,
  isAppLocked: false,
  lockedMessage: undefined,
  windows: [],
  maxZIndex: 100,
  sonCoupe: false,
  verreOpacite: VERRE_DEFAUT,

  setViewMode: (mode) => set({ viewMode: mode }),
  // La variable CSS --verre-opacite teinte toutes les boîtes en verre (globals.css)
  reglerVerre: (opacite) => {
    document.documentElement.style.setProperty('--verre-opacite', String(opacite));
    try {
      localStorage.setItem(CLE_VERRE, String(opacite));
    } catch {
      // Stockage bloqué : le réglage vaut pour cette visite
    }
    set({ verreOpacite: opacite });
  },
  basculerSon: () =>
    set((s) => {
      try {
        localStorage.setItem(CLE_SON, s.sonCoupe ? '0' : '1');
      } catch {
        // Stockage bloqué : le choix vaut pour cette visite
      }
      return { sonCoupe: !s.sonCoupe };
    }),
  setAppState: (state) => set({ appState: state }),
  // Ouvrir ou fermer une page ramène au tableau de bord : on revient toujours à l'écran de l'œil
  setPage: (page) => set({ page, viewMode: 'dashboard' }),
  setAppLocked: (locked, message) => set({ isAppLocked: locked, lockedMessage: message }),

  // Sans position, près du centre avec un léger décalage pour ne pas couvrir exactement la précédente
  addWindow: (kind, content, position) =>
    set((s) => {
      const decalage = Math.floor(Math.random() * 30);
      const fenetre: Fenetre = {
        id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        content,
        x: position?.x ?? window.innerWidth / 2 - 200 + decalage,
        y: position?.y ?? window.innerHeight / 2 - 150 + decalage,
        zIndex: s.maxZIndex + 1,
      };
      // Au-delà de 10, la plus ancienne se ferme
      return { maxZIndex: fenetre.zIndex, windows: [...s.windows, fenetre].slice(-MAX_FENETRES) };
    }),
  closeWindow: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),
  moveWindow: (id, x, y) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) })),
  focusWindow: (id) =>
    set((s) => ({
      maxZIndex: s.maxZIndex + 1,
      windows: s.windows.map((w) => (w.id === id ? { ...w, zIndex: s.maxZIndex + 1 } : w)),
    })),
  closeAllWindows: () => set({ windows: [] }),
}));
