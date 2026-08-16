/**
 * School & class context store (Zustand).
 *
 * Centralise l'école / classe actuellement sélectionnée par l'utilisateur
 * (school_admin, teacher, student). Évite aux pages de re-fetcher "mon école"
 * ou "ma classe" à chaque navigation : on hydrate une fois au montage du
 * dashboard puis on lit depuis le store.
 *
 * Inclut aussi les compteurs (membres, classes, élèves) pour éviter des
 * queries DB répétées dans le Sidebar / Topbar.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface SchoolContextData {
  id: string;
  name: string;
  slug: string;
  type?: string | null;
  city?: string | null;
  region?: string | null;
  logoUrl?: string | null;
  isVerified?: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
  joinCode?: string | null;
  membersCount?: number;
  classesCount?: number;
  studentsCount?: number;
  teachersCount?: number;
}

export interface ClassContextData {
  id: string;
  schoolId: string;
  name: string;
  level?: string | null;
  series?: string | null;
  academicYear?: string | null;
  inviteCode?: string | null;
  headTeacherId?: string | null;
  membersCount?: number;
}

interface SchoolStoreState {
  currentSchool: SchoolContextData | null;
  currentClass: ClassContextData | null;
  schools: SchoolContextData[];
  classes: ClassContextData[];
  _hasHydrated: boolean;

  setSchools: (schools: SchoolContextData[]) => void;
  setClasses: (classes: ClassContextData[]) => void;
  setCurrentSchool: (school: SchoolContextData | null) => void;
  setCurrentClass: (cls: ClassContextData | null) => void;
  hydrateSchool: (school: SchoolContextData) => void;
  hydrateClasses: (classes: ClassContextData[]) => void;
  patchSchool: (partial: Partial<SchoolContextData>) => void;
  addClass: (cls: ClassContextData) => void;
  removeClass: (classId: string) => void;
  clear: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useSchoolStore = create<SchoolStoreState>()(
  persist(
    (set) => ({
      currentSchool: null,
      currentClass: null,
      schools: [],
      classes: [],
      _hasHydrated: false, // <- initialisation

      setSchools: (schools) =>
        set((state) => ({
          schools,
          currentSchool: state.currentSchool ?? schools[0] ?? null,
        })),
      setClasses: (classes) =>
        set((state) => ({
          classes,
          currentClass: state.currentClass ?? classes[0] ?? null,
        })),
      setCurrentSchool: (currentSchool) => set({ currentSchool }),
      setCurrentClass: (currentClass) => set({ currentClass }),
      hydrateSchool: (school) =>
        set((state) => ({
          currentSchool: school,
          schools: state.schools.some((s) => s.id === school.id)
            ? state.schools.map((s) => (s.id === school.id ? school : s))
            : [...state.schools, school],
        })),
      hydrateClasses: (classes) => set({ classes }),
      patchSchool: (partial) =>
        set((state) =>
          state.currentSchool
            ? { currentSchool: { ...state.currentSchool, ...partial } }
            : state,
        ),
      addClass: (cls) =>
        set((state) => ({
          classes: state.classes.some((c) => c.id === cls.id)
            ? state.classes.map((c) => (c.id === cls.id ? cls : c))
            : [...state.classes, cls],
        })),
      removeClass: (classId) =>
        set((state) => ({
          classes: state.classes.filter((c) => c.id !== classId),
          currentClass:
            state.currentClass?.id === classId ? null : state.currentClass,
        })),
      clear: () =>
        set({
          currentSchool: null,
          currentClass: null,
          schools: [],
          classes: [],
        }),
      setHasHydrated: (state) => set({ _hasHydrated: state }), // <- nouveau
    }),
    {
      name: "danael-school-store",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // <- désactive l'auto-hydratation
      version: 1,
    },
  ),
);

export const selectCurrentSchool = (s: SchoolStoreState) => s.currentSchool;
export const selectCurrentClass = (s: SchoolStoreState) => s.currentClass;
export const selectSchools = (s: SchoolStoreState) => s.schools;
export const selectClasses = (s: SchoolStoreState) => s.classes;
