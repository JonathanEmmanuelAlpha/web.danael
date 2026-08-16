/**
 * Store hydrator — receives server-side fetched user data + school context +
 * notifications + invitations + join requests, and pushes them into the
 * corresponding Zustand stores on the client.
 *
 * Placer ce composant au début du <DashboardShell /> (ou n'importe quel
 * layout protégé). Il ne rend rien visuellement.
 *
 * Usage :
 *   <StoreHydrator
 *     user={user}
 *     school={school}
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
  user: UserSessionData;
  school?: SchoolContextData | null;
  classes?: ClassContextData[];
  notifications?: NotificationItem[];
  invitations?: InvitationItem[];
  myJoinRequests?: JoinRequestItem[];
  receivedJoinRequests?: JoinRequestItem[];
  force?: boolean;
}

export function StoreHydrator({
  user,
  school,
  classes,
  notifications,
  invitations,
  myJoinRequests,
  receivedJoinRequests,
  force,
}: StoreHydratorProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current && !force) return;
    initialized.current = true;

    async function hydrateStores() {
      // 1. Récupérer les stores persistants
      const userStore = useUserStore;
      const schoolStore = useSchoolStore;
      const learningStore = useLearningStore;
      const uiStore = useUIStore;

      // 2. Déclencher manuellement l'hydratation depuis localStorage
      await Promise.all([
        userStore.persist.rehydrate(),
        schoolStore.persist.rehydrate(),
        learningStore.persist.rehydrate(),
        uiStore.persist.rehydrate(),
      ]);

      // 3. Injecter les données fraîches du serveur (écrase les éventuelles données obsolètes)
      if (user) {
        userStore.getState().hydrate(user);
      }
      if (school) {
        schoolStore.getState().hydrateSchool(school);
      }
      if (classes) {
        schoolStore.getState().hydrateClasses(classes);
      }

      // Notifications (pas de persist)
      useNotificationsStore.getState().hydrate({
        notifications,
        invitations,
        myJoinRequests,
        receivedJoinRequests,
      });

      // 4. Marquer tous les stores comme hydratés
      userStore.getState().setHasHydrated(true);
      schoolStore.getState().setHasHydrated(true);
      learningStore.getState().setHasHydrated(true);
      uiStore.getState().setHasHydrated(true);
    }

    hydrateStores();
  }, [force]); // Ne dépend que de force, pas des props (on ne veut qu'une seule exécution)

  return null;
}
