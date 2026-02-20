'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore, Role } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useToastStore } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import {
  Plus,
  Edit3,
  Trash2,
  Image as ImageIcon,
  RefreshCw,
  ShieldAlert,
  Calendar,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Monitor,
} from 'lucide-react';

/* ───────────────────────── Types ───────────────────────── */

interface Banner {
  id: string;
  bannerUrl: string;
  bannerPriority: number;
  fromDate: string;
  toDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ───────────────────────── Banner Preview Carousel ───────────────────────── */

function BannerPreviewCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0);
  const activeBanners = banners.filter((b) => {
    const now = new Date();
    return b.isActive && new Date(b.fromDate) <= now && new Date(b.toDate) >= now;
  });

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const iv = setInterval(() => {
      setCurrent((prev) => (prev + 1) % activeBanners.length);
    }, 4000);
    return () => clearInterval(iv);
  }, [activeBanners.length]);

  if (activeBanners.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-700/30 bg-gray-800/30">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700/30">
        <Monitor className="h-4 w-4 text-[var(--color-secondary)]" />
        <span className="text-xs font-semibold text-gray-400">Client Preview</span>
        <Badge variant="info" className="ml-auto">{activeBanners.length} Active</Badge>
      </div>
      <div className="relative h-48 sm:h-56 md:h-64">
        {activeBanners.map((b, i) => (
          <div
            key={b.id}
            className={`absolute inset-0 transition-all duration-700 ${
              i === current ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.bannerUrl}
              alt={`Banner ${i + 1}`}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300"><rect fill="%231e293b" width="800" height="300"/><text fill="%23475569" font-size="20" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">Image not available</text></svg>';
              }}
            />
          </div>
        ))}

        {/* Navigation */}
        {activeBanners.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((prev) => (prev - 1 + activeBanners.length) % activeBanners.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrent((prev) => (prev + 1) % activeBanners.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {activeBanners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === current ? 'w-6 bg-[var(--color-secondary)]' : 'w-2 bg-white/40'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Banner Card ───────────────────────── */

function BannerCard({
  banner,
  onEdit,
  onDelete,
  onToggle,
}: {
  banner: Banner;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const now = new Date();
  const from = new Date(banner.fromDate);
  const to = new Date(banner.toDate);
  const isLive = banner.isActive && from <= now && to >= now;
  const isExpired = to < now;
  const isScheduled = from > now;

  return (
    <>
      <div className="group relative overflow-hidden rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl transition-all duration-300 hover:border-gray-600/40 hover:shadow-xl hover:shadow-black/20">
        {/* Image Preview */}
        <div className="relative h-44 bg-gray-800 overflow-hidden">
          {!imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner.bannerUrl}
              alt="Banner"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-800">
              <ImageIcon className="h-10 w-10 text-gray-600" />
            </div>
          )}

          {/* Overlay badges */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <button onClick={onToggle} className="transition-transform hover:scale-110">
              <Badge variant={banner.isActive ? 'success' : 'danger'}>
                {banner.isActive ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
                {banner.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </button>
            {isLive && (
              <Badge variant="info">
                <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                Live
              </Badge>
            )}
            {isExpired && <Badge variant="danger">Expired</Badge>}
            {isScheduled && <Badge variant="warning">Scheduled</Badge>}
          </div>
          <div className="absolute top-3 right-3">
            <span className="rounded-lg bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-white border border-white/10">
              #{banner.bannerPriority}
            </span>
          </div>

          {/* Full preview button */}
          <button
            onClick={() => setShowFullPreview(true)}
            className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-3">
            <p className="text-xs text-gray-400 truncate flex items-center gap-1">
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              {banner.bannerUrl}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(banner.fromDate)}
            </span>
            <span className="text-gray-600">to</span>
            <span>{formatDate(banner.toDate)}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-700/40 bg-gray-800/50 px-3 py-2.5 text-xs font-medium text-gray-300 hover:bg-gray-700/50 hover:text-white transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={onDelete}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-900/30 bg-red-900/10 px-3 py-2.5 text-xs font-medium text-red-400 hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Full Preview Modal */}
      {showFullPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowFullPreview(false)}>
          <div className="fixed inset-0 bg-black/80" />
          <div className="relative z-50 max-w-4xl w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner.bannerUrl}
              alt="Banner Preview"
              className="w-full rounded-2xl object-contain max-h-[80vh]"
            />
            <button
              onClick={() => setShowFullPreview(false)}
              className="absolute -top-4 -right-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-white border border-gray-700"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function BannersPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const role = user?.role as Role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Banner | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    bannerUrl: '',
    bannerPriority: 0,
    fromDate: '',
    toDate: '',
    isActive: true,
  });

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/dashboard-banner');
      setBanners(data.data || []);
    } catch {
      addToast('Failed to load banners', 'error');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    if (isAdmin) fetchBanners();
  }, [isAdmin, fetchBanners]);

  const resetForm = () => {
    setForm({ bannerUrl: '', bannerPriority: 0, fromDate: '', toDate: '', isActive: true });
  };

  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toISOString().split('T')[0];
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/dashboard-banner', form);
      addToast('Banner created successfully', 'success');
      setShowCreate(false);
      resetForm();
      fetchBanners();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to create banner', 'error');
    }
    setSubmitting(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setSubmitting(true);
    try {
      await api.put('/admin/dashboard-banner', {
        id: editItem.id,
        bannerUrl: form.bannerUrl,
        bannerPriority: form.bannerPriority,
        fromDate: form.fromDate,
        toDate: form.toDate,
        isActive: form.isActive,
      });
      addToast('Banner updated', 'success');
      setEditItem(null);
      resetForm();
      fetchBanners();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update banner', 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner permanently?')) return;
    try {
      await api.delete(`/admin/dashboard-banner/${id}`);
      addToast('Banner deleted', 'success');
      fetchBanners();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to delete banner', 'error');
    }
  };

  const toggleActive = async (banner: Banner) => {
    try {
      await api.put('/admin/dashboard-banner', {
        id: banner.id,
        isActive: !banner.isActive,
      });
      addToast(`Banner ${banner.isActive ? 'deactivated' : 'activated'}`, 'success');
      fetchBanners();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update', 'error');
    }
  };

  const openEdit = (banner: Banner) => {
    setForm({
      bannerUrl: banner.bannerUrl,
      bannerPriority: banner.bannerPriority,
      fromDate: formatDateForInput(banner.fromDate),
      toDate: formatDateForInput(banner.toDate),
      isActive: banner.isActive,
    });
    setEditItem(banner);
  };

  // Non-admin
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
            <ImageIcon className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Banners</h1>
        </div>
        <Card className="!border-dashed">
          <CardContent className="py-16 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-gray-500" />
            <p className="text-lg font-semibold text-gray-400 mb-1">Access Restricted</p>
            <p className="text-sm text-gray-500">You do not have permission to manage banners.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeBannerCount = banners.filter((b) => b.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
            <ImageIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard Banners</h1>
            <p className="text-xs text-gray-500">
              {banners.length} total &middot; {activeBannerCount} active
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchBanners} className="!rounded-xl">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }} className="!rounded-xl">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Banner
          </Button>
        </div>
      </div>

      {/* Client Preview */}
      {banners.length > 0 && <BannerPreviewCarousel banners={banners} />}

      {/* Banners Grid */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-700/30 bg-gray-800/30 animate-pulse">
              <div className="h-44 bg-gray-700" />
              <div className="p-4 space-y-3">
                <div className="h-3 w-3/4 rounded bg-gray-700" />
                <div className="flex gap-2">
                  <div className="h-3 w-1/3 rounded bg-gray-700" />
                  <div className="h-3 w-1/3 rounded bg-gray-700" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 flex-1 rounded-xl bg-gray-700" />
                  <div className="h-9 flex-1 rounded-xl bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : banners.length === 0 ? (
        <Card className="!border-dashed">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
              <ImageIcon className="h-7 w-7 text-gray-500" />
            </div>
            <p className="text-lg font-semibold text-gray-400 mb-1">No Banners</p>
            <p className="text-sm text-gray-500 mb-4">
              Create your first banner to display on the client dashboard.
            </p>
            <Button onClick={() => { resetForm(); setShowCreate(true); }} className="!rounded-xl">
              <Plus className="mr-1.5 h-4 w-4" /> Add Banner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {banners
            .sort((a, b) => a.bannerPriority - b.bannerPriority)
            .map((banner) => (
              <BannerCard
                key={banner.id}
                banner={banner}
                onEdit={() => openEdit(banner)}
                onDelete={() => handleDelete(banner.id)}
                onToggle={() => toggleActive(banner)}
              />
            ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Banner">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Banner Image URL"
            value={form.bannerUrl}
            onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
            placeholder="https://example.com/banner.jpg"
            required
          />
          {form.bannerUrl && (
            <div className="rounded-xl overflow-hidden bg-gray-800 h-36 border border-gray-700/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.bannerUrl}
                alt="Preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <Input
            label="Priority (lower = higher priority)"
            type="number"
            value={form.bannerPriority.toString()}
            onChange={(e) => setForm({ ...form, bannerPriority: parseInt(e.target.value) || 0 })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="From Date"
              type="date"
              value={form.fromDate}
              onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
              required
            />
            <Input
              label="To Date"
              type="date"
              value={form.toDate}
              onChange={(e) => setForm({ ...form, toDate: e.target.value })}
              required
            />
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
            {submitting ? 'Creating...' : 'Create Banner'}
          </Button>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Banner">
        <form onSubmit={handleEdit} className="space-y-4">
          <Input
            label="Banner Image URL"
            value={form.bannerUrl}
            onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
            placeholder="https://example.com/banner.jpg"
            required
          />
          {form.bannerUrl && (
            <div className="rounded-xl overflow-hidden bg-gray-800 h-36 border border-gray-700/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.bannerUrl}
                alt="Preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <Input
            label="Priority"
            type="number"
            value={form.bannerPriority.toString()}
            onChange={(e) => setForm({ ...form, bannerPriority: parseInt(e.target.value) || 0 })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="From Date"
              type="date"
              value={form.fromDate}
              onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
              required
            />
            <Input
              label="To Date"
              type="date"
              value={form.toDate}
              onChange={(e) => setForm({ ...form, toDate: e.target.value })}
              required
            />
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
            {submitting ? 'Updating...' : 'Update Banner'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
