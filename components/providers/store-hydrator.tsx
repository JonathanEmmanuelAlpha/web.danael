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
import { useSchoolStore, type SchoolContextData, type ClassContextData } from "@/stores/school-store";
import {
  useNotificationsStore,
  type NotificationItem,
  type InvitationItem,
  type JoinRequestItem,
} from "@/stores/notifications-store";

export interface StoreHydratorProps {
  user: UserSessionData;
  school?: SchoolContextData | null;
  classes?: ClassContextData[];
  notifications?: NotificationItem[];
  invitations?: InvitationItem[];
  myJoinRequests?: JoinRequestItem[];
  receivedJoinRequests?: JoinRequestItem[];
  /** Force re-hydrate even if data is the same (e.g. after navigation). */
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
  const hydrateUser = useUserStore((s) => s.hydrate);
  const hydrateSchool = useSchoolStore((s) => s.hydrateSchool);
  const hydrateClasses = useSchoolStore((s) => s.hydrateClasses);
  const hydrateNotifications = useNotificationsStore((s) => s.hydrate);

  // Use a ref to track the last user id we hydrated, to avoid loops.
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (force || lastUserId.current !== user.id) {
      hydrateUser(user);
      lastUserId.current = user.id;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (school) {
      hydrateSchool(school);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school?.id]);

  useEffect(() => {
    if (classes) {
      hydrateClasses(classes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(classes)]);

  useEffect(() => {
    hydrateNotifications({
      notifications,
      invitations,
      myJoinRequests,
      receivedJoinRequests,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(notifications),
    JSON.stringify(invitations),
    JSON.stringify(myJoinRequests),
    JSON.stringify(receivedJoinRequests),
  ]);

  return null;
}
