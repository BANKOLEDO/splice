import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  display_name: string;
  role: string;
  team_id?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, display_name: string, role: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string, user: User) => void;
  clearError: () => void;
}

const IS_DEV = typeof __DEV__ === 'undefined'
  ? ((globalThis as any)?.process?.env?.NODE_ENV !== 'production')
  : __DEV__;
const API_BASE = IS_DEV ? 'http://localhost:8000' : 'https://splice-api.onrender.com';


const getStorage = () => {
    try {
        const win = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
        if (win?.localStorage) {
            return createJSONStorage(() => win.localStorage);
        }
    } catch {}
    return undefined;  // zustand handles this gracefully
};
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || 'Login failed');
          }
          const data = await res.json();
          set({ token: data.token, user: data.user, isLoading: false });
        } catch (e: any) {
          set({ error: e.message, isLoading: false });
          throw e;
        }
      },

      register: async (username, password, display_name, role) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, display_name, role }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || 'Registration failed');
          }
          const data = await res.json();
          set({ token: data.token, user: data.user, isLoading: false });
        } catch (e: any) {
          set({ error: e.message, isLoading: false });
          throw e;
        }
      },

      logout: () => {
        set({ token: null, user: null, error: null });
        try {
          const win = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
          if (win?.localStorage) {
            win.localStorage.removeItem('splice-auth');
          }
        } catch {}
      },

      setToken: (token, user) => {
        set({ token, user });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'splice-auth',
      storage: getStorage(),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);
