'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToastStore } from '@/components/ui/toast';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  User,
  Shield,
  Lock,
  Key,
  Palette,
  Bell,
  Info,
  Settings as SettingsIcon,
  Check,
  Eye,
  EyeOff,
  AtSign,
  Smartphone,
  Globe,
  HelpCircle,
  Wallet,
  TrendingUp,
  Percent,
} from 'lucide-react';

/* ───────────────────────── Section Wrapper ───────────────────────── */

function SettingsSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-700/40 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl">
      <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-[var(--color-primary)]/5 blur-2xl" />
      <div className="relative z-10">
        <div className="flex items-center gap-4 border-b border-gray-700/40 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-secondary)]/10 border border-gray-700/30">
            {icon}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Info Row ───────────────────────── */

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-gray-800/40 px-4 py-3 border border-gray-700/20">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50">
          {icon}
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { config, updateConfig } = useThemeStore();
  const { addToast } = useToastStore();
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);

  // Password change
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Transaction password
  const [txPwForm, setTxPwForm] = useState({ currentPassword: '', newTransactionPassword: '', confirmTransactionPassword: '' });
  const [txPwSubmitting, setTxPwSubmitting] = useState(false);

  useEffect(() => {
    setForm(config);
  }, [config]);

  const handleSaveWhitelabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/whitelabel', form);
      updateConfig(form);
      addToast('Theme settings saved successfully', 'success');
    } catch {
      addToast('Failed to save theme', 'error');
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }
    setPwSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      addToast('Password changed successfully', 'success');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to change password', 'error');
    }
    setPwSubmitting(false);
  };

  const handleChangeTransactionPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (txPwForm.newTransactionPassword !== txPwForm.confirmTransactionPassword) {
      addToast('Transaction passwords do not match', 'error');
      return;
    }
    setTxPwSubmitting(true);
    try {
      await api.post('/auth/change-transaction-password', {
        currentPassword: txPwForm.currentPassword,
        newTransactionPassword: txPwForm.newTransactionPassword,
      });
      addToast('Transaction password changed successfully', 'success');
      setTxPwForm({ currentPassword: '', newTransactionPassword: '', confirmTransactionPassword: '' });
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to change transaction password', 'error');
    }
    setTxPwSubmitting(false);
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
          <SettingsIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-xs text-gray-500">Manage your account and preferences</p>
        </div>
      </div>

      {/* Profile Section */}
      <SettingsSection
        icon={<User className="h-5 w-5 text-[var(--color-secondary)]" />}
        title="Profile"
        subtitle="Your personal information"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-2xl font-bold text-white shadow-lg">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">{user?.name || 'User'}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ? 'info' : user?.role === 'AGENT' ? 'warning' : 'success'}>
                  {user?.role || 'N/A'}
                </Badge>
                <span className="text-xs text-gray-500">@{user?.username}</span>
              </div>
            </div>
          </div>

          <InfoRow
            icon={<AtSign className="h-4 w-4 text-gray-400" />}
            label="Username"
            value={user?.username || 'N/A'}
          />
          <InfoRow
            icon={<User className="h-4 w-4 text-gray-400" />}
            label="Full Name"
            value={user?.name || 'N/A'}
          />
          <InfoRow
            icon={<Smartphone className="h-4 w-4 text-gray-400" />}
            label="Mobile"
            value={user?.mobile || 'Not set'}
          />
          <InfoRow
            icon={<Shield className="h-4 w-4 text-gray-400" />}
            label="Role"
            value={user?.role || 'N/A'}
          />
          <InfoRow
            icon={<Wallet className="h-4 w-4 text-gray-400" />}
            label="Balance"
            value={formatCurrency(user?.balance ?? 0)}
          />
          <InfoRow
            icon={<TrendingUp className="h-4 w-4 text-gray-400" />}
            label="Exposure"
            value={formatCurrency(user?.exposure ?? 0)}
          />
          {(user?.matchCommission !== undefined || user?.sessionCommission !== undefined) && (
            <>
              <InfoRow
                icon={<Percent className="h-4 w-4 text-gray-400" />}
                label="Match Commission"
                value={`${user?.matchCommission ?? 0}%`}
              />
              <InfoRow
                icon={<Percent className="h-4 w-4 text-gray-400" />}
                label="Session Commission"
                value={`${user?.sessionCommission ?? 0}%`}
              />
            </>
          )}
        </div>
      </SettingsSection>

      {/* Security - Change Password */}
      <SettingsSection
        icon={<Lock className="h-5 w-5 text-[var(--color-secondary)]" />}
        title="Change Password"
        subtitle="Update your login password"
      >
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div className="relative">
            <Input
              label="Current Password"
              type={showCurrentPw ? 'text' : 'password'}
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPw(!showCurrentPw)}
              className="absolute right-3 top-8 text-gray-400 hover:text-white"
            >
              {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <Input
              label="New Password"
              type={showNewPw ? 'text' : 'password'}
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPw(!showNewPw)}
              className="absolute right-3 top-8 text-gray-400 hover:text-white"
            >
              {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Input
            label="Confirm New Password"
            type="password"
            value={pwForm.confirmPassword}
            onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
            required
          />
          {pwForm.newPassword && (
            <div className="flex items-center gap-2 text-xs">
              <div className={`h-1.5 flex-1 rounded-full ${
                pwForm.newPassword.length >= 8 ? 'bg-green-500' : pwForm.newPassword.length >= 6 ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className={
                pwForm.newPassword.length >= 8 ? 'text-green-400' : pwForm.newPassword.length >= 6 ? 'text-yellow-400' : 'text-red-400'
              }>
                {pwForm.newPassword.length >= 8 ? 'Strong' : pwForm.newPassword.length >= 6 ? 'Fair' : 'Weak'}
              </span>
            </div>
          )}
          <Button type="submit" disabled={pwSubmitting} className="!rounded-xl">
            {pwSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Changing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" /> Update Password
              </span>
            )}
          </Button>
        </form>
      </SettingsSection>

      {/* Security - Transaction Password */}
      <SettingsSection
        icon={<Key className="h-5 w-5 text-[var(--color-secondary)]" />}
        title="Transaction Password"
        subtitle="Required for financial operations"
      >
        <form onSubmit={handleChangeTransactionPassword} className="space-y-4 max-w-md">
          <Input
            label="Login Password"
            type="password"
            value={txPwForm.currentPassword}
            onChange={(e) => setTxPwForm({ ...txPwForm, currentPassword: e.target.value })}
            required
          />
          <Input
            label="New Transaction Password"
            type="password"
            value={txPwForm.newTransactionPassword}
            onChange={(e) => setTxPwForm({ ...txPwForm, newTransactionPassword: e.target.value })}
            required
          />
          <Input
            label="Confirm Transaction Password"
            type="password"
            value={txPwForm.confirmTransactionPassword}
            onChange={(e) => setTxPwForm({ ...txPwForm, confirmTransactionPassword: e.target.value })}
            required
          />
          <Button type="submit" disabled={txPwSubmitting} className="!rounded-xl">
            {txPwSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Changing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" /> Update Transaction Password
              </span>
            )}
          </Button>
        </form>
      </SettingsSection>

      {/* Whitelabel Config (Admin) */}
      {isAdmin && (
        <SettingsSection
          icon={<Palette className="h-5 w-5 text-[var(--color-secondary)]" />}
          title="Whitelabel Configuration"
          subtitle="Customize the look and feel of the platform"
        >
          <form onSubmit={handleSaveWhitelabel} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Site Name"
                value={form.siteName}
                onChange={(e) => setForm({ ...form, siteName: e.target.value })}
              />
              <Input
                label="Logo URL"
                value={form.logoUrl || ''}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-300 mb-3">Color Palette</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Primary', key: 'primaryColor' as const, value: form.primaryColor },
                  { label: 'Secondary', key: 'secondaryColor' as const, value: form.secondaryColor },
                  { label: 'Accent', key: 'accentColor' as const, value: form.accentColor },
                  { label: 'Background', key: 'bgColor' as const, value: form.bgColor },
                  { label: 'Card', key: 'cardColor' as const, value: form.cardColor },
                  { label: 'Text', key: 'textColor' as const, value: form.textColor },
                ].map((c) => (
                  <div key={c.key} className="space-y-2">
                    <label className="block text-xs font-medium text-gray-400">{c.label}</label>
                    <div className="flex items-center gap-2 rounded-xl border border-gray-700/40 bg-gray-800/50 px-3 py-2">
                      <input
                        type="color"
                        value={c.value}
                        onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                        className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={c.value}
                        onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                        className="flex-1 bg-transparent text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <p className="text-sm font-semibold text-gray-300 mb-3">Live Preview</p>
              <div className="rounded-2xl p-5 border border-gray-700/30" style={{ background: form.bgColor, color: form.textColor }}>
                <div className="rounded-xl p-4 mb-3" style={{ background: form.cardColor }}>
                  <h3 className="text-lg font-bold mb-2" style={{ color: form.secondaryColor }}>{form.siteName}</h3>
                  <p className="text-sm mb-3" style={{ color: form.textColor }}>This is how your platform will look to users.</p>
                  <div className="flex gap-2">
                    <span className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ background: form.primaryColor }}>Primary</span>
                    <span className="rounded-lg px-3 py-1.5 text-xs font-medium text-black" style={{ background: form.secondaryColor }}>Secondary</span>
                    <span className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ background: form.accentColor }}>Accent</span>
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={saving} className="!rounded-xl">
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" /> Save Theme
                </span>
              )}
            </Button>
          </form>
        </SettingsSection>
      )}

      {/* Preferences */}
      <SettingsSection
        icon={<Bell className="h-5 w-5 text-[var(--color-secondary)]" />}
        title="Preferences"
        subtitle="Notification and display settings"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-gray-800/40 px-4 py-3 border border-gray-700/20">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-white">Push Notifications</p>
                <p className="text-xs text-gray-500">Receive alerts for bets, deposits, and more</p>
              </div>
            </div>
            <Badge variant="warning">Coming Soon</Badge>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-gray-800/40 px-4 py-3 border border-gray-700/20">
            <div className="flex items-center gap-3">
              <Palette className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-white">Dark / Light Theme</p>
                <p className="text-xs text-gray-500">Toggle between visual themes</p>
              </div>
            </div>
            <Badge variant="warning">Coming Soon</Badge>
          </div>
        </div>
      </SettingsSection>

      {/* About */}
      <SettingsSection
        icon={<Info className="h-5 w-5 text-[var(--color-secondary)]" />}
        title="About"
        subtitle="Application information"
      >
        <div className="space-y-3">
          <InfoRow
            icon={<Globe className="h-4 w-4 text-gray-400" />}
            label="Platform"
            value={config.siteName || 'Shakti11'}
          />
          <InfoRow
            icon={<Info className="h-4 w-4 text-gray-400" />}
            label="Version"
            value="2.0.0"
          />
          <InfoRow
            icon={<HelpCircle className="h-4 w-4 text-gray-400" />}
            label="Support"
            value="support@shakti11.com"
          />
        </div>
      </SettingsSection>

      {/* Audit Logs (Admin) */}
      {isAdmin && <AuditLogs />}
    </div>
  );
}

/* ───────────────────────── Audit Logs ───────────────────────── */

function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/settings/audit-logs', { params: { limit: 30 } })
      .then(({ data }) => setLogs(data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <SettingsSection
      icon={<Shield className="h-5 w-5 text-[var(--color-secondary)]" />}
      title="Audit Logs"
      subtitle="Recent activity on your account"
    >
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-gray-800/40 px-4 py-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gray-700" />
                <div className="space-y-1">
                  <div className="h-3 w-24 rounded bg-gray-700" />
                  <div className="h-2 w-32 rounded bg-gray-700" />
                </div>
              </div>
              <div className="h-3 w-16 rounded bg-gray-700" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-6">No audit logs available</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-xl bg-gray-800/40 px-4 py-3 border border-gray-700/20 hover:border-gray-600/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50">
                  <Shield className="h-3.5 w-3.5 text-gray-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-white">{log.user?.username}</span>
                  <span className="text-sm text-gray-400 ml-2">{log.action}</span>
                  {log.entity && <span className="text-xs text-gray-500 ml-1">({log.entity})</span>}
                </div>
              </div>
              <span className="text-[11px] text-gray-500 whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
