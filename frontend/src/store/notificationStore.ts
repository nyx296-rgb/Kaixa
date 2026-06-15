import { create } from 'zustand';
import * as api from '../lib/api';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: number;
  read: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  togglePanel: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,

  fetchNotifications: async () => {
    try {
      const data = await api.getNotifications();
      set({ notifications: data });
    } catch {
      set({ notifications: [] });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const data = await api.getUnreadCount();
      set({ unreadCount: data.count });
    } catch {
      set({ unreadCount: 0 });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.markNotificationRead(id);
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch {
      // silently fail
    }
  },

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
}));
