'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore, Role } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useToastStore } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import api from '@/lib/api';
import {
  Plus,
  Edit3,
  Trash2,
  Eye,
  Settings,
  Hash,
  Clock,
  DollarSign,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Grid3X3,
  BarChart3,
  Trophy,
  Check,
  X,
  Coins,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

/* ───────────────────────── Types ───────────────────────── */

interface MatkaGame {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  resultTime: string;
  minStack: number;
  maxStack: number;
  isEnabled: boolean;
  createdAt: string;
  _count?: { markets: number };
}

interface MatkaMarket {
  id: string;
  matkaId: string;
  isActive: boolean;
  isEnabled: boolean;
  isMarketSettled: boolean;
  minStack: number;
  maxStack: number;
  result?: number | null;
  createdAt: string;
  matka: { name: string; openTime?: string; closeTime?: string; minStack?: number; maxStack?: number };
}

interface MatkaBet {
  id: string;
  userId: string;
  matkaMarketId: string;
  betType: string;
  numbers: Array<{ number: number; amount: number }>;
  totalAmount: number;
  betStatus: string;
  profitLoss?: number | null;
  createdAt: string;
  user?: { id: string; username: string; name: string };
  matkaMarket?: { matka: { name: string } };
}

interface PLExposure {
  marketId: string;
  totalInvested: number;
  potentialProfit: number;
  potentialLoss: number;
  betsCount: number;
}

type BetType = 'ANDAR_DHAI' | 'BAHAR_HARUF' | 'JODI';

/* ═══════════════════════════════════════════════════════════
   ADMIN: Game Management
   ═══════════════════════════════════════════════════════════ */

function AdminMatkaGames() {
  const { addToast } = useToastStore();
  const [games, setGames] = useState<MatkaGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editGame, setEditGame] = useState<MatkaGame | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', openTime: '09:00', closeTime: '17:00', resultTime: '18:00',
    minStack: 10, maxStack: 10000, isEnabled: true,
  });

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/matka/admin/matka');
      setGames(data.matkas || []);
    } catch {
      addToast('Failed to load matka games', 'error');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const resetForm = () => {
    setForm({ name: '', openTime: '09:00', closeTime: '17:00', resultTime: '18:00', minStack: 10, maxStack: 10000, isEnabled: true });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/matka/admin/matka', form);
      addToast('Matka game created', 'success');
      setShowCreate(false);
      resetForm();
      fetchGames();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to create', 'error');
    }
    setSubmitting(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGame) return;
    setSubmitting(true);
    try {
      await api.put(`/matka/admin/matka/${editGame.id}`, form);
      addToast('Matka game updated', 'success');
      setEditGame(null);
      resetForm();
      fetchGames();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update', 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this matka game?')) return;
    try {
      await api.delete(`/matka/admin/matka/${id}`);
      addToast('Matka game deleted', 'success');
      fetchGames();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const openEditModal = (game: MatkaGame) => {
    setForm({
      name: game.name, openTime: game.openTime, closeTime: game.closeTime,
      resultTime: game.resultTime, minStack: game.minStack, maxStack: game.maxStack, isEnabled: game.isEnabled,
    });
    setEditGame(game);
  };

  const GameForm = ({ onSubmit, buttonLabel }: { onSubmit: (e: React.FormEvent) => void; buttonLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input label="Game Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <div className="grid grid-cols-3 gap-3">
        <Input label="Open Time" type="time" value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} required />
        <Input label="Close Time" type="time" value={form.closeTime} onChange={(e) => setForm({ ...form, closeTime: e.target.value })} required />
        <Input label="Result Time" type="time" value={form.resultTime} onChange={(e) => setForm({ ...form, resultTime: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Min Stake" type="number" value={form.minStack.toString()} onChange={(e) => setForm({ ...form, minStack: parseFloat(e.target.value) || 0 })} />
        <Input label="Max Stake" type="number" value={form.maxStack.toString()} onChange={(e) => setForm({ ...form, maxStack: parseFloat(e.target.value) || 0 })} />
      </div>
      <label className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30 cursor-pointer">
        <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} className="h-4 w-4 rounded accent-[var(--color-secondary)]" />
        <span className="text-sm font-medium text-white">Enabled</span>
      </label>
      <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
        {submitting ? 'Processing...' : buttonLabel}
      </Button>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Grid3X3 className="h-5 w-5 text-[var(--color-secondary)]" /> Matka Games
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchGames} className="!rounded-xl">
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }} className="!rounded-xl">
            <Plus className="mr-1 h-3.5 w-3.5" /> New Game
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-700/30 bg-gray-800/30 p-5 animate-pulse">
              <div className="h-5 w-2/3 rounded bg-gray-700 mb-3" />
              <div className="h-4 w-full rounded bg-gray-700 mb-2" />
              <div className="h-4 w-1/2 rounded bg-gray-700" />
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <Card className="!border-dashed">
          <CardContent className="py-12 text-center">
            <Hash className="mx-auto mb-3 h-10 w-10 text-gray-500" />
            <p className="text-gray-400">No matka games. Create your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <div
              key={g.id}
              className="group relative overflow-hidden rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-5 transition-all hover:border-gray-600/40"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-white">{g.name}</h3>
                <Badge variant={g.isEnabled ? 'success' : 'danger'}>
                  {g.isEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{g.openTime} - {g.closeTime}</span>
                  <span className="text-gray-600">|</span>
                  <span>Result: {g.resultTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>{formatCurrency(g.minStack)} - {formatCurrency(g.maxStack)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>{g._count?.markets ?? 0} markets</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEditModal(g)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-900/20 py-2 text-xs font-medium text-blue-400 hover:bg-blue-900/30 transition-colors border border-blue-900/20"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(g.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-900/20 py-2 text-xs font-medium text-red-400 hover:bg-red-900/30 transition-colors border border-red-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Matka Game">
        <GameForm onSubmit={handleCreate} buttonLabel="Create Game" />
      </Modal>

      <Modal isOpen={!!editGame} onClose={() => setEditGame(null)} title={`Edit: ${editGame?.name || ''}`}>
        <GameForm onSubmit={handleEdit} buttonLabel="Update Game" />
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN: Market Management
   ═══════════════════════════════════════════════════════════ */

function AdminMarketManagement() {
  const { addToast } = useToastStore();
  const [markets, setMarkets] = useState<MatkaMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettled, setShowSettled] = useState(false);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/matka/admin/matka-market', { params: { isSettled: showSettled ? 'true' : 'false' } });
      setMarkets(data.markets || []);
    } catch {
      addToast('Failed to load markets', 'error');
    }
    setLoading(false);
  }, [showSettled, addToast]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  const toggleActive = async (market: MatkaMarket) => {
    try {
      await api.put(`/matka/admin/matka-market/${market.id}`, { isActive: !market.isActive });
      addToast(`Market ${market.isActive ? 'deactivated' : 'activated'}`, 'success');
      fetchMarkets();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const toggleEnabled = async (market: MatkaMarket) => {
    try {
      await api.put(`/matka/admin/matka-market/${market.id}`, { isEnabled: !market.isEnabled });
      addToast(`Market ${market.isEnabled ? 'disabled' : 'enabled'}`, 'success');
      fetchMarkets();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Target className="h-5 w-5 text-[var(--color-secondary)]" /> Markets
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettled(!showSettled)}
            className={`rounded-xl px-4 py-2 text-xs font-medium transition-all border ${
              showSettled ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-gray-800/50 text-gray-400 border-gray-700/30'
            }`}
          >
            {showSettled ? 'Showing Settled' : 'Showing Open'}
          </button>
          <Button size="sm" variant="outline" onClick={fetchMarkets} className="!rounded-xl">
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-700/30 bg-gray-800/30 p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <Card className="!border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No {showSettled ? 'settled' : 'open'} markets found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {markets.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-2xl border border-gray-700/30 bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-xl px-5 py-3 hover:border-gray-600/40 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20">
                  <Hash className="h-4 w-4 text-[var(--color-secondary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{m.matka?.name}</p>
                  <p className="text-[11px] text-gray-500">{formatDate(m.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <Badge variant={m.isActive ? 'success' : 'danger'}>{m.isActive ? 'Active' : 'Inactive'}</Badge>
                  <Badge variant={m.isEnabled ? 'success' : 'warning'}>{m.isEnabled ? 'Enabled' : 'Disabled'}</Badge>
                  <Badge variant={m.isMarketSettled ? 'info' : 'default'}>{m.isMarketSettled ? 'Settled' : 'Open'}</Badge>
                  {m.result != null && <Badge variant="info">Result: {m.result}</Badge>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleActive(m)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
                    title="Toggle Active"
                  >
                    {m.isActive ? <ChevronDown className="h-3.5 w-3.5 text-yellow-400" /> : <ChevronUp className="h-3.5 w-3.5 text-green-400" />}
                  </button>
                  <button
                    onClick={() => toggleEnabled(m)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
                    title="Toggle Enabled"
                  >
                    <Settings className="h-3.5 w-3.5 text-blue-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN: Settlement
   ═══════════════════════════════════════════════════════════ */

function AdminSettlement() {
  const { addToast } = useToastStore();
  const [marketId, setMarketId] = useState('');
  const [result, setResult] = useState('');
  const [isRollback, setIsRollback] = useState(false);
  const [settling, setSettling] = useState(false);
  const [markets, setMarkets] = useState<MatkaMarket[]>([]);

  useEffect(() => {
    api.get('/matka/admin/matka-market', { params: { isSettled: 'false' } })
      .then(({ data }) => setMarkets(data.markets || []))
      .catch(() => {});
  }, []);

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marketId || result === '') {
      addToast('Market and result are required', 'error');
      return;
    }
    setSettling(true);
    try {
      const { data } = await api.put('/matka/settleMarket', { marketId, result: parseInt(result), isRollback });
      addToast(data.message || 'Settlement successful', 'success');
      setMarketId('');
      setResult('');
      setIsRollback(false);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Settlement failed', 'error');
    }
    setSettling(false);
  };

  return (
    <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-5">
      <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-[var(--color-secondary)]" /> Settle Market
      </h3>
      <form onSubmit={handleSettle} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Select Market</label>
          <select
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            className="w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-secondary)]"
            required
          >
            <option value="">Select a market...</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>{m.matka?.name} - {formatDate(m.createdAt)}</option>
            ))}
          </select>
        </div>
        <Input label="Result Number" type="number" value={result} onChange={(e) => setResult(e.target.value)} placeholder="Enter result" required />
        <label className="flex items-center gap-3 rounded-xl bg-red-900/10 px-4 py-3 border border-red-900/20 cursor-pointer">
          <input type="checkbox" checked={isRollback} onChange={(e) => setIsRollback(e.target.checked)} className="h-4 w-4 rounded accent-red-500" />
          <div>
            <span className="text-sm font-medium text-red-400 flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" /> Rollback</span>
            <p className="text-xs text-gray-500">Reverse a previous settlement</p>
          </div>
        </label>
        <Button type="submit" disabled={settling} variant={isRollback ? 'danger' : 'primary'} className="w-full !rounded-xl">
          {settling ? 'Processing...' : isRollback ? 'Rollback Market' : 'Settle Market'}
        </Button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN: Client Bets
   ═══════════════════════════════════════════════════════════ */

function AdminClientBets() {
  const { addToast } = useToastStore();
  const [bets, setBets] = useState<MatkaBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [marketId, setMarketId] = useState('');
  const [betStatus, setBetStatus] = useState('MATCHED');
  const [markets, setMarkets] = useState<MatkaMarket[]>([]);

  useEffect(() => {
    api.get('/matka/admin/matka-market')
      .then(({ data }) => setMarkets(data.markets || []))
      .catch(() => {});
  }, []);

  const fetchBets = async () => {
    if (!marketId) { addToast('Select a market first', 'warning'); return; }
    setLoading(true);
    try {
      const { data } = await api.get('/matka/admin/client-bets', { params: { marketId, betStatus } });
      setBets(data.bets || []);
    } catch {
      addToast('Failed to load bets', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-5">
      <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
        <Eye className="h-5 w-5 text-[var(--color-secondary)]" /> Client Bets
      </h3>
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400 mb-1">Market</label>
          <select
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            className="w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
          >
            <option value="">Select market...</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>{m.matka?.name} - {formatDate(m.createdAt)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
          <select
            value={betStatus}
            onChange={(e) => setBetStatus(e.target.value)}
            className="rounded-xl border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-[var(--color-secondary)] focus:outline-none"
          >
            <option value="MATCHED">Matched</option>
            <option value="UNMATCHED">Unmatched</option>
            <option value="SETTLED">Settled</option>
          </select>
        </div>
        <Button onClick={fetchBets} disabled={loading} className="!rounded-xl">
          <Eye className="mr-1 h-4 w-4" /> View
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
        </div>
      ) : bets.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-4">Select a market and click View to see bets.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {bets.map((b) => (
            <div key={b.id} className="rounded-xl bg-gray-800/40 px-4 py-3 border border-gray-700/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{b.user?.username || '-'}</span>
                  <Badge variant="info">{b.betType.replace(/_/g, ' ')}</Badge>
                </div>
                <span className="text-xs text-gray-500">{formatDate(b.createdAt)}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {b.numbers.map((n, i) => (
                  <span key={i} className="rounded-lg bg-gray-700/50 px-2 py-0.5 text-xs text-gray-200 font-mono">
                    {String(n.number).padStart(2, '0')}: {formatCurrency(n.amount)}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-secondary)] font-bold">{formatCurrency(b.totalAmount)}</span>
                <div className="flex items-center gap-2">
                  {b.profitLoss != null && (
                    <span className={b.profitLoss > 0 ? 'text-green-400' : b.profitLoss < 0 ? 'text-red-400' : 'text-gray-400'}>
                      {formatCurrency(b.profitLoss)}
                    </span>
                  )}
                  <Badge variant={b.betStatus === 'MATCHED' ? 'success' : b.betStatus === 'SETTLED' ? 'info' : 'warning'}>{b.betStatus}</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CLIENT: Betting Interface
   ═══════════════════════════════════════════════════════════ */

function ClientMatkaView() {
  const { fetchUser } = useAuthStore();
  const { addToast } = useToastStore();
  const [markets, setMarkets] = useState<MatkaMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<MatkaMarket | null>(null);
  const [betType, setBetType] = useState<BetType>('JODI');
  const [selectedNumbers, setSelectedNumbers] = useState<Record<number, number>>({});
  const [placing, setPlacing] = useState(false);
  const [myBets, setMyBets] = useState<MatkaBet[]>([]);
  const [plExposure, setPLExposure] = useState<PLExposure | null>(null);
  const [amountInput, setAmountInput] = useState('100');
  const [betTab, setBetTab] = useState<'open' | 'settled'>('open');

  useEffect(() => {
    setLoading(true);
    api.get('/matka/matka-market')
      .then(({ data }) => setMarkets(data.markets || []))
      .catch(() => addToast('Failed to load markets', 'error'))
      .finally(() => setLoading(false));
  }, [addToast]);

  const selectMarket = async (market: MatkaMarket) => {
    setSelectedMarket(market);
    setSelectedNumbers({});
    setBetType('JODI');
    try {
      const [betsRes, plRes] = await Promise.all([
        api.get(`/matka/${market.id}/my-bets`),
        api.get('/matka/pl-exposure', { params: { marketId: market.id } }),
      ]);
      setMyBets(betsRes.data.bets || []);
      setPLExposure(plRes.data);
    } catch { /* non-critical */ }
  };

  const toggleNumber = (num: number) => {
    setSelectedNumbers((prev) => {
      const copy = { ...prev };
      if (copy[num] !== undefined) { delete copy[num]; } else { copy[num] = parseFloat(amountInput) || 100; }
      return copy;
    });
  };

  const updateNumberAmount = (num: number, amount: number) => {
    setSelectedNumbers((prev) => ({ ...prev, [num]: amount }));
  };

  const totalAmount = Object.values(selectedNumbers).reduce((sum, amt) => sum + amt, 0);

  const placeBet = async () => {
    if (!selectedMarket || Object.keys(selectedNumbers).length === 0) {
      addToast('Select at least one number', 'warning');
      return;
    }
    const betLockNumberAndAmountDTOList = Object.entries(selectedNumbers).map(([num, amount]) => ({
      number: parseInt(num), amount,
    }));

    setPlacing(true);
    try {
      await api.post('/matka/bet-lock', { marketId: selectedMarket.id, betType, betLockNumberAndAmountDTOList });
      addToast('Bet placed successfully!', 'success');
      setSelectedNumbers({});
      fetchUser();
      const [betsRes, plRes] = await Promise.all([
        api.get(`/matka/${selectedMarket.id}/my-bets`),
        api.get('/matka/pl-exposure', { params: { marketId: selectedMarket.id } }),
      ]);
      setMyBets(betsRes.data.bets || []);
      setPLExposure(plRes.data);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to place bet', 'error');
    }
    setPlacing(false);
  };

  const getNumberRange = (): number[] => {
    if (betType === 'JODI') return Array.from({ length: 100 }, (_, i) => i);
    return Array.from({ length: 10 }, (_, i) => i);
  };

  const openBets = myBets.filter((b) => b.betStatus === 'MATCHED');
  const settledBets = myBets.filter((b) => b.betStatus === 'SETTLED');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Market Selection */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-[var(--color-secondary)]" /> Active Markets
        </h2>
        {markets.length === 0 ? (
          <Card className="!border-dashed">
            <CardContent className="py-12 text-center">
              <Hash className="mx-auto mb-3 h-10 w-10 text-gray-500" />
              <p className="text-gray-400">No active markets available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {markets.map((market) => (
              <button
                key={market.id}
                onClick={() => selectMarket(market)}
                className={`text-left rounded-2xl border backdrop-blur-xl p-4 transition-all duration-200 ${
                  selectedMarket?.id === market.id
                    ? 'border-[var(--color-secondary)]/50 bg-[var(--color-secondary)]/5 ring-1 ring-[var(--color-secondary)]/30 shadow-lg shadow-[var(--color-secondary)]/10'
                    : 'border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 hover:border-gray-600/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white">{market.matka?.name}</h3>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="space-y-1 text-xs text-gray-400">
                  {market.matka?.openTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {market.matka.openTime} - {market.matka.closeTime}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Min: {formatCurrency(market.minStack || market.matka?.minStack || 0)} | Max: {formatCurrency(market.maxStack || market.matka?.maxStack || 0)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bet Placement */}
      {selectedMarket && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-700/30 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-[var(--color-secondary)]" />
                  <h3 className="text-base font-bold text-white">{selectedMarket.matka?.name}</h3>
                </div>
                <Badge variant="info">{betType.replace(/_/g, ' ')}</Badge>
              </div>

              <div className="p-5 space-y-5">
                {/* Bet Type Tabs */}
                <div className="flex rounded-xl bg-gray-800/50 p-1 border border-gray-700/30">
                  {(['JODI', 'ANDAR_DHAI', 'BAHAR_HARUF'] as BetType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => { setBetType(type); setSelectedNumbers({}); }}
                      className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                        betType === type
                          ? 'bg-[var(--color-primary)] text-white shadow-lg'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {type.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>

                {/* Amount Input */}
                <div className="flex items-end gap-3">
                  <div className="w-36">
                    <Input label="Amount per number" type="number" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pb-0.5">
                    {[50, 100, 500, 1000, 5000].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => setAmountInput(chip.toString())}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
                          amountInput === chip.toString()
                            ? 'bg-[var(--color-secondary)]/20 text-[var(--color-secondary)] border-[var(--color-secondary)]/30'
                            : 'bg-gray-800 text-gray-400 border-gray-700/30 hover:border-gray-600'
                        }`}
                      >
                        {chip >= 1000 ? `${chip / 1000}K` : chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number Grid */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    {betType === 'JODI' ? 'Select JODI numbers (00-99):' : `Select ${betType.replace(/_/g, ' ')} numbers (0-9):`}
                  </p>
                  <div className={`grid gap-1.5 ${betType === 'JODI' ? 'grid-cols-10' : 'grid-cols-5 sm:grid-cols-10'}`}>
                    {getNumberRange().map((num) => {
                      const isSelected = selectedNumbers[num] !== undefined;
                      return (
                        <button
                          key={num}
                          onClick={() => toggleNumber(num)}
                          className={`relative rounded-xl border px-1 py-2.5 text-sm font-bold transition-all duration-200 ${
                            isSelected
                              ? 'border-[var(--color-secondary)] bg-[var(--color-secondary)]/20 text-[var(--color-secondary)] shadow-lg shadow-[var(--color-secondary)]/10 scale-105'
                              : 'border-gray-700/30 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-white hover:bg-gray-700/50'
                          }`}
                        >
                          {betType === 'JODI' ? String(num).padStart(2, '0') : num}
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--color-secondary)]">
                              <Check className="h-2 w-2 text-black" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Numbers */}
                {Object.keys(selectedNumbers).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400">Selected ({Object.keys(selectedNumbers).length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedNumbers).map(([num, amount]) => (
                        <div
                          key={num}
                          className="flex items-center gap-1.5 rounded-xl border border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/5 px-2.5 py-1.5"
                        >
                          <span className="text-sm font-bold text-[var(--color-secondary)]">
                            {betType === 'JODI' ? String(num).padStart(2, '0') : num}
                          </span>
                          <input
                            type="number"
                            value={amount}
                            onChange={(e) => updateNumberAmount(parseInt(num), parseFloat(e.target.value) || 0)}
                            className="w-16 rounded-lg border-0 bg-gray-800/60 px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-[var(--color-secondary)]"
                          />
                          <button onClick={() => toggleNumber(parseInt(num))} className="text-gray-500 hover:text-red-400">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total + Place Bet */}
                <div className="flex items-center justify-between rounded-xl bg-gray-800/60 px-5 py-4 border border-gray-700/30">
                  <div>
                    <p className="text-xs text-gray-500">Total Stake</p>
                    <p className="text-2xl font-bold text-[var(--color-secondary)]">{formatCurrency(totalAmount)}</p>
                  </div>
                  <Button
                    size="lg"
                    disabled={placing || Object.keys(selectedNumbers).length === 0}
                    onClick={placeBet}
                    className="!rounded-xl !px-8"
                  >
                    {placing ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Placing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Zap className="h-4 w-4" /> Place Bet
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* P&L Exposure */}
            {plExposure && (
              <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-5">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[var(--color-secondary)]" /> P&L Exposure
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Total Invested</span>
                    <span className="text-sm font-bold text-white">{formatCurrency(plExposure.totalInvested)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-400" /> Potential Profit</span>
                    <span className="text-sm font-bold text-green-400">{formatCurrency(plExposure.potentialProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-400" /> Potential Loss</span>
                    <span className="text-sm font-bold text-red-400">{formatCurrency(plExposure.potentialLoss)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-700/30 pt-2">
                    <span className="text-xs text-gray-400">Total Bets</span>
                    <span className="text-sm font-bold text-white">{plExposure.betsCount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* My Bets */}
            <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl overflow-hidden">
              <div className="border-b border-gray-700/30 px-5 py-3">
                <div className="flex rounded-lg bg-gray-800/50 p-0.5">
                  <button
                    onClick={() => setBetTab('open')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                      betTab === 'open' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400'
                    }`}
                  >
                    Open ({openBets.length})
                  </button>
                  <button
                    onClick={() => setBetTab('settled')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                      betTab === 'settled' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400'
                    }`}
                  >
                    Settled ({settledBets.length})
                  </button>
                </div>
              </div>
              <div className="p-3 max-h-80 overflow-y-auto">
                {(betTab === 'open' ? openBets : settledBets).length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-6">No {betTab} bets</p>
                ) : (
                  <div className="space-y-2">
                    {(betTab === 'open' ? openBets : settledBets).map((b) => (
                      <div key={b.id} className="rounded-xl bg-gray-800/40 px-3 py-2.5 border border-gray-700/20">
                        <div className="flex items-center justify-between mb-1.5">
                          <Badge variant="info">{b.betType.replace(/_/g, ' ')}</Badge>
                          <span className="text-[10px] text-gray-500">{formatDate(b.createdAt)}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {b.numbers.map((n, i) => (
                            <span key={i} className="rounded-lg bg-gray-700/50 px-1.5 py-0.5 text-[10px] text-gray-200 font-mono">
                              {String(n.number).padStart(2, '0')}: {formatCurrency(n.amount)}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[var(--color-secondary)]">{formatCurrency(b.totalAmount)}</span>
                          {b.profitLoss != null && (
                            <span className={`text-xs font-medium ${b.profitLoss > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatCurrency(b.profitLoss)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AGENT: Read-Only View
   ═══════════════════════════════════════════════════════════ */

function AgentMatkaView() {
  const { addToast } = useToastStore();
  const [markets, setMarkets] = useState<MatkaMarket[]>([]);
  const [bets, setBets] = useState<MatkaBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarketId, setSelectedMarketId] = useState('');

  useEffect(() => {
    api.get('/matka/matka-market')
      .then(({ data }) => setMarkets(data.markets || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const viewBets = async (marketId: string) => {
    setSelectedMarketId(marketId);
    try {
      const { data } = await api.get('/matka/admin/client-bets', { params: { marketId, betStatus: 'MATCHED' } });
      setBets(data.bets || []);
    } catch {
      addToast('Failed to load bets', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Eye className="h-5 w-5 text-[var(--color-secondary)]" /> Active Markets
      </h2>
      {markets.length === 0 ? (
        <Card className="!border-dashed">
          <CardContent className="py-8 text-center text-gray-400">No active markets</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => (
            <button
              key={m.id}
              onClick={() => viewBets(m.id)}
              className={`text-left rounded-2xl border backdrop-blur-xl p-4 transition-all ${
                selectedMarketId === m.id
                  ? 'border-[var(--color-secondary)]/50 bg-[var(--color-secondary)]/5'
                  : 'border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 hover:border-gray-600/40'
              }`}
            >
              <h3 className="font-bold text-white">{m.matka?.name}</h3>
              <p className="text-xs text-gray-400 mt-1">Click to view client bets</p>
            </button>
          ))}
        </div>
      )}

      {selectedMarketId && bets.length > 0 && (
        <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl overflow-hidden">
          <div className="border-b border-gray-700/30 px-5 py-3">
            <h3 className="text-base font-bold text-white">Client Bets (Read Only)</h3>
          </div>
          <div className="p-0">
            <Table>
              <Thead>
                <Tr><Th>User</Th><Th>Type</Th><Th>Numbers</Th><Th>Amount</Th><Th>Status</Th><Th>Time</Th></Tr>
              </Thead>
              <Tbody>
                {bets.map((b) => (
                  <Tr key={b.id}>
                    <Td className="text-white font-medium">{b.user?.username || '-'}</Td>
                    <Td><Badge variant="info">{b.betType}</Badge></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {b.numbers.map((n, i) => (
                          <span key={i} className="rounded bg-gray-700/50 px-1.5 py-0.5 text-xs font-mono">{n.number}: {formatCurrency(n.amount)}</span>
                        ))}
                      </div>
                    </Td>
                    <Td className="text-[var(--color-secondary)] font-bold">{formatCurrency(b.totalAmount)}</Td>
                    <Td><Badge variant="success">{b.betStatus}</Badge></Td>
                    <Td className="text-xs">{formatDate(b.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════ */

export default function MatkaPage() {
  const { user } = useAuthStore();
  const role = user?.role as Role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isAgent = role === 'AGENT';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
          <Hash className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Matka</h1>
          <p className="text-xs text-gray-500">
            {isAdmin ? 'Manage games, markets & settlements' : isAgent ? 'View client bets' : 'Place your bets'}
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-8">
          <AdminMatkaGames />
          <AdminMarketManagement />
          <div className="grid gap-6 lg:grid-cols-2">
            <AdminSettlement />
            <AdminClientBets />
          </div>
        </div>
      )}

      {isAgent && <AgentMatkaView />}
      {role === 'CLIENT' && <ClientMatkaView />}
    </div>
  );
}
