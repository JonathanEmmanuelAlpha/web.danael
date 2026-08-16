"use client";

import { useEffect } from "react";
import { useUserStore } from "@/stores/user-store";
import { useSchoolStore } from "@/stores/school-store";
import { useLearningStore } from "@/stores/learning-store";
import { useUIStore } from "@/stores/ui-store";

/**
 * StoreInitializer - À placer DANS le layout racine (app/layout.tsx)
 * Il déclenche manuellement l'hydratation de TOUS les stores persistants
 * dès le montage côté client.
 */
export function StoreInitializer() {
  useEffect(() => {
    // Réhydrater manuellement tous les stores persistants
    useUserStore.persist.rehydrate();
    useSchoolStore.persist.rehydrate();
    useLearningStore.persist.rehydrate();
    useUIStore.persist.rehydrate();

    // Marquer chaque store comme hydraté (après réhydratation)
    // Note : ces appels doivent se faire APRÈS rehydrate()
    // pour éviter que le store ne soit marqué comme hydraté trop tôt
    const markHydrated = () => {
      useUserStore.getState().setHasHydrated(true);
      useSchoolStore.getState().setHasHydrated(true);
      useLearningStore.getState().setHasHydrated(true);
      useUIStore.getState().setHasHydrated(true);
    };

    // On attend que la réhydratation soit terminée
    // La réhydratation est synchrone (localStorage), donc on peut marquer immédiatement après
    // Mais pour être sûr, on utilise un microtask
    queueMicrotask(markHydrated);
  }, []);

  return null;
}
