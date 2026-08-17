/**
 * User session store (Zustand).
 *
 * Centralises les données de l'utilisateur courant (session Clerk + ligne DB)
 * pour éviter de les re-fetcher à chaque changement de page. Le serveur hydrate
 * ce store une seule fois via <UserStoreHydrator /> placé dans le layout du
 * dashboard. Ensuite, tous les composants client (Topbar, Sidebar, etc.) lisent
 * les données depuis le store au lieu d'appeler useUser() / getCurrentDbUser()
 * à chaque rendu.
 *
 * Bénéfice direct : plus d'appels réseau répétés à l'API Clerk ni à la DB,
 * navigation instantanée entre pages.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface UserSessionData {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  role:
    | "student"
    | "teacher"
    | "school_admin"
    | "parent"
    | "tutor"
    | "platform_admin"
    | "content_moderator"
    | "support";
  level?: string | null;
  series?: string | null;
  onboardingStatus?: "not_started" | "pending" | "completed" | "skipped";
  language?: string;
  theme?: string;
  avatarUrl?: string | null;
}

interface UserStoreState {
  user: UserSessionData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  _hasHydrated: boolean; // <- nouveau

  setUser: (user: UserSessionData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  hydrate: (user: UserSessionData) => void;
  clear: () => void;
  /** Patch partiel (utile après update de profil). */
  patch: (partial: Partial<UserSessionData>) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      error: null,
      lastFetchedAt: null,
      _hasHydrated: false, // <- initialisation

      setUser: (user) => set({ user, lastFetchedAt: Date.now() }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      hydrate: (user) =>
        set({ user, isLoading: false, error: null, lastFetchedAt: Date.now() }),
      clear: () =>
        set({
          user: null,
          isLoading: false,
          error: null,
          lastFetchedAt: null,
        }),
      patch: (partial) =>
        set((state) =>
          state.user ? { user: { ...state.user, ...partial } } : state,
        ),
      setHasHydrated: (state) => set({ _hasHydrated: state }), // <- nouveau
    }),
    {
      name: "danael-user-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        lastFetchedAt: state.lastFetchedAt,
      }),
      skipHydration: true,
      version: 2,
    },
  ),
);

/** Sélecteurs pratiques (stable references). */
export const selectUser = (s: UserStoreState) => s.user;
export const selectUserRole = (s: UserStoreState) => s.user?.role ?? null;
export const selectUserDisplayName = (s: UserStoreState) => {
  if (!s.user) return undefined;
  return (
    [s.user.firstName, s.user.lastName].filter(Boolean).join(" ") || undefined
  );
};
export const selectUserInitials = (s: UserStoreState) => {
  if (!s.user) return "?";
  const name = [s.user.firstName, s.user.lastName].filter(Boolean).join(" ");
  if (!name) return s.user.email.slice(0, 2).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};
export const selectIsAuthenticated = (s: UserStoreState) => s.user !== null;
