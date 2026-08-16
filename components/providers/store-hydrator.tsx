/**
 * StoreHydrator – Composant client qui hydrate les stores Zustand
 * avec les données récupérées côté serveur.
 *
 * Il doit être placé dans le layout protégé (ou DashboardShell),
 * après l'initialisation des stores mais avant que les composants
 * qui consomment les stores ne soient rendus.
 *
 * ATTENTION : Ce composant suppose que tous les stores persistants
 * ont été configurés avec :
 *   - `skipHydration: true`
 *   - un champ `_hasHydrated: boolean` et une action `setHasHydrated`
 *
 * Usage :
 *   <StoreHydrator
 *     user={user}
 *     school={school}
 *     classes={classes}
 *     notifications={notifications}
 *     invitations={invitations}
 *     myJoinRequests={myJoinRequests}
 *     receivedJoinRequests={receivedJoinRequests}
 *   />
 */

"use client";

import { useEffect, useRef } from "react";
import { useUserStore, type UserSessionData } from "@/stores/user-store";
import {
  useSchoolStore,
  type SchoolContextData,
  type ClassContextData,
} from "@/stores/school-store";
import {
  useNotificationsStore,
  type NotificationItem,
  type InvitationItem,
  type JoinRequestItem,
} from "@/stores/notifications-store";
import { useLearningStore } from "@/stores/learning-store";
import { useUIStore } from "@/stores/ui-store";

export interface StoreHydratorProps {
  /** Utilisateur courant (obligatoire) */
  user: UserSessionData;
  /** École courante (optionnelle) */
  school?: SchoolContextData | null;
  /** Liste des classes (optionnelle) */
  classes?: ClassContextData[];
  /** Notifications (optionnelles) */
  notifications?: NotificationItem[];
  /** Invitations (optionnelles) */
  invitations?: InvitationItem[];
  /** Demandes de rejoindre envoyées par l'utilisateur (optionnelles) */
  myJoinRequests?: JoinRequestItem[];
  /** Demandes de rejoindre reçues par l'utilisateur (optionnelles) */
  receivedJoinRequests?: JoinRequestItem[];
  /** Forcer une nouvelle hydratation même si déjà effectuée */
  force?: boolean;
}

/**
 * Hydrate tous les stores persistants avec les données serveur.
 * L'hydratation est déclenchée une seule fois au montage du composant.
 */
export function StoreHydrator({
  user,
  school,
  classes,
  notifications,
  invitations,
  myJoinRequests,
  receivedJoinRequests,
  force = false,
}: StoreHydratorProps) {
  // Ref pour éviter les doubles exécutions
  const isInitialized = useRef(false);

  useEffect(() => {
    // Ne s'exécute qu'une seule fois, sauf si force est true
    if (isInitialized.current && !force) return;
    isInitialized.current = true;

    // Récupération des stores
    const userStore = useUserStore;
    const schoolStore = useSchoolStore;
    const learningStore = useLearningStore;
    const uiStore = useUIStore;

    // 1. Réhydrater manuellement depuis localStorage
    // (les stores sont configurés avec skipHydration: true)
    userStore.persist.rehydrate();
    schoolStore.persist.rehydrate();
    learningStore.persist.rehydrate();
    uiStore.persist.rehydrate();

    // 2. Injecter les données serveur (écrase les éventuelles données périmées)
    // User
    if (user) {
      userStore.getState().hydrate(user);
    }

    // School & classes
    if (school) {
      schoolStore.getState().hydrateSchool(school);
    }
    if (classes && classes.length > 0) {
      schoolStore.getState().hydrateClasses(classes);
    }

    // Notifications / invitations / demandes
    useNotificationsStore.getState().hydrate({
      notifications,
      invitations,
      myJoinRequests,
      receivedJoinRequests,
    });

    // 3. Marquer tous les stores comme hydratés
    // Cela permet aux composants de savoir que les données sont prêtes.
    userStore.getState().setHasHydrated(true);
    schoolStore.getState().setHasHydrated(true);
    learningStore.getState().setHasHydrated(true);
    uiStore.getState().setHasHydrated(true);

    // (Les stores non persistants, comme notifications-store, n'ont pas besoin de flag)
  }, [
    user,
    school,
    classes,
    notifications,
    invitations,
    myJoinRequests,
    receivedJoinRequests,
    force,
  ]);

  // Ce composant ne rend rien
  return null;
}
