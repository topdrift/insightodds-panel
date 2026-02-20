'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { connectSocket } from '@/lib/socket';
import { getAllowedRoles } from '@/lib/subdomain';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, _hasHydrated, fetchUser, updateBalance, logout } = useAuthStore();
  const { fetchConfig } = useThemeStore();

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    // Wait for zustand persist to hydrate before making routing decisions
    if (!_hasHydrated) return;

    if (!accessToken && pathname !== '/login') {
      router.push('/login');
      return;
    }

    if (accessToken && pathname === '/login') {
      router.push('/dashboard');
      return;
    }

    if (accessToken && !user) {
      fetchUser();
    }

    // Subdomain-role enforcement
    if (user && !getAllowedRoles().includes(user.role)) {
      logout();
      router.push('/login');
      return;
    }
  }, [accessToken, pathname, user, router, fetchUser, logout, _hasHydrated]);

  // Socket connection & listeners
  useEffect(() => {
    if (!accessToken) return;

    const socket = connectSocket(accessToken);

    socket.on('balance:updated', (data: any) => {
      if (data.balance !== undefined) {
        updateBalance(parseFloat(data.balance), data.exposure ? parseFloat(data.exposure) : undefined);
      } else {
        fetchUser();
      }
    });

    return () => {
      socket.off('balance:updated');
    };
  }, [accessToken, updateBalance, fetchUser]);

  // Show nothing while hydrating (prevents flash)
  if (!_hasHydrated) {
    return null;
  }

  if (!accessToken && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
