'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToastStore } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

interface DepositWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  childId: string;
  childName: string;
  childBalance: number;
}

interface FormData {
  transactionType: 'DEPOSIT' | 'WITHDRAW';
  amount: string;
  remarks: string;
  transactionPassword: string;
}

const initialFormData: FormData = {
  transactionType: 'DEPOSIT',
  amount: '',
  remarks: '',
  transactionPassword: '',
};

export function DepositWithdrawModal({
  isOpen,
  onClose,
  onSuccess,
  childId,
  childName,
  childBalance,
}: DepositWithdrawModalProps) {
  const [form, setForm] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const handleChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    setForm(initialFormData);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      addToast('Please enter a valid amount', 'error');
      return;
    }

    if (form.transactionType === 'WITHDRAW' && amount > childBalance) {
      addToast('Withdrawal amount exceeds available balance', 'error');
      return;
    }

    setLoading(true);

    try {
      await api.put(`/admin/children/${childId}/deposit-withdraw`, {
        transactionType: form.transactionType,
        amount,
        remarks: form.remarks,
        transactionPassword: form.transactionPassword,
      });

      addToast(
        `${form.transactionType === 'DEPOSIT' ? 'Deposited' : 'Withdrawn'} ${formatCurrency(amount)} successfully`,
        'success'
      );
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      addToast(error.response?.data?.message || 'Transaction failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isDeposit = form.transactionType === 'DEPOSIT';
  const previewBalance = form.amount
    ? isDeposit
      ? childBalance + (parseFloat(form.amount) || 0)
      : childBalance - (parseFloat(form.amount) || 0)
    : childBalance;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Deposit / Withdraw">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* User info */}
        <div className="rounded-lg bg-gray-800/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">User</p>
              <p className="font-semibold text-white">{childName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Current Balance</p>
              <p className="font-semibold text-[var(--color-secondary)]">{formatCurrency(childBalance)}</p>
            </div>
          </div>
        </div>

        {/* Transaction Type */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Transaction Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleChange('transactionType', 'DEPOSIT')}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                isDeposit
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'
              }`}
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => handleChange('transactionType', 'WITHDRAW')}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                !isDeposit
                  ? 'border-red-500 bg-red-500/20 text-red-400'
                  : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'
              }`}
            >
              Withdraw
            </button>
          </div>
        </div>

        {/* Amount */}
        <Input
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          value={form.amount}
          onChange={(e) => handleChange('amount', e.target.value)}
          placeholder="Enter amount"
          required
        />

        {/* Balance Preview */}
        {form.amount && parseFloat(form.amount) > 0 && (
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 px-4 py-2.5 text-sm">
            <span className="text-gray-400">New Balance: </span>
            <span
              className={`font-semibold ${previewBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {formatCurrency(previewBalance)}
            </span>
          </div>
        )}

        {/* Remarks */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Remarks</label>
          <textarea
            value={form.remarks}
            onChange={(e) => handleChange('remarks', e.target.value)}
            placeholder="Optional remarks"
            rows={2}
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Transaction Password */}
        <Input
          label="Transaction Password"
          type="password"
          value={form.transactionPassword}
          onChange={(e) => handleChange('transactionPassword', e.target.value)}
          placeholder="Enter your transaction password"
          required
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-700 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={isDeposit ? 'primary' : 'danger'}
            disabled={loading}
          >
            {loading
              ? 'Processing...'
              : isDeposit
                ? 'Confirm Deposit'
                : 'Confirm Withdrawal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
