'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useToastStore } from '@/components/ui/toast';
import {
  Building2, Plus, Edit3, Trash2, Star, RefreshCw, Wallet,
} from 'lucide-react';
import api from '@/lib/api';

/* ───────────────── Types ───────────────── */

interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId: string | null;
  isDefault: boolean;
  createdAt: string;
}

/* ───────────────── Page ───────────────── */

export default function BankAccountsPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<BankAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState({
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: '',
    isDefault: false,
  });

  const resetForm = () => {
    setForm({ accountName: '', accountNumber: '', ifscCode: '', bankName: '', upiId: '', isDefault: false });
  };

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bank-account');
      setAccounts(data.data || []);
    } catch {
      addToast('Failed to load bank accounts', 'error');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editItem) {
        await api.put(`/bank-account/${editItem.id}`, {
          accountName: form.accountName,
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
          bankName: form.bankName,
          upiId: form.upiId || null,
        });
        addToast('Bank account updated', 'success');
      } else {
        await api.post('/bank-account', {
          accountName: form.accountName,
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
          bankName: form.bankName,
          upiId: form.upiId || undefined,
          isDefault: form.isDefault,
        });
        addToast('Bank account added', 'success');
      }
      setShowForm(false);
      setEditItem(null);
      resetForm();
      fetchAccounts();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to save bank account', 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/bank-account/${id}`);
      addToast('Bank account deleted', 'success');
      fetchAccounts();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
    setDeleting(null);
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.put(`/bank-account/${id}/default`);
      addToast('Default bank account updated', 'success');
      fetchAccounts();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update', 'error');
    }
  };

  const openEdit = (item: BankAccount) => {
    setForm({
      accountName: item.accountName,
      accountNumber: item.accountNumber,
      ifscCode: item.ifscCode,
      bankName: item.bankName,
      upiId: item.upiId || '',
      isDefault: item.isDefault,
    });
    setEditItem(item);
    setShowForm(true);
  };

  const openCreate = () => {
    resetForm();
    setEditItem(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Bank Accounts</h1>
            <p className="text-xs text-gray-500">Manage your bank accounts for withdrawals</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchAccounts} className="!rounded-xl">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={openCreate} className="!rounded-xl">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Account
          </Button>
        </div>
      </div>

      {/* Account List */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-700/30 bg-gray-800/30 p-5 animate-pulse">
              <div className="h-5 w-3/4 rounded bg-gray-700 mb-3" />
              <div className="h-4 w-1/2 rounded bg-gray-700 mb-2" />
              <div className="h-3 w-1/3 rounded bg-gray-700" />
            </div>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="!border-dashed">
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-500" />
            <p className="text-gray-400 mb-3">No bank accounts saved yet</p>
            <Button size="sm" onClick={openCreate} className="!rounded-xl">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Your First Bank Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="group relative rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl transition-all duration-200 hover:border-gray-600/40"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <span className="text-sm font-bold text-white truncate">{account.bankName}</span>
                      {account.isDefault && (
                        <Badge size="sm" variant="info">
                          <Star className="mr-0.5 h-2.5 w-2.5" /> Default
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-gray-400">
                      <p>Name: <span className="text-white">{account.accountName}</span></p>
                      <p>A/C: <span className="text-white font-mono">{account.accountNumber}</span></p>
                      <p>IFSC: <span className="text-white font-mono">{account.ifscCode}</span></p>
                      {account.upiId && <p>UPI: <span className="text-white">{account.upiId}</span></p>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!account.isDefault && (
                      <button
                        onClick={() => handleSetDefault(account.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-700/50 text-amber-400 hover:bg-amber-500/20 transition-colors"
                        title="Set as default"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(account)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-700/50 text-blue-400 hover:bg-blue-500/20 transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      disabled={deleting === account.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-700/50 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deleting === account.id ? (
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
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditItem(null); }} title={editItem ? 'Edit Bank Account' : 'Add Bank Account'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Account Holder Name</label>
            <input
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
              placeholder="Full name as per bank"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Account Number</label>
            <input
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white font-mono placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
              placeholder="Account number"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">IFSC Code</label>
              <input
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white font-mono placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
                placeholder="IFSC code"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Bank Name</label>
              <input
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
                placeholder="Bank name"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">UPI ID (optional)</label>
            <input
              value={form.upiId}
              onChange={(e) => setForm({ ...form, upiId: e.target.value })}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
              placeholder="e.g. yourname@paytm"
            />
          </div>

          {!editItem && (
            <label className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-[var(--color-secondary)]"
              />
              <div>
                <span className="text-sm font-medium text-white">Set as default</span>
                <p className="text-xs text-gray-500">Use this account as primary for withdrawals</p>
              </div>
            </label>
          )}

          <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
            {submitting ? 'Saving...' : editItem ? 'Update Account' : 'Add Account'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
