'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { getPortal } from '@/lib/subdomain';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'AGENT' | 'CLIENT';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  balance: number;
  exposure: number;
  creditReference: number;
  exposureLimit: number;
  myPartnership: number;
  myCasinoPartnership: number;
  myMatkaPartnership: number;
  matchCommission: number;
  sessionCommission: number;
  casinoCommission: number;
  matkaCommission: number;
  isBetLocked: boolean;
  isCasinoLocked: boolean;
  isMatkaLocked: boolean;
  resetPasswordRequired: boolean;
  mobile?: string;
  parentId?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  updateBalance: (balance: number, exposure?: number) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      _hasHydrated: false,
      setHasHydrated: (v: boolean) => set({ _hasHydrated: v }),

      login: async (username: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { username, password, subdomain: getPortal() });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);

          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isLoading: false,
          });

          connectSocket(data.accessToken);
        } catch (err: any) {
          set({ isLoading: false });
          throw new Error(err.response?.data?.error || 'Login failed');
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        disconnectSocket();
        set({ user: null, accessToken: null, refreshToken: null });
      },

      fetchUser: async () => {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data });
        } catch {
          // Token expired
        }
      },

      updateBalance: (balance: number, exposure?: number) => {
        const user = get().user;
        if (user) {
          set({ user: { ...user, balance, exposure: exposure ?? user.exposure } });
        }
      },
    }),
    {
      name: 'insightodds-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
