'use client';

import { useAuthStore } from '@/store/auth';
import { formatCurrency } from '@/lib/utils';
import { Bell, Wallet, X } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';

interface Announcement {
  id: string;
  title?: string;
  message?: string;
  content?: string;
  text?: string;
  createdAt?: string;
}

export default function Header() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    api.get('/notifications').then(({ data }) => {
      setNotifications(data.unread || 0);
    }).catch(() => {});
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setBellOpen(false);
      }
    }
    if (bellOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [bellOpen]);

  const fetchAnnouncements = useCallback(async () => {
    setLoadingAnnouncements(true);
    try {
      const { data } = await api.get('/auth/announcement');
      const items: Announcement[] = Array.isArray(data) ? data : data?.announcements || data?.data || data?.records || [];
      setAnnouncements(items);
    } catch {
      setAnnouncements([]);
    }
    setLoadingAnnouncements(false);
  }, []);

  const handleBellClick = () => {
    const opening = !bellOpen;
    setBellOpen(opening);
    if (opening) {
      fetchAnnouncements();
    }
  };

  if (!user) return null;

  return (
    <header className="flex items-center justify-between border-b border-gray-700 bg-[var(--color-card)] pl-16 md:pl-6 pr-6 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2">
          <Wallet className="h-4 w-4 text-[var(--color-secondary)]" />
          <div>
            <p className="text-xs text-gray-400">Balance</p>
            <p className="text-sm font-bold text-[var(--color-secondary)]">
              {formatCurrency(user.balance)}
            </p>
          </div>
        </div>
        {user.role === 'CLIENT' && (
          <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2">
            <div>
              <p className="text-xs text-gray-400">Exposure</p>
              <p className="text-sm font-bold text-red-400">
                {formatCurrency(user.exposure)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Bell with dropdown */}
        <div className="relative" ref={bellRef}>
          <button
            className="relative text-gray-400 hover:text-white transition-colors"
            onClick={handleBellClick}
          >
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                {notifications}
              </span>
            )}
          </button>

          {/* Announcements dropdown */}
          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl z-50">
              <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
                <h4 className="text-sm font-semibold text-white">Announcements</h4>
                <button
                  onClick={() => setBellOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-2">
                {loadingAnnouncements ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <span className="ml-2 text-sm text-gray-400">Loading...</span>
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No announcements</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {announcements.map((a, idx) => (
                      <div
                        key={a.id || idx}
                        className="rounded-lg bg-gray-800/60 px-3 py-2.5 hover:bg-gray-800 transition-colors"
                      >
                        {a.title && (
                          <p className="text-sm font-medium text-white mb-0.5">{a.title}</p>
                        )}
                        <p className="text-xs text-gray-400 leading-relaxed">
                          {a.message || a.content || a.text || 'No details'}
                        </p>
                        {a.createdAt && (
                          <p className="text-[10px] text-gray-600 mt-1">
                            {new Date(a.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-gray-400">{user.role}</p>
        </div>
      </div>
    </header>
  );
}
