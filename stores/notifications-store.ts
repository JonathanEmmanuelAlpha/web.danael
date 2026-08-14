/**
 * Notifications & invitations store (Zustand).
 *
 * Centralise :
 *  - les notifications non lues (badge dans le Topbar)
 *  - les invitations reçues (in-app, en plus de l'email)
 *  - les demandes de rejoindre envoyées par l'utilisateur courant
 *  - les demandes reçues (pour school_admin / teacher)
 *
 * Alimenté par le serveur via hydratation initiale + SSE/refresh.
 */

import { create } from "zustand";

export interface NotificationItem {
  id: string;
  type:
    | "info"
    | "success"
    | "warning"
    | "error"
    | "invitation"
    | "join_request"
    | "announcement"
    | "message"
    | "assignment"
    | "quiz"
    | "grade";
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export interface InvitationItem {
  id: string;
  type: "school" | "class";
  refId: string; // schoolId ou classId
  refName: string;
  refPicture?: string | null;
  role: string;
  message?: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  invitedBy: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  createdAt: string;
  expiresAt?: string;
}

export interface JoinRequestItem {
  id: string;
  type: "school" | "class";
  refId: string;
  refName: string;
  role: string;
  message?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedBy: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  createdAt: string;
  decidedAt?: string;
}

interface NotificationsStoreState {
  notifications: NotificationItem[];
  invitations: InvitationItem[];
  myJoinRequests: JoinRequestItem[];
  receivedJoinRequests: JoinRequestItem[];

  unreadCount: number;
  pendingInvitationsCount: number;
  pendingRequestsCount: number;

  setNotifications: (items: NotificationItem[]) => void;
  addNotification: (item: NotificationItem) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;

  setInvitations: (items: InvitationItem[]) => void;
  addInvitation: (item: InvitationItem) => void;
  removeInvitation: (id: string) => void;
  updateInvitationStatus: (
    id: string,
    status: InvitationItem["status"],
  ) => void;

  setMyJoinRequests: (items: JoinRequestItem[]) => void;
  setReceivedJoinRequests: (items: JoinRequestItem[]) => void;
  addJoinRequest: (item: JoinRequestItem) => void;
  updateJoinRequestStatus: (
    id: string,
    status: JoinRequestItem["status"],
  ) => void;

  hydrate: (payload: {
    notifications?: NotificationItem[];
    invitations?: InvitationItem[];
    myJoinRequests?: JoinRequestItem[];
    receivedJoinRequests?: JoinRequestItem[];
  }) => void;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsStoreState>((set) => ({
  notifications: [],
  invitations: [],
  myJoinRequests: [],
  receivedJoinRequests: [],

  unreadCount: 0,
  pendingInvitationsCount: 0,
  pendingRequestsCount: 0,

  setNotifications: (items) =>
    set({
      notifications: items,
      unreadCount: items.filter((n) => !n.read).length,
    }),
  addNotification: (item) =>
    set((state) => ({
      notifications: [item, ...state.notifications].slice(0, 50),
      unreadCount: item.read ? state.unreadCount : state.unreadCount + 1,
    })),
  markAsRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      };
    }),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  setInvitations: (items) =>
    set({
      invitations: items,
      pendingInvitationsCount: items.filter((i) => i.status === "pending").length,
    }),
  addInvitation: (item) =>
    set((state) => ({
      invitations: [item, ...state.invitations],
      pendingInvitationsCount:
        item.status === "pending"
          ? state.pendingInvitationsCount + 1
          : state.pendingInvitationsCount,
    })),
  removeInvitation: (id) =>
    set((state) => ({
      invitations: state.invitations.filter((i) => i.id !== id),
    })),
  updateInvitationStatus: (id, status) =>
    set((state) => {
      const invitations = state.invitations.map((i) =>
        i.id === id ? { ...i, status } : i,
      );
      return {
        invitations,
        pendingInvitationsCount: invitations.filter(
          (i) => i.status === "pending",
        ).length,
      };
    }),

  setMyJoinRequests: (items) => set({ myJoinRequests: items }),
  setReceivedJoinRequests: (items) =>
    set({
      receivedJoinRequests: items,
      pendingRequestsCount: items.filter((r) => r.status === "pending").length,
    }),
  addJoinRequest: (item) =>
    set((state) => ({
      myJoinRequests: [item, ...state.myJoinRequests],
    })),
  updateJoinRequestStatus: (id, status) =>
    set((state) => {
      const myJoinRequests = state.myJoinRequests.map((r) =>
        r.id === id ? { ...r, status, decidedAt: new Date().toISOString() } : r,
      );
      const receivedJoinRequests = state.receivedJoinRequests.map((r) =>
        r.id === id ? { ...r, status, decidedAt: new Date().toISOString() } : r,
      );
      return {
        myJoinRequests,
        receivedJoinRequests,
        pendingRequestsCount: receivedJoinRequests.filter(
          (r) => r.status === "pending",
        ).length,
      };
    }),

  hydrate: (payload) =>
    set((state) => {
      const notifications = payload.notifications ?? state.notifications;
      const invitations = payload.invitations ?? state.invitations;
      const myJoinRequests = payload.myJoinRequests ?? state.myJoinRequests;
      const receivedJoinRequests =
        payload.receivedJoinRequests ?? state.receivedJoinRequests;
      return {
        notifications,
        invitations,
        myJoinRequests,
        receivedJoinRequests,
        unreadCount: notifications.filter((n) => !n.read).length,
        pendingInvitationsCount: invitations.filter(
          (i) => i.status === "pending",
        ).length,
        pendingRequestsCount: receivedJoinRequests.filter(
          (r) => r.status === "pending",
        ).length,
      };
    }),

  clear: () =>
    set({
      notifications: [],
      invitations: [],
      myJoinRequests: [],
      receivedJoinRequests: [],
      unreadCount: 0,
      pendingInvitationsCount: 0,
      pendingRequestsCount: 0,
    }),
}));

export const selectUnreadCount = (s: NotificationsStoreState) => s.unreadCount;
export const selectPendingInvitations = (s: NotificationsStoreState) =>
  s.invitations.filter((i) => i.status === "pending");
export const selectPendingRequests = (s: NotificationsStoreState) =>
  s.receivedJoinRequests.filter((r) => r.status === "pending");
