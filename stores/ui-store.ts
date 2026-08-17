/**
 * UI preferences store (Zustand).
 *
 * Centralise les préférences UI de l'utilisateur qui ne sont pas critiques
 * côté serveur : sidebar collapsée/expanded, command palette ouverte, etc.
 * Persisté en localStorage.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface UIStoreState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  /** Dernière route visitée — pour ré-ouvrir sur la bonne page après relogin. */
  lastRoute: string | null;
  _hasHydrated: boolean;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setLastRoute: (route: string) => void;
  setHasHydrated: (state: boolean) => void;
  clear: () => void;
}

export const useUIStore = create<UIStoreState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      lastRoute: null,
      _hasHydrated: false,

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setCommandPaletteOpen: (commandPaletteOpen) =>
        set({ commandPaletteOpen }),
      setLastRoute: (lastRoute) => set({ lastRoute }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      clear: () =>
        set({
          sidebarCollapsed: false,
          commandPaletteOpen: false,
          lastRoute: null,
        }),
    }),
    {
      name: "danael-ui-store",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      version: 2,
    },
  ),
);
