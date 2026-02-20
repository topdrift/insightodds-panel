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
import { getSocket } from '@/lib/socket';
import {
  Landmark, Upload, ArrowDownCircle, ArrowUpCircle,
  Check, X, Clock, RefreshCw, Eye,
  Plus, Trash2, Edit3, QrCode, Copy, Wallet,
  Bitcoin, Building2, Smartphone, Filter,
} from 'lucide-react';

/* ───────────────── Types ───────────────── */

interface DepositRequest {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAW';
  paymentMethod: 'UPI' | 'BANK_TRANSFER' | 'CRYPTO';
  amount: string;
  utrReference: string | null;
  screenshotUrl: string | null;
  bankAccountId: string | null;
  cryptoWalletId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminRemarks: string | null;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
  user?: { id: string; username: string; name: string; role?: string };
  bankAccount?: BankAccount | null;
  cryptoWallet?: CryptoWallet | null;
}

interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId: string | null;
  isDefault: boolean;
}

interface CryptoWallet {
  id: string;
  network: string;
  currency: string;
  address: string;
  qrCodeUrl: string | null;
  isActive: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const statusConfig = {
  PENDING: { label: 'Pending', variant: 'warning' as const, icon: Clock },
  APPROVED: { label: 'Approved', variant: 'success' as const, icon: Check },
  REJECTED: { label: 'Rejected', variant: 'danger' as const, icon: X },
};

const methodConfig = {
  UPI: { label: 'UPI', icon: Smartphone },
  BANK_TRANSFER: { label: 'Bank Transfer', icon: Building2 },
  CRYPTO: { label: 'Crypto', icon: Bitcoin },
};

/* ───────────────── Copy Helper ───────────────── */

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1.5 text-gray-400 hover:text-white transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ═══════════════════════════════════════════════
   CLIENT VIEW
   ═══════════════════════════════════════════════ */

function ClientDeposits() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK_TRANSFER' | 'CRYPTO'>('UPI');
  const [amount, setAmount] = useState('');
  const [utrReference, setUtrReference] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [bankAccountId, setBankAccountId] = useState('');
  const [cryptoWalletId, setCryptoWalletId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cryptoWallets, setCryptoWallets] = useState<CryptoWallet[]>([]);
  const [requests, setRequests] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, bankRes, walletRes] = await Promise.all([
        api.get('/deposit-request/my-requests', { params: { page, size: 10 } }),
        api.get('/bank-account'),
        api.get('/crypto-wallet'),
      ]);
      setRequests(reqRes.data.data || []);
      setTotalPages(reqRes.data.pagination?.totalPages || 1);
      setBankAccounts(bankRes.data.data || []);
      setCryptoWallets(walletRes.data.data || []);

      // Auto-select default bank account
      const defaultBank = (bankRes.data.data || []).find((b: BankAccount) => b.isDefault);
      if (defaultBank) setBankAccountId(defaultBank.id);
    } catch {
      addToast('Failed to load data', 'error');
    }
    setLoading(false);
  }, [addToast, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Listen for socket updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => fetchData();
    socket.on('deposit-request:updated', handler);
    socket.on('balance:updated', handler);
    return () => { socket.off('deposit-request:updated', handler); socket.off('balance:updated', handler); };
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      addToast('Enter a valid amount', 'error');
      return;
    }
    if (!screenshot) {
      addToast('Payment screenshot is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', activeTab);
      formData.append('paymentMethod', activeTab === 'WITHDRAW' ? 'BANK_TRANSFER' : paymentMethod);
      formData.append('amount', amount);
      if (utrReference) formData.append('utrReference', utrReference);
      formData.append('screenshot', screenshot);
      if (activeTab === 'WITHDRAW' && bankAccountId) formData.append('bankAccountId', bankAccountId);
      if (activeTab === 'DEPOSIT' && paymentMethod === 'CRYPTO' && cryptoWalletId) formData.append('cryptoWalletId', cryptoWalletId);

      await api.post('/deposit-request', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast(`${activeTab === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} request submitted`, 'success');
      setAmount('');
      setUtrReference('');
      setScreenshot(null);
      fetchData();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to submit request', 'error');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Tab Buttons */}
      <div className="flex gap-2">
        {(['DEPOSIT', 'WITHDRAW'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-lg'
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white border border-gray-700/30'
            }`}
          >
            {tab === 'DEPOSIT' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
            {tab === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}
          </button>
        ))}
      </div>

      {/* Submit Form */}
      <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Method (deposit only) */}
          {activeTab === 'DEPOSIT' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Payment Method</label>
              <div className="flex gap-2">
                {(['UPI', 'BANK_TRANSFER', 'CRYPTO'] as const).map((m) => {
                  const Ic = methodConfig[m].icon;
                  return (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                        paymentMethod === m
                          ? 'border-[var(--color-secondary)] bg-[var(--color-secondary)]/10 text-white'
                          : 'border-gray-700/30 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <Ic className="h-3.5 w-3.5" />
                      {methodConfig[m].label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Crypto Wallets Display */}
          {activeTab === 'DEPOSIT' && paymentMethod === 'CRYPTO' && cryptoWallets.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Select Wallet to Deposit</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {cryptoWallets.map((w) => (
                  <button
                    type="button"
                    key={w.id}
                    onClick={() => setCryptoWalletId(w.id)}
                    className={`text-left rounded-xl p-3 border transition-all ${
                      cryptoWalletId === w.id
                        ? 'border-[var(--color-secondary)] bg-[var(--color-secondary)]/10'
                        : 'border-gray-700/30 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Bitcoin className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium text-white">{w.currency}</span>
                      <Badge size="sm">{w.network}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-gray-400 font-mono truncate">{w.address}</p>
                      <CopyBtn text={w.address} />
                    </div>
                    {w.qrCodeUrl && (
                      <img src={`${API_URL}${w.qrCodeUrl}`} alt="QR" className="mt-2 h-24 w-24 rounded-lg bg-white p-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bank Account (withdraw only) */}
          {activeTab === 'WITHDRAW' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Select Bank Account</label>
              {bankAccounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-600 p-4 text-center">
                  <p className="text-sm text-gray-400 mb-2">No bank accounts saved</p>
                  <a href="/bank-accounts" className="text-sm text-[var(--color-secondary)] hover:underline">Add Bank Account</a>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {bankAccounts.map((b) => (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => setBankAccountId(b.id)}
                      className={`text-left rounded-xl p-3 border transition-all ${
                        bankAccountId === b.id
                          ? 'border-[var(--color-secondary)] bg-[var(--color-secondary)]/10'
                          : 'border-gray-700/30 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-sm font-medium text-white">{b.bankName}</span>
                        {b.isDefault && <Badge size="sm" variant="info">Default</Badge>}
                      </div>
                      <p className="text-xs text-gray-400">{b.accountName} - ****{b.accountNumber.slice(-4)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Amount</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
              placeholder="Enter amount"
              required
            />
          </div>

          {/* UTR / Tx Hash (deposit only) */}
          {activeTab === 'DEPOSIT' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">
                {paymentMethod === 'CRYPTO' ? 'Transaction Hash' : 'UTR Reference'}
              </label>
              <input
                value={utrReference}
                onChange={(e) => setUtrReference(e.target.value)}
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white font-mono placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
                placeholder={paymentMethod === 'CRYPTO' ? 'Enter transaction hash' : 'Enter UTR number'}
              />
            </div>
          )}

          {/* Screenshot (required) */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">
              Payment Screenshot <span className="text-red-400">*</span>
            </label>
            <label className={`flex items-center justify-center gap-2 rounded-xl border border-dashed p-4 cursor-pointer transition-colors ${
              screenshot
                ? 'border-green-500/40 bg-green-500/5 hover:border-green-500/60'
                : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
            }`}>
              <Upload className={`h-4 w-4 ${screenshot ? 'text-green-400' : 'text-gray-400'}`} />
              <span className={`text-sm ${screenshot ? 'text-green-400' : 'text-gray-400'}`}>
                {screenshot ? screenshot.name : 'Click to upload screenshot (JPEG, PNG, WebP)'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
              />
            </label>
            {screenshot && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-gray-500">{(screenshot.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={() => setScreenshot(null)} className="text-[11px] text-red-400 hover:text-red-300">Remove</button>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
            {submitting ? 'Submitting...' : `Submit ${activeTab === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} Request`}
          </Button>
        </form>
      </div>

      {/* Request History */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Request History</h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-gray-700/30 bg-gray-800/30 p-4 animate-pulse">
                <div className="h-4 w-3/4 rounded bg-gray-700" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <Card className="!border-dashed">
            <CardContent className="py-8 text-center">
              <Landmark className="mx-auto mb-2 h-8 w-8 text-gray-500" />
              <p className="text-sm text-gray-400">No requests yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => {
              const sc = statusConfig[r.status];
              const mc = methodConfig[r.paymentMethod];
              const Ic = sc.icon;
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        r.type === 'DEPOSIT' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                      }`}>
                        {r.type === 'DEPOSIT'
                          ? <ArrowDownCircle className="h-4 w-4 text-green-400" />
                          : <ArrowUpCircle className="h-4 w-4 text-red-400" />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{r.type}</span>
                          <Badge size="sm">{mc.label}</Badge>
                          <Badge size="sm" variant={sc.variant}>{sc.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] text-gray-500">{formatDate(r.createdAt)}</p>
                          {r.utrReference && <p className="text-[11px] text-gray-400 font-mono">Ref: {r.utrReference}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${r.type === 'DEPOSIT' ? 'text-green-400' : 'text-red-400'}`}>
                        {r.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(r.amount)}
                      </span>
                      {r.adminRemarks && (
                        <p className="text-[10px] text-gray-500 mt-0.5">Remarks: {r.adminRemarks}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="!rounded-xl">Prev</Button>
                <span className="flex items-center text-sm text-gray-400 px-3">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="!rounded-xl">Next</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ADMIN/AGENT VIEW
   ═══════════════════════════════════════════════ */

function AdminDeposits() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'wallets'>('pending');
  const [requests, setRequests] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [remarkFor, setRemarkFor] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<DepositRequest | null>(null);

  // Crypto wallet management
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [walletForm, setWalletForm] = useState({ network: '', currency: '', address: '' });
  const [walletQr, setWalletQr] = useState<File | null>(null);
  const [walletSubmitting, setWalletSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, size: 20 };
      if (filterType) params.type = filterType;
      if (activeTab === 'pending') {
        params.status = 'PENDING';
      } else if (filterStatus) {
        params.status = filterStatus;
      } else {
        // history: show all
        delete params.status;
        params.status = filterStatus || undefined;
      }

      const { data } = await api.get('/deposit-request/pending', { params });
      setRequests(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      addToast('Failed to load requests', 'error');
    }
    setLoading(false);
  }, [addToast, page, filterType, filterStatus, activeTab]);

  const fetchWallets = useCallback(async () => {
    try {
      const { data } = await api.get('/crypto-wallet');
      setWallets(data.data || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'wallets') {
      fetchWallets();
    } else {
      fetchRequests();
    }
  }, [fetchRequests, fetchWallets, activeTab]);

  // Socket listener
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => fetchRequests();
    socket.on('deposit-request:new', handler);
    return () => { socket.off('deposit-request:new', handler); };
  }, [fetchRequests]);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      await api.put(`/deposit-request/${id}/approve`, { adminRemarks: remarkText || undefined });
      addToast('Request approved', 'success');
      setRemarkFor(null);
      setRemarkText('');
      fetchRequests();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to approve', 'error');
    }
    setProcessing(null);
  };

  const handleReject = async (id: string) => {
    if (!remarkText.trim()) {
      addToast('Please add a remark for rejection', 'error');
      return;
    }
    setProcessing(id);
    try {
      await api.put(`/deposit-request/${id}/reject`, { adminRemarks: remarkText });
      addToast('Request rejected', 'success');
      setRemarkFor(null);
      setRemarkText('');
      fetchRequests();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to reject', 'error');
    }
    setProcessing(null);
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('network', walletForm.network);
      formData.append('currency', walletForm.currency);
      formData.append('address', walletForm.address);
      if (walletQr) formData.append('qrCode', walletQr);
      await api.post('/crypto-wallet', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      addToast('Crypto wallet added', 'success');
      setShowAddWallet(false);
      setWalletForm({ network: '', currency: '', address: '' });
      setWalletQr(null);
      fetchWallets();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to add wallet', 'error');
    }
    setWalletSubmitting(false);
  };

  const handleDeleteWallet = async (id: string) => {
    try {
      await api.delete(`/crypto-wallet/${id}`);
      addToast('Wallet deactivated', 'success');
      fetchWallets();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to deactivate wallet', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'pending', label: 'Pending Requests', icon: Clock },
          { key: 'history', label: 'History', icon: Filter },
          ...(isAdmin ? [{ key: 'wallets', label: 'Crypto Wallets', icon: Bitcoin }] : []),
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key as any); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-lg'
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white border border-gray-700/30'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Crypto Wallets Tab */}
      {activeTab === 'wallets' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Manage Crypto Wallets</h3>
            <Button size="sm" onClick={() => setShowAddWallet(true)} className="!rounded-xl">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Wallet
            </Button>
          </div>

          {wallets.length === 0 ? (
            <Card className="!border-dashed">
              <CardContent className="py-8 text-center">
                <Bitcoin className="mx-auto mb-2 h-8 w-8 text-gray-500" />
                <p className="text-sm text-gray-400">No crypto wallets configured</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {wallets.map((w) => (
                <div key={w.id} className="rounded-xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{w.currency}</span>
                        <Badge size="sm">{w.network}</Badge>
                        <Badge size="sm" variant={w.isActive ? 'success' : 'danger'}>
                          {w.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-gray-400 font-mono break-all">{w.address}</p>
                        <CopyBtn text={w.address} />
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteWallet(w.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-700/50 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {w.qrCodeUrl && (
                    <img src={`${API_URL}${w.qrCodeUrl}`} alt="QR" className="mt-3 h-28 w-28 rounded-lg bg-white p-1" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Wallet Modal */}
          <Modal isOpen={showAddWallet} onClose={() => setShowAddWallet(false)} title="Add Crypto Wallet">
            <form onSubmit={handleAddWallet} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Network</label>
                <input
                  value={walletForm.network}
                  onChange={(e) => setWalletForm({ ...walletForm, network: e.target.value })}
                  className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
                  placeholder="e.g. TRC20, ERC20, BTC"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Currency</label>
                <input
                  value={walletForm.currency}
                  onChange={(e) => setWalletForm({ ...walletForm, currency: e.target.value })}
                  className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
                  placeholder="e.g. USDT, BTC, ETH"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Wallet Address</label>
                <input
                  value={walletForm.address}
                  onChange={(e) => setWalletForm({ ...walletForm, address: e.target.value })}
                  className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white font-mono placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
                  placeholder="Wallet address"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">QR Code Image (optional)</label>
                <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-600 bg-gray-800/50 p-4 cursor-pointer hover:border-gray-500 transition-colors">
                  <QrCode className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">{walletQr ? walletQr.name : 'Click to upload QR'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setWalletQr(e.target.files?.[0] || null)} />
                </label>
              </div>
              <Button type="submit" className="w-full !rounded-xl" disabled={walletSubmitting}>
                {walletSubmitting ? 'Adding...' : 'Add Wallet'}
              </Button>
            </form>
          </Modal>
        </div>
      )}

      {/* Requests Tab (pending + history) */}
      {activeTab !== 'wallets' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs rounded-xl border border-gray-600 bg-gray-800 text-white focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAW">Withdraw</option>
            </select>
            {activeTab === 'history' && (
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="px-3 py-2 text-xs rounded-xl border border-gray-600 bg-gray-800 text-white focus:outline-none"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            )}
            <Button size="sm" variant="outline" onClick={fetchRequests} className="!rounded-xl">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          {/* Request List */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-gray-700/30 bg-gray-800/30 p-5 animate-pulse">
                  <div className="h-4 w-full rounded bg-gray-700 mb-3" />
                  <div className="h-3 w-1/2 rounded bg-gray-700" />
                </div>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <Card className="!border-dashed">
              <CardContent className="py-8 text-center">
                <Landmark className="mx-auto mb-2 h-8 w-8 text-gray-500" />
                <p className="text-sm text-gray-400">
                  {activeTab === 'pending' ? 'No pending requests' : 'No requests found'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const sc = statusConfig[r.status];
                const mc = methodConfig[r.paymentMethod];
                return (
                  <div key={r.id} className="group rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl transition-all hover:border-gray-600/40">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-white">{r.user?.name}</span>
                            <span className="text-xs text-gray-500">@{r.user?.username}</span>
                            <Badge size="sm" variant={r.type === 'DEPOSIT' ? 'success' : 'danger'}>{r.type}</Badge>
                            <Badge size="sm">{mc.label}</Badge>
                            <Badge size="sm" variant={sc.variant}>{sc.label}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            <span>Amount: <span className={`font-medium ${r.type === 'DEPOSIT' ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(r.amount)}</span></span>
                            {r.utrReference && <span className="font-mono">Ref: {r.utrReference}</span>}
                            <span>{formatDate(r.createdAt)}</span>
                          </div>
                          {r.screenshotUrl && (
                            <a
                              href={`${API_URL}${r.screenshotUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--color-secondary)] hover:underline"
                            >
                              <Eye className="h-3 w-3" /> View Screenshot
                            </a>
                          )}
                          {r.bankAccount && (
                            <p className="text-xs text-gray-500 mt-1">
                              Bank: {r.bankAccount.bankName} - ****{r.bankAccount.accountNumber.slice(-4)} ({r.bankAccount.ifscCode})
                            </p>
                          )}
                          {r.adminRemarks && (
                            <p className="text-xs text-gray-500 mt-1">Remarks: {r.adminRemarks}</p>
                          )}
                        </div>

                        {/* Actions (pending only) */}
                        {r.status === 'PENDING' && (
                          <div className="flex flex-col gap-2">
                            {remarkFor === r.id ? (
                              <div className="space-y-2">
                                <input
                                  value={remarkText}
                                  onChange={(e) => setRemarkText(e.target.value)}
                                  placeholder="Add remarks..."
                                  className="w-48 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                                />
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(r.id)}
                                    disabled={processing === r.id}
                                    className="!rounded-lg flex-1 !bg-green-600 hover:!bg-green-500"
                                  >
                                    <Check className="mr-1 h-3 w-3" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReject(r.id)}
                                    disabled={processing === r.id}
                                    className="!rounded-lg flex-1 !text-red-400 !border-red-500/30 hover:!bg-red-500/10"
                                  >
                                    <X className="mr-1 h-3 w-3" /> Reject
                                  </Button>
                                </div>
                                <button
                                  onClick={() => { setRemarkFor(null); setRemarkText(''); }}
                                  className="text-[10px] text-gray-500 hover:text-white transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => { setRemarkFor(r.id); setRemarkText(''); }}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                  title="Process"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="!rounded-xl">Prev</Button>
                  <span className="flex items-center text-sm text-gray-400 px-3">{page} / {totalPages}</span>
                  <Button size="sm" variant="outline" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="!rounded-xl">Next</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */

export default function DepositsPage() {
  const { user } = useAuthStore();
  const role = user?.role as Role;
  const isClient = role === 'CLIENT';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
          <Landmark className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isClient ? 'Deposit / Withdraw' : 'Deposit Requests'}
          </h1>
          <p className="text-xs text-gray-500">
            {isClient ? 'Submit deposit or withdrawal requests' : 'Review and process deposit/withdrawal requests'}
          </p>
        </div>
      </div>

      {isClient ? <ClientDeposits /> : <AdminDeposits />}
    </div>
  );
}
