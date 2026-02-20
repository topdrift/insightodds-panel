'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToastStore } from '@/components/ui/toast';

type ParentRole = 'SUPER_ADMIN' | 'ADMIN' | 'AGENT';

interface UserCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  parentRole: ParentRole;
}

const CHILD_ROLE_MAP: Record<ParentRole, string> = {
  SUPER_ADMIN: 'ADMIN',
  ADMIN: 'AGENT',
  AGENT: 'CLIENT',
};

interface FormData {
  username: string;
  password: string;
  fullName: string;
  mobile: string;
  reference: string;
  balance: string;
  exposureLimit: string;
  myPartnership: string;
  myCasinoPartnership: string;
  myMatkaPartnership: string;
  matchCommission: string;
  sessionCommission: string;
  casinoCommission: string;
  matkaCommission: string;
  transactionPassword: string;
}

const initialFormData: FormData = {
  username: '',
  password: '',
  fullName: '',
  mobile: '',
  reference: '',
  balance: '0',
  exposureLimit: '0',
  myPartnership: '0',
  myCasinoPartnership: '0',
  myMatkaPartnership: '0',
  matchCommission: '0',
  sessionCommission: '0',
  casinoCommission: '0',
  matkaCommission: '0',
  transactionPassword: '',
};

export function UserCreateModal({ isOpen, onClose, onCreated, parentRole }: UserCreateModalProps) {
  const [form, setForm] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [suggestingUsername, setSuggestingUsername] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const childRole = CHILD_ROLE_MAP[parentRole];

  useEffect(() => {
    if (isOpen) {
      setForm(initialFormData);
      fetchSuggestedUsername();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchSuggestedUsername = async () => {
    setSuggestingUsername(true);
    try {
      const { data } = await api.get('/admin/username', {
        params: { userType: childRole },
      });
      setForm((prev) => ({ ...prev, username: data.username || '' }));
    } catch {
      // Ignore - user can type manually
    } finally {
      setSuggestingUsername(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/admin/signup', {
        username: form.username,
        password: form.password,
        name: form.fullName,
        mobile: form.mobile,
        reference: form.reference,
        balance: parseFloat(form.balance) || 0,
        exposureLimit: parseFloat(form.exposureLimit) || 0,
        myPartnership: parseFloat(form.myPartnership) || 0,
        myCasinoPartnership: parseFloat(form.myCasinoPartnership) || 0,
        myMatkaPartnership: parseFloat(form.myMatkaPartnership) || 0,
        matchCommission: parseFloat(form.matchCommission) || 0,
        sessionCommission: parseFloat(form.sessionCommission) || 0,
        casinoCommission: parseFloat(form.casinoCommission) || 0,
        matkaCommission: parseFloat(form.matkaCommission) || 0,
        transactionPassword: form.transactionPassword,
      });

      addToast(`${childRole} created successfully`, 'success');
      onCreated();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      addToast(error.response?.data?.message || 'Failed to create user', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Create New ${childRole}`} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {/* Role indicator */}
        <div className="rounded-lg bg-gray-800/60 px-4 py-2.5 text-sm">
          <span className="text-gray-400">Creating: </span>
          <span className="font-semibold text-[var(--color-secondary)]">{childRole}</span>
          <span className="text-gray-400"> under </span>
          <span className="font-semibold text-white">{parentRole.replace('_', ' ')}</span>
        </div>

        {/* Account Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Account Details</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Input
                label="Username"
                value={form.username}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder={suggestingUsername ? 'Loading...' : 'Enter username'}
                required
                disabled={suggestingUsername}
              />
              <button
                type="button"
                onClick={fetchSuggestedUsername}
                className="absolute right-2 top-7 text-xs text-blue-400 hover:text-blue-300"
                disabled={suggestingUsername}
              >
                Suggest
              </button>
            </div>
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={form.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="Enter full name"
              required
            />
            <Input
              label="Mobile"
              value={form.mobile}
              onChange={(e) => handleChange('mobile', e.target.value)}
              placeholder="Enter mobile number"
            />
          </div>
          <Input
            label="Reference"
            value={form.reference}
            onChange={(e) => handleChange('reference', e.target.value)}
            placeholder="Enter reference (optional)"
          />
        </div>

        {/* Financial Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Financial Details</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Initial Balance (Deposit)"
              type="number"
              min="0"
              value={form.balance}
              onChange={(e) => handleChange('balance', e.target.value)}
              placeholder="0"
            />
            <Input
              label="Exposure Limit"
              type="number"
              min="0"
              value={form.exposureLimit}
              onChange={(e) => handleChange('exposureLimit', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Partnership */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Partnership (%)</h4>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="My Partnership"
              type="number"
              min="0"
              max="100"
              value={form.myPartnership}
              onChange={(e) => handleChange('myPartnership', e.target.value)}
              placeholder="0"
            />
            <Input
              label="Casino Partnership"
              type="number"
              min="0"
              max="100"
              value={form.myCasinoPartnership}
              onChange={(e) => handleChange('myCasinoPartnership', e.target.value)}
              placeholder="0"
            />
            <Input
              label="Matka Partnership"
              type="number"
              min="0"
              max="100"
              value={form.myMatkaPartnership}
              onChange={(e) => handleChange('myMatkaPartnership', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Commission */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Commission (%)</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Match Commission"
              type="number"
              min="0"
              max="100"
              value={form.matchCommission}
              onChange={(e) => handleChange('matchCommission', e.target.value)}
              placeholder="0"
            />
            <Input
              label="Session Commission"
              type="number"
              min="0"
              max="100"
              value={form.sessionCommission}
              onChange={(e) => handleChange('sessionCommission', e.target.value)}
              placeholder="0"
            />
            <Input
              label="Casino Commission"
              type="number"
              min="0"
              max="100"
              value={form.casinoCommission}
              onChange={(e) => handleChange('casinoCommission', e.target.value)}
              placeholder="0"
            />
            <Input
              label="Matka Commission"
              type="number"
              min="0"
              max="100"
              value={form.matkaCommission}
              onChange={(e) => handleChange('matkaCommission', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Transaction Password */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Authorization</h4>
          <Input
            label="Transaction Password"
            type="password"
            value={form.transactionPassword}
            onChange={(e) => handleChange('transactionPassword', e.target.value)}
            placeholder="Enter your transaction password"
            required
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-700 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Creating...' : `Create ${childRole}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
