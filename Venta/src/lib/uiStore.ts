import { create } from 'zustand';
import type { Compte } from '@/features/illusion/api';

type ViewMode = 'dashboard' | 'messaging';
type AppState = 'sleeping' | 'processing' | 'awake';
type Cote = 'ovrane' | 'illusion';

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
  // Vue ouverte ; une page d'Illusion s'écrit « illusion/<page>?<recherche> », comme son adresse
  page: string | null;
  // Canaux montrés par l'en-tête : ceux d'Ovrane, ou ceux d'Illusion pour un compte qui y a accès
  cote: Cote;
  // Compte d'Illusion de la session : undefined tant qu'il n'est pas lu, null sans accès ; le message quand Illusion ne répond pas
  compteIllusion: Compte | null | undefined;
  erreurIllusion: string | null;
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
  setCote: (cote: Cote) => void;
  setAppLocked: (locked: boolean, message?: string) => void;
  addWindow: (kind: Fenetre['kind'], content: string, position?: { x: number; y: number }) => string;
  // Texte d'une réponse qui s'allonge pendant qu'Ovrane la dit
  setWindowContent: (id: string, content: string) => void;
  closeWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  focusWindow: (id: string) => void;
  closeAllWindows: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'dashboard',
  appState: 'sleeping',
  page: null,
  cote: 'ovrane',
  compteIllusion: undefined,
  erreurIllusion: null,
  isAppLocked: false,
  lockedMessage: undefined,
  windows: [],
  maxZIndex: 100,
  sonCoupe: false,
  verreOpacite: VERRE_DEFAUT,

  // Le chat est d'Ovrane : l'ouvrir ou le fermer remet ses canaux
  setViewMode: (mode) => set({ viewMode: mode, cote: 'ovrane' }),
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
  // Ouvrir ou fermer une page ramène au tableau de bord : on revient toujours à l'écran de l'œil ; l'en-tête montre les canaux du côté de la page
  setPage: (page) => set({ page, viewMode: 'dashboard', cote: page?.startsWith('illusion/') ? 'illusion' : 'ovrane' }),
  setCote: (cote) => set({ cote }),
  setAppLocked: (locked, message) => set({ isAppLocked: locked, lockedMessage: message }),

  // Sans position, près du centre avec un léger décalage pour ne pas couvrir exactement la précédente
  addWindow: (kind, content, position) => {
    const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => {
      const decalage = Math.floor(Math.random() * 30);
      const fenetre: Fenetre = {
        id,
        kind,
        content,
        x: position?.x ?? window.innerWidth / 2 - 200 + decalage,
        y: position?.y ?? window.innerHeight / 2 - 150 + decalage,
        zIndex: s.maxZIndex + 1,
      };
      // Au-delà de 10, la plus ancienne se ferme
      return { maxZIndex: fenetre.zIndex, windows: [...s.windows, fenetre].slice(-MAX_FENETRES) };
    });
    return id;
  },
  setWindowContent: (id, content) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, content } : w)) })),
  closeWindow: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),
  moveWindow: (id, x, y) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) })),
  focusWindow: (id) =>
    set((s) => ({
      maxZIndex: s.maxZIndex + 1,
      windows: s.windows.map((w) => (w.id === id ? { ...w, zIndex: s.maxZIndex + 1 } : w)),
    })),
  closeAllWindows: () => set({ windows: [] }),
}));
