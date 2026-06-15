import { create } from 'zustand';
import * as api from '../lib/api';

interface AuthUser {
  id: string;
  username: string;
  role: string;
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  superadminLogin: (password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
  isSuperadmin: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  error: null,

  login: async (username, password) => {
    set({ error: null });
    try {
      const res = await api.login(username, password);
      localStorage.setItem('token', res.access_token);
      api.setAuthToken(res.access_token);
      set({ token: res.access_token, user: res.user, error: null });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Erro ao fazer login';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  register: async (username, password) => {
    set({ error: null });
    try {
      const res = await api.register(username, password);
      localStorage.setItem('token', res.access_token);
      api.setAuthToken(res.access_token);
      set({ token: res.access_token, user: res.user, error: null });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Erro ao registrar';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    api.setAuthToken(null);
    set({ token: null, user: null });
  },

  isSuperadmin: () => {
    const { user } = get();
    return user?.role === 'superadmin';
  },

  superadminLogin: async (password) => {
    set({ error: null });
    try {
      const res = await api.superadminLogin(password);
      localStorage.setItem('token', res.access_token);
      api.setAuthToken(res.access_token);
      set({ token: res.access_token, user: res.user, error: null });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Senha inválida';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  loadFromStorage: async () => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken) {
      set({ isLoading: false });
      return;
    }
    try {
      api.setAuthToken(savedToken);
      const user = await api.getMe();
      set({ token: savedToken, user, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      api.setAuthToken(null);
      set({ token: null, user: null, isLoading: false });
    }
  },
}));
