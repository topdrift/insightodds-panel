'use client';

import { create } from 'zustand';
import api from '@/lib/api';

interface WhitelabelConfig {
  siteName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  cardColor: string;
  textColor: string;
  features: Record<string, boolean>;
}

interface ThemeState {
  config: WhitelabelConfig;
  isLoaded: boolean;
  fetchConfig: () => Promise<void>;
  updateConfig: (config: Partial<WhitelabelConfig>) => void;
  applyTheme: () => void;
}

const defaultConfig: WhitelabelConfig = {
  siteName: 'Shakti11',
  logoUrl: null,
  primaryColor: '#1e40af',
  secondaryColor: '#f59e0b',
  accentColor: '#10b981',
  bgColor: '#0f172a',
  cardColor: '#1e293b',
  textColor: '#f8fafc',
  features: { cricket: true, casino: true, matka: true },
};

export const useThemeStore = create<ThemeState>()((set, get) => ({
  config: defaultConfig,
  isLoaded: false,

  fetchConfig: async () => {
    try {
      const { data } = await api.get('/settings/whitelabel');
      set({ config: data, isLoaded: true });
      get().applyTheme();
    } catch {
      set({ isLoaded: true });
      get().applyTheme();
    }
  },

  updateConfig: (partial) => {
    set((state) => ({
      config: { ...state.config, ...partial },
    }));
    get().applyTheme();
  },

  applyTheme: () => {
    const { config } = get();
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--color-primary', config.primaryColor);
    root.style.setProperty('--color-secondary', config.secondaryColor);
    root.style.setProperty('--color-accent', config.accentColor);
    root.style.setProperty('--color-bg', config.bgColor);
    root.style.setProperty('--color-card', config.cardColor);
    root.style.setProperty('--color-text', config.textColor);
  },
}));
