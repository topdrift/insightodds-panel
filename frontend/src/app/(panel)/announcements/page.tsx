'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore, Role } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useToastStore } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import {
  Plus,
  Edit3,
  Trash2,
  Megaphone,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Volume2,
  MessageSquare,
} from 'lucide-react';

/* ───────────────────────── Types ───────────────────────── */

interface Announcement {
  id: string;
  announcement: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

/* ───────────────────────── Marquee Ticker ───────────────────────── */

function AnnouncementTicker() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    api.get('/auth/announcement')
      .then(({ data }) => setAnnouncements(data || []))
      .catch(() => {});
  }, []);

  if (announcements.length === 0) return null;

  const text = announcements.map((a) => a.announcement).join('     \u2022     ');

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-700/30 bg-gradient-to-r from-[var(--color-primary)]/15 via-gray-900/60 to-[var(--color-primary)]/15 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-secondary)]/5 to-transparent" />
      <div className="relative flex items-center gap-4 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-secondary)]/20 border border-[var(--color-secondary)]/30">
          <Volume2 className="h-4 w-4 text-[var(--color-secondary)]" />
        </div>
        <div className="overflow-hidden flex-1">
          <div className="animate-marquee whitespace-nowrap text-sm font-medium text-white">
            {text}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 35s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

/* ───────────────────────── Client Announcements List ───────────────────────── */

function ClientAnnouncementsList() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/announcement')
      .then(({ data }) => setAnnouncements(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getPriorityConfig = (priority: number) => {
    if (priority >= 8) return { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Urgent' };
    if (priority >= 5) return { icon: <AlertCircle className="h-4 w-4" />, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Important' };
    return { icon: <Info className="h-4 w-4" />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Info' };
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-700/30 bg-gray-800/30 p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-gray-700" />
              <div className="h-4 w-20 rounded bg-gray-700" />
            </div>
            <div className="h-4 w-3/4 rounded bg-gray-700 mb-2" />
            <div className="h-3 w-1/4 rounded bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <Card className="!border-dashed">
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
            <Bell className="h-7 w-7 text-gray-500" />
          </div>
          <p className="text-lg font-semibold text-gray-400 mb-1">No Announcements</p>
          <p className="text-sm text-gray-500">You will see announcements here when they are posted.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((item) => {
        const config = getPriorityConfig(item.priority);
        return (
          <div
            key={item.id}
            className={`rounded-2xl border ${config.bg} backdrop-blur-xl p-5 transition-all duration-200 hover:shadow-lg`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${config.bg} ${config.color}`}>
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={item.priority >= 8 ? 'danger' : item.priority >= 5 ? 'warning' : 'info'}>
                    {config.label}
                  </Badge>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{item.announcement}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Admin Management ───────────────────────── */

function AdminAnnouncementsManager() {
  const { addToast } = useToastStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    announcement: '',
    priority: 0,
    isActive: true,
  });

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/announcements');
      setAnnouncements(data.data || []);
    } catch {
      addToast('Failed to load announcements', 'error');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const resetForm = () => {
    setForm({ announcement: '', priority: 0, isActive: true });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.announcement.trim()) {
      addToast('Announcement text is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/announcement', form);
      addToast('Announcement created successfully', 'success');
      setShowCreate(false);
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to create announcement', 'error');
    }
    setSubmitting(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setSubmitting(true);
    try {
      await api.put('/admin/announcement', {
        id: editItem.id,
        announcement: form.announcement,
        priority: form.priority,
        isActive: form.isActive,
      });
      addToast('Announcement updated', 'success');
      setEditItem(null);
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update', 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/admin/announcement/${id}`);
      addToast('Announcement deleted', 'success');
      fetchAnnouncements();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
    setDeleting(null);
  };

  const toggleActive = async (item: Announcement) => {
    try {
      await api.put('/admin/announcement', {
        id: item.id,
        isActive: !item.isActive,
      });
      addToast(`Announcement ${item.isActive ? 'deactivated' : 'activated'}`, 'success');
      fetchAnnouncements();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update', 'error');
    }
  };

  const openEdit = (item: Announcement) => {
    setForm({
      announcement: item.announcement,
      priority: item.priority,
      isActive: item.isActive,
    });
    setEditItem(item);
  };

  const getPriorityLabel = (p: number) => {
    if (p >= 8) return { variant: 'danger' as const, text: 'Urgent' };
    if (p >= 5) return { variant: 'warning' as const, text: 'Important' };
    if (p >= 3) return { variant: 'info' as const, text: 'Normal' };
    return { variant: 'default' as const, text: 'Low' };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[var(--color-secondary)]" />
          Manage Announcements
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchAnnouncements} className="!rounded-xl">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }} className="!rounded-xl">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New
          </Button>
        </div>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-700/30 bg-gray-800/30 p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-4 w-full rounded bg-gray-700" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-16 rounded-full bg-gray-700" />
                <div className="h-6 w-16 rounded-full bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card className="!border-dashed">
          <CardContent className="py-12 text-center">
            <Megaphone className="mx-auto mb-3 h-10 w-10 text-gray-500" />
            <p className="text-gray-400">No announcements yet. Create your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((item) => {
            const pl = getPriorityLabel(item.priority);
            return (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl transition-all duration-200 hover:border-gray-600/40"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 leading-relaxed mb-3">{item.announcement}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={pl.variant}>{pl.text}</Badge>
                        <button
                          onClick={() => toggleActive(item)}
                          className="transition-all hover:scale-105"
                        >
                          <Badge variant={item.isActive ? 'success' : 'danger'}>
                            {item.isActive ? (
                              <span className="flex items-center gap-1"><ToggleRight className="h-3 w-3" /> Active</span>
                            ) : (
                              <span className="flex items-center gap-1"><ToggleLeft className="h-3 w-3" /> Inactive</span>
                            )}
                          </Badge>
                        </button>
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting === item.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        {deleting === item.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Announcement">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Announcement Text</label>
            <textarea
              value={form.announcement}
              onChange={(e) => setForm({ ...form, announcement: e.target.value })}
              rows={4}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-secondary)] resize-none"
              placeholder="Enter your announcement..."
              required
            />
            <p className="text-xs text-gray-500 text-right">{form.announcement.length} characters</p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Priority</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="10"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
                className="flex-1 accent-[var(--color-secondary)]"
              />
              <span className="text-sm font-medium text-white w-8 text-center">{form.priority}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 px-1">
              <span>Low</span><span>Normal</span><span>Important</span><span>Urgent</span>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-[var(--color-secondary)]"
            />
            <div>
              <span className="text-sm font-medium text-white">Active</span>
              <p className="text-xs text-gray-500">Show this announcement to users immediately</p>
            </div>
          </label>

          <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Announcement'}
          </Button>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Announcement">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Announcement Text</label>
            <textarea
              value={form.announcement}
              onChange={(e) => setForm({ ...form, announcement: e.target.value })}
              rows={4}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-secondary)] resize-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Priority</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="10"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
                className="flex-1 accent-[var(--color-secondary)]"
              />
              <span className="text-sm font-medium text-white w-8 text-center">{form.priority}</span>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-[var(--color-secondary)]"
            />
            <span className="text-sm font-medium text-white">Active</span>
          </label>

          <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
            {submitting ? 'Updating...' : 'Update Announcement'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const role = user?.role as Role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <p className="text-xs text-gray-500">
            {isAdmin ? 'Manage platform announcements' : 'Latest updates and news'}
          </p>
        </div>
      </div>

      {/* Ticker for all roles */}
      <AnnouncementTicker />

      {/* Admin management */}
      {isAdmin && <AdminAnnouncementsManager />}

      {/* Client list view */}
      {!isAdmin && <ClientAnnouncementsList />}
    </div>
  );
}
