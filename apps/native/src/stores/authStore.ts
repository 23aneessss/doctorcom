import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  name: string;
  title: string;
  specialty: string | null;
  avatar_url: string | null;
  telephone?: string | null;
  adresse?: string | null;
  nom?: string;
  prenom?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  finishLoading: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  setToken: (token) => set({ token }),

  login: async (user, token) => {
    set({
      user,
      token: token ?? null,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  loadStoredAuth: async () => {
    set((state) => ({
      ...state,
      isLoading: true,
    }));
  },

  finishLoading: () =>
    set((state) => ({
      ...state,
      isLoading: false,
    })),
}));
