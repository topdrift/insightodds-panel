'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore, Role } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useToastStore } from '@/components/ui/toast';
import { formatDate, formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import {
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Ticket,
  Copy,
  Check,
  Gift,
  Users,
  Calendar,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  Eye,
  Hash,
  Search,
  Target,
  Clock,
  Zap,
} from 'lucide-react';

/* ───────────────────────── Types ───────────────────────── */

interface MarketingBetJob {
  id: string;
  userId: string;
  target: string;
  amount: string;
  scheduledAt: string;
  executedAt: string | null;
  betId: string | null;
  betType: string | null;
  status: string;
  error: string | null;
  createdAt: string;
}

interface PromoCode {
  id: string;
  code: string;
  type: 'BALANCE_CREDIT' | 'REFERRAL_BONUS' | 'MARKETING';
  description: string | null;
  amount: string;
  agentId: string | null;
  agent: { id: string; username: string; name: string } | null;
  agentBonus: string;
  clientBonus: string;
  maxUses: number;
  usedCount: number;
  minRole: string;
  expiresAt: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  marketingTarget: string | null;
  marketingWinAmount: string | null;
  marketingSpreadHrs: number | null;
  marketingJobs?: MarketingBetJob[];
  _count: { redemptions: number };
}

interface PromoRedemption {
  id: string;
  promoCodeId: string;
  userId: string;
  amount: string;
  ip: string | null;
  createdAt: string;
  user?: { id: string; username: string; name: string; role: string };
  promoCode?: { code: string; type: string; description: string | null };
}

/* ───────────────────────── Copy Button ───────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button onClick={copy} className="ml-1.5 text-gray-400 hover:text-white transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ───────────────────────── Admin Promo Manager ───────────────────────── */

function AdminPromoManager() {
  const { addToast } = useToastStore();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<PromoCode | null>(null);
  const [detailItem, setDetailItem] = useState<PromoCode | null>(null);
  const [detailRedemptions, setDetailRedemptions] = useState<PromoRedemption[]>([]);
  const [detailMarketingJobs, setDetailMarketingJobs] = useState<MarketingBetJob[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, active: 0, totalRedemptions: 0 });

  const [form, setForm] = useState({
    code: '',
    type: 'BALANCE_CREDIT' as 'BALANCE_CREDIT' | 'REFERRAL_BONUS' | 'MARKETING',
    description: '',
    amount: 0,
    agentId: '',
    agentBonus: 0,
    clientBonus: 0,
    maxUses: 0,
    expiresAt: '',
    isActive: true,
    marketingTarget: 'BOTH' as 'CASINO' | 'CRICKET' | 'BOTH',
    marketingWinAmount: 0,
    marketingSpreadHrs: 3,
  });

  const [editForm, setEditForm] = useState({
    description: '',
    maxUses: 0,
    isActive: true,
    expiresAt: '',
  });

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, size: 20 };
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      const { data } = await api.get('/promo', { params });
      setPromos(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);

      // Calculate stats from full list
      const statsRes = await api.get('/promo', { params: { size: 1, active: 'true' } });
      const allRes = await api.get('/promo', { params: { size: 1 } });
      setStats({
        total: allRes.data.pagination?.total || 0,
        active: statsRes.data.pagination?.total || 0,
        totalRedemptions: (data.data || []).reduce((sum: number, p: PromoCode) => sum + p._count.redemptions, 0),
      });
    } catch {
      addToast('Failed to load promo codes', 'error');
    }
    setLoading(false);
  }, [addToast, page, search, filterType]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const resetForm = () => {
    setForm({
      code: '',
      type: 'BALANCE_CREDIT',
      description: '',
      amount: 0,
      agentId: '',
      agentBonus: 0,
      clientBonus: 0,
      maxUses: 0,
      expiresAt: '',
      isActive: true,
      marketingTarget: 'BOTH',
      marketingWinAmount: 0,
      marketingSpreadHrs: 3,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      addToast('Promo code is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        code: form.code,
        type: form.type,
        description: form.description || undefined,
        maxUses: form.maxUses,
        isActive: form.isActive,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      };
      if (form.type === 'BALANCE_CREDIT') {
        payload.amount = form.amount;
      } else if (form.type === 'REFERRAL_BONUS') {
        payload.agentId = form.agentId || undefined;
        payload.agentBonus = form.agentBonus;
        payload.clientBonus = form.clientBonus;
      } else if (form.type === 'MARKETING') {
        payload.amount = form.amount;
        payload.marketingTarget = form.marketingTarget;
        payload.marketingWinAmount = form.marketingWinAmount;
        payload.marketingSpreadHrs = form.marketingSpreadHrs;
      }
      await api.post('/promo', payload);
      addToast('Promo code created successfully', 'success');
      setShowCreate(false);
      resetForm();
      fetchPromos();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to create promo code', 'error');
    }
    setSubmitting(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setSubmitting(true);
    try {
      await api.put(`/promo/${editItem.id}`, {
        description: editForm.description || undefined,
        maxUses: editForm.maxUses,
        isActive: editForm.isActive,
        expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
      });
      addToast('Promo code updated', 'success');
      setEditItem(null);
      fetchPromos();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update', 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/promo/${id}`);
      addToast('Promo code deleted', 'success');
      fetchPromos();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
    setDeleting(null);
  };

  const toggleActive = async (item: PromoCode) => {
    try {
      await api.put(`/promo/${item.id}`, { isActive: !item.isActive });
      addToast(`Promo code ${item.isActive ? 'deactivated' : 'activated'}`, 'success');
      fetchPromos();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update', 'error');
    }
  };

  const openEdit = (item: PromoCode) => {
    setEditForm({
      description: item.description || '',
      maxUses: item.maxUses,
      isActive: item.isActive,
      expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : '',
    });
    setEditItem(item);
  };

  const viewDetail = async (item: PromoCode) => {
    try {
      const { data } = await api.get(`/promo/${item.id}`);
      setDetailItem(data.data);
      setDetailRedemptions(data.data.redemptions || []);
      setDetailMarketingJobs(data.data.marketingJobs || []);
    } catch {
      addToast('Failed to load details', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Codes', value: stats.total, icon: <Hash className="h-4 w-4" /> },
          { label: 'Active', value: stats.active, icon: <Ticket className="h-4 w-4" /> },
          { label: 'Redemptions', value: stats.totalRedemptions, icon: <Users className="h-4 w-4" /> },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              {s.icon} {s.label}
            </div>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Ticket className="h-5 w-5 text-[var(--color-secondary)]" />
          Manage Promo Codes
        </h2>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search codes..."
              className="pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none w-40"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="px-3 py-2 text-xs rounded-xl border border-gray-600 bg-gray-800 text-white focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="BALANCE_CREDIT">Balance Credit</option>
            <option value="REFERRAL_BONUS">Referral Bonus</option>
            <option value="MARKETING">Marketing</option>
          </select>
          <Button size="sm" variant="outline" onClick={fetchPromos} className="!rounded-xl">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }} className="!rounded-xl">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Code
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-700/30 bg-gray-800/30 p-5 animate-pulse">
              <div className="h-4 w-full rounded bg-gray-700 mb-3" />
              <div className="flex gap-2">
                <div className="h-6 w-16 rounded-full bg-gray-700" />
                <div className="h-6 w-16 rounded-full bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      ) : promos.length === 0 ? (
        <Card className="!border-dashed">
          <CardContent className="py-12 text-center">
            <Ticket className="mx-auto mb-3 h-10 w-10 text-gray-500" />
            <p className="text-gray-400">No promo codes yet. Create your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promos.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl transition-all duration-200 hover:border-gray-600/40"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-bold text-white bg-gray-700/50 px-2.5 py-1 rounded-lg">
                        {item.code}
                      </span>
                      <CopyButton text={item.code} />
                      <Badge variant={item.type === 'BALANCE_CREDIT' ? 'info' : item.type === 'MARKETING' ? 'success' : 'warning'}>
                        {item.type === 'BALANCE_CREDIT' ? 'Balance Credit' : item.type === 'MARKETING' ? 'Marketing' : 'Referral Bonus'}
                      </Badge>
                      <button onClick={() => toggleActive(item)} className="transition-all hover:scale-105">
                        <Badge variant={item.isActive ? 'success' : 'danger'}>
                          {item.isActive ? (
                            <span className="flex items-center gap-1"><ToggleRight className="h-3 w-3" /> Active</span>
                          ) : (
                            <span className="flex items-center gap-1"><ToggleLeft className="h-3 w-3" /> Inactive</span>
                          )}
                        </Badge>
                      </button>
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-400 mb-2">{item.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      {item.type === 'BALANCE_CREDIT' ? (
                        <span>Amount: <span className="text-green-400 font-medium">{formatCurrency(item.amount)}</span></span>
                      ) : item.type === 'MARKETING' ? (
                        <>
                          <span>Bonus: <span className="text-green-400 font-medium">{formatCurrency(item.amount)}</span></span>
                          {item.marketingWinAmount && <span>Win Target: <span className="text-yellow-400 font-medium">{formatCurrency(item.marketingWinAmount)}</span></span>}
                          {item.marketingTarget && <span>Platform: <span className="text-white">{item.marketingTarget}</span></span>}
                          {item.marketingSpreadHrs && <span>Spread: <span className="text-white">{item.marketingSpreadHrs}h</span></span>}
                        </>
                      ) : (
                        <>
                          <span>Client: <span className="text-green-400 font-medium">{formatCurrency(item.clientBonus)}</span></span>
                          <span>Agent: <span className="text-blue-400 font-medium">{formatCurrency(item.agentBonus)}</span></span>
                          {item.agent && <span>Agent: <span className="text-white">{item.agent.name}</span></span>}
                        </>
                      )}
                      <span>Usage: <span className="text-white">{item.usedCount}/{item.maxUses || '\u221E'}</span></span>
                      {item.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expires: {formatDate(item.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => viewDetail(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-white transition-colors"
                      title="View details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
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
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="!rounded-xl">
                Prev
              </Button>
              <span className="flex items-center text-sm text-gray-400 px-3">
                {page} / {totalPages}
              </span>
              <Button size="sm" variant="outline" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="!rounded-xl">
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Promo Code">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white font-mono placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-secondary)]"
              placeholder="WELCOME500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
            >
              <option value="BALANCE_CREDIT">Balance Credit</option>
              <option value="REFERRAL_BONUS">Referral Bonus</option>
              <option value="MARKETING">Marketing</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Description (optional)</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
              placeholder="Welcome bonus for new users"
            />
          </div>

          {form.type === 'BALANCE_CREDIT' ? (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Credit Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
              />
            </div>
          ) : form.type === 'MARKETING' ? (
            <>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Instant Bonus Credit</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Target Platform</label>
                <select
                  value={form.marketingTarget}
                  onChange={(e) => setForm({ ...form, marketingTarget: e.target.value as any })}
                  className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
                >
                  <option value="BOTH">Both (Casino + Cricket)</option>
                  <option value="CASINO">Casino Only</option>
                  <option value="CRICKET">Cricket Only</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-300">Total Win Amount</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.marketingWinAmount}
                    onChange={(e) => setForm({ ...form, marketingWinAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-gray-500">+/-10% variance applied automatically</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-300">Spread Over (hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={form.marketingSpreadHrs}
                    onChange={(e) => setForm({ ...form, marketingSpreadHrs: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3">
                <p className="text-xs text-yellow-400 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Winning bets will be auto-generated on real matches/games over the configured time window
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Agent ID</label>
                <input
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                  className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
                  placeholder="Agent's user ID"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-300">Client Bonus</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.clientBonus}
                    onChange={(e) => setForm({ ...form, clientBonus: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-300">Agent Bonus</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.agentBonus}
                    onChange={(e) => setForm({ ...form, agentBonus: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Max Uses (0 = unlimited)</label>
              <input
                type="number"
                min="0"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Expires At</label>
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
              />
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
              <p className="text-xs text-gray-500">Enable this code immediately</p>
            </div>
          </label>

          <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Promo Code'}
          </Button>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Promo Code">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30">
            <span className="text-xs text-gray-400">Code:</span>
            <span className="ml-2 font-mono text-sm font-bold text-white">{editItem?.code}</span>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Description</label>
            <input
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Max Uses (0 = unlimited)</label>
              <input
                type="number"
                min="0"
                value={editForm.maxUses}
                onChange={(e) => setEditForm({ ...editForm, maxUses: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Expires At</label>
              <input
                type="datetime-local"
                value={editForm.expiresAt}
                onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30 cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.isActive}
              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-[var(--color-secondary)]"
            />
            <span className="text-sm font-medium text-white">Active</span>
          </label>

          <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
            {submitting ? 'Updating...' : 'Update Promo Code'}
          </Button>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Promo Code Details" className="max-w-2xl">
        {detailItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-bold text-white bg-gray-700/50 px-3 py-1.5 rounded-lg">
                {detailItem.code}
              </span>
              <Badge variant={detailItem.type === 'BALANCE_CREDIT' ? 'info' : detailItem.type === 'MARKETING' ? 'success' : 'warning'}>
                {detailItem.type === 'BALANCE_CREDIT' ? 'Balance Credit' : detailItem.type === 'MARKETING' ? 'Marketing' : 'Referral Bonus'}
              </Badge>
              <Badge variant={detailItem.isActive ? 'success' : 'danger'}>
                {detailItem.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-400">Usage: <span className="text-white">{detailItem.usedCount}/{detailItem.maxUses || '\u221E'}</span></div>
              {(detailItem.type === 'BALANCE_CREDIT' || detailItem.type === 'MARKETING') && (
                <div className="text-gray-400">{detailItem.type === 'MARKETING' ? 'Instant Bonus' : 'Amount'}: <span className="text-green-400">{formatCurrency(detailItem.amount)}</span></div>
              )}
              {detailItem.type === 'REFERRAL_BONUS' && (
                <>
                  <div className="text-gray-400">Client Bonus: <span className="text-green-400">{formatCurrency(detailItem.clientBonus)}</span></div>
                  <div className="text-gray-400">Agent Bonus: <span className="text-blue-400">{formatCurrency(detailItem.agentBonus)}</span></div>
                  {detailItem.agent && <div className="text-gray-400">Agent: <span className="text-white">{detailItem.agent.name} (@{detailItem.agent.username})</span></div>}
                </>
              )}
              {detailItem.type === 'MARKETING' && (
                <>
                  {detailItem.marketingWinAmount && <div className="text-gray-400">Win Target: <span className="text-yellow-400">{formatCurrency(detailItem.marketingWinAmount)}</span></div>}
                  {detailItem.marketingTarget && <div className="text-gray-400">Platform: <span className="text-white">{detailItem.marketingTarget}</span></div>}
                  {detailItem.marketingSpreadHrs && <div className="text-gray-400">Spread: <span className="text-white">{detailItem.marketingSpreadHrs} hours</span></div>}
                </>
              )}
              {detailItem.expiresAt && (
                <div className="text-gray-400">Expires: <span className="text-white">{formatDate(detailItem.expiresAt)}</span></div>
              )}
            </div>

            {/* Marketing Jobs */}
            {detailItem.type === 'MARKETING' && detailMarketingJobs.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-yellow-400" />
                  Scheduled Bets ({detailMarketingJobs.length})
                </h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {detailMarketingJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30">
                      <div className="flex items-center gap-3">
                        <Badge size="sm" variant={job.target === 'CRICKET' ? 'info' : 'warning'}>
                          {job.target}
                        </Badge>
                        <div>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(job.scheduledAt)}
                          </span>
                          {job.executedAt && (
                            <span className="text-[10px] text-gray-500">Executed: {formatDate(job.executedAt)}</span>
                          )}
                          {job.error && (
                            <span className="text-[10px] text-red-400">{job.error}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-green-400 font-medium">+{formatCurrency(job.amount)}</span>
                        <Badge size="sm" variant={job.status === 'EXECUTED' ? 'success' : job.status === 'FAILED' ? 'danger' : 'warning'}>
                          {job.status === 'EXECUTED' ? 'Executed' : job.status === 'FAILED' ? 'Failed' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Redemptions List */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Redemptions ({detailRedemptions.length})</h4>
              {detailRedemptions.length === 0 ? (
                <p className="text-xs text-gray-500">No redemptions yet.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {detailRedemptions.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30">
                      <div>
                        <span className="text-sm text-white font-medium">{r.user?.name}</span>
                        <span className="text-xs text-gray-500 ml-2">@{r.user?.username}</span>
                        <Badge size="sm" className="ml-2">{r.user?.role}</Badge>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-green-400 font-medium">{formatCurrency(r.amount)}</span>
                        <p className="text-[10px] text-gray-500">{formatDate(r.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ───────────────────────── Client Redeem Section ───────────────────────── */

function ClientRedeemSection() {
  const { addToast } = useToastStore();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<{ message: string; amount: number } | null>(null);
  const [redemptions, setRedemptions] = useState<PromoRedemption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRedemptions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/promo/my-redemptions');
      setRedemptions(data.data || []);
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      addToast('Please enter a promo code', 'error');
      return;
    }
    setRedeeming(true);
    setResult(null);
    try {
      const { data } = await api.post('/promo/redeem', { code: code.trim() });
      setResult({ message: data.message, amount: data.amount });
      addToast(`Promo code redeemed! +${formatCurrency(data.amount)}`, 'success');
      setCode('');
      fetchRedemptions();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to redeem code', 'error');
    }
    setRedeeming(false);
  };

  return (
    <div className="space-y-6">
      {/* Redeem Form */}
      <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <Gift className="h-5 w-5 text-[var(--color-secondary)]" />
          Redeem Promo Code
        </h2>
        <form onSubmit={handleRedeem} className="flex gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter promo code..."
            className="flex-1 rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white font-mono placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-secondary)]"
          />
          <Button type="submit" disabled={redeeming} className="!rounded-xl px-6">
            {redeeming ? 'Redeeming...' : 'Redeem'}
          </Button>
        </form>

        {result && (
          <div className="mt-4 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3">
            <p className="text-sm text-green-400 font-medium">{result.message}</p>
            <p className="text-xs text-green-300 mt-1">Credited: {formatCurrency(result.amount)}</p>
          </div>
        )}
      </div>

      {/* My Redemptions */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Ticket className="h-4 w-4 text-gray-400" />
          My Redemptions
        </h3>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-gray-700/30 bg-gray-800/30 p-4 animate-pulse">
                <div className="h-4 w-3/4 rounded bg-gray-700" />
              </div>
            ))}
          </div>
        ) : redemptions.length === 0 ? (
          <Card className="!border-dashed">
            <CardContent className="py-8 text-center">
              <Gift className="mx-auto mb-2 h-8 w-8 text-gray-500" />
              <p className="text-sm text-gray-400">No redemptions yet. Enter a promo code above to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {redemptions.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20">
                    <Gift className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <span className="font-mono text-sm font-bold text-white">{r.promoCode?.code}</span>
                    <Badge size="sm" variant={r.promoCode?.type === 'BALANCE_CREDIT' ? 'info' : r.promoCode?.type === 'MARKETING' ? 'success' : 'warning'} className="ml-2">
                      {r.promoCode?.type === 'BALANCE_CREDIT' ? 'Credit' : r.promoCode?.type === 'MARKETING' ? 'Marketing' : 'Referral'}
                    </Badge>
                    <p className="text-[11px] text-gray-500 mt-0.5">{formatDate(r.createdAt)}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-green-400">+{formatCurrency(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function PromoCodesPage() {
  const { user } = useAuthStore();
  const role = user?.role as Role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
          <Ticket className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isAdmin ? 'Promo Codes' : 'Redeem Code'}
          </h1>
          <p className="text-xs text-gray-500">
            {isAdmin ? 'Create and manage promotional codes' : 'Enter a promo code to claim your bonus'}
          </p>
        </div>
      </div>

      {isAdmin && <AdminPromoManager />}
      {!isAdmin && <ClientRedeemSection />}
    </div>
  );
}
