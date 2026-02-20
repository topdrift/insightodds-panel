'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore, Role } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useToastStore } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import {
  Cpu,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  ShieldAlert,
  Zap,
  TrendingDown,
  BarChart3,
  Activity,
  Lock,
  Unlock,
  AlertTriangle,
  AlertCircle,
  Target,
  Settings,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Shield,
  ChevronDown,
  Timer,
  Ban,
  Flag,
  Search,
  Percent,
  Bell,
} from 'lucide-react';

/* ───────────────────────── Types ───────────────────────── */

type RuleType = 'ODDS_MANIPULATION' | 'LIABILITY_THRESHOLD' | 'BET_DELAY' | 'AUTO_LOCK' | 'MARGIN_CONTROL';

interface AutomationRule {
  id: string;
  name: string;
  type: RuleType;
  isActive: boolean;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface LiabilityEvent {
  eventId: string;
  eventName: string;
  team1: string;
  team2: string;
  totalExposure: number;
  runners: Array<{
    name: string;
    exposure: number;
    netPosition: number;
  }>;
}

interface SharpBettor {
  userId: string;
  username: string;
  name: string;
  winRate: number;
  totalBets: number;
  netPL: number;
  status: string;
  flagged: boolean;
}

interface RiskAlert {
  id: string;
  type: 'HIGH_LIABILITY' | 'SHARP_BETTOR' | 'UNUSUAL_PATTERN' | 'LIMIT_BREACH';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  eventName?: string;
  timestamp: string;
  acknowledged: boolean;
}

interface AutomationStats {
  betsDelayed: number;
  marketsAutoLocked: number;
  oddsManipulated: number;
  alertsTriggered: number;
}

/* ───────────────────────── Rule Type Config ───────────────────────── */

const ruleTypeConfig: Record<RuleType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  ODDS_MANIPULATION: { label: 'Odds Manipulation', icon: <Sliders className="h-4 w-4" />, color: '#f59e0b', description: 'Automatically shift odds when liability exceeds thresholds' },
  LIABILITY_THRESHOLD: { label: 'Liability Threshold', icon: <Shield className="h-4 w-4" />, color: '#ef4444', description: 'Lock or alert when exposure exceeds maximum limits' },
  BET_DELAY: { label: 'Bet Delay', icon: <Timer className="h-4 w-4" />, color: '#3b82f6', description: 'Add delay to bet acceptance based on amount and patterns' },
  AUTO_LOCK: { label: 'Auto Lock', icon: <Lock className="h-4 w-4" />, color: '#8b5cf6', description: 'Automatically lock markets based on defined conditions' },
  MARGIN_CONTROL: { label: 'Margin Control', icon: <Percent className="h-4 w-4" />, color: '#10b981', description: 'Ensure minimum margin percentage on all markets' },
};

/* ───────────────────────── Stat Card ───────────────────────── */

function DashboardStat({ icon, label, value, color, trend }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  trend?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-5">
      <div className="absolute -top-8 -right-8 h-20 w-20 rounded-full opacity-10 blur-xl" style={{ background: color }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${color}15` }}>
            {icon}
          </div>
          {trend && (
            <span className="text-[10px] font-medium text-gray-500">{trend}</span>
          )}
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

/* ───────────────────────── Risk Alert Item ───────────────────────── */

function RiskAlertItem({ alert, onAcknowledge }: { alert: RiskAlert; onAcknowledge: (id: string) => void }) {
  const severityConfig = {
    low: { bg: 'bg-blue-500/10 border-blue-500/20', icon: <AlertCircle className="h-4 w-4 text-blue-400" />, text: 'text-blue-400' },
    medium: { bg: 'bg-yellow-500/10 border-yellow-500/20', icon: <AlertTriangle className="h-4 w-4 text-yellow-400" />, text: 'text-yellow-400' },
    high: { bg: 'bg-orange-500/10 border-orange-500/20', icon: <AlertTriangle className="h-4 w-4 text-orange-400" />, text: 'text-orange-400' },
    critical: { bg: 'bg-red-500/10 border-red-500/20', icon: <ShieldAlert className="h-4 w-4 text-red-400" />, text: 'text-red-400' },
  };

  const config = severityConfig[alert.severity];

  return (
    <div className={`flex items-start gap-3 rounded-xl border ${config.bg} p-3 transition-all ${alert.acknowledged ? 'opacity-50' : ''}`}>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-800/50">
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'high' ? 'warning' : 'info'}>
            {alert.severity.toUpperCase()}
          </Badge>
          <span className="text-[10px] text-gray-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="text-sm text-gray-200">{alert.message}</p>
        {alert.eventName && (
          <p className="text-xs text-gray-500 mt-0.5">{alert.eventName}</p>
        )}
      </div>
      {!alert.acknowledged && (
        <button
          onClick={() => onAcknowledge(alert.id)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-600/50 transition-colors"
          title="Acknowledge"
        >
          &times;
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── Liability Event Card ───────────────────────── */

function LiabilityEventCard({ event }: { event: LiabilityEvent }) {
  const [expanded, setExpanded] = useState(false);
  const maxExposure = Math.max(...event.runners.map((r) => Math.abs(r.exposure)), 1);

  return (
    <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl overflow-hidden transition-all hover:border-gray-600/40">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-bold text-white">{event.team1} vs {event.team2}</p>
          <p className="text-xs text-gray-500 mt-0.5">{event.eventName}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total Exposure</p>
            <p className={`text-sm font-bold ${event.totalExposure > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatCurrency(event.totalExposure)}
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-700/30 px-5 py-4 space-y-3">
          {event.runners.map((runner, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">{runner.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Exp: {formatCurrency(runner.exposure)}</span>
                  <span className={`text-xs font-bold ${runner.netPosition >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Net: {formatCurrency(runner.netPosition)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${runner.netPosition >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min((Math.abs(runner.exposure) / maxExposure) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Rule Config Form ───────────────────────── */

function RuleConfigForm({
  type,
  config,
  onChange,
}: {
  type: RuleType;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  const update = (key: string, value: any) => onChange({ ...config, [key]: value });

  switch (type) {
    case 'ODDS_MANIPULATION':
      return (
        <div className="space-y-3">
          <Input
            label="Liability Threshold (INR)"
            type="number"
            value={config.liabilityThreshold || ''}
            onChange={(e) => update('liabilityThreshold', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 100000"
          />
          <Input
            label="Shift Percentage (%)"
            type="number"
            step="0.1"
            value={config.shiftPercentage || ''}
            onChange={(e) => update('shiftPercentage', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 2.5"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Affected Markets</label>
            <div className="flex gap-2">
              {['MATCH_ODDS', 'SESSION', 'FANCY'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    const markets = config.affectedMarkets || [];
                    if (markets.includes(m)) {
                      update('affectedMarkets', markets.filter((x: string) => x !== m));
                    } else {
                      update('affectedMarkets', [...markets, m]);
                    }
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                    (config.affectedMarkets || []).includes(m)
                      ? 'bg-[var(--color-secondary)]/20 text-[var(--color-secondary)] border-[var(--color-secondary)]/30'
                      : 'bg-gray-800 text-gray-400 border-gray-700/30'
                  }`}
                >
                  {m.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    case 'LIABILITY_THRESHOLD':
      return (
        <div className="space-y-3">
          <Input
            label="Max Exposure Amount (INR)"
            type="number"
            value={config.maxExposure || ''}
            onChange={(e) => update('maxExposure', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 500000"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Action</label>
            <div className="flex gap-2">
              {['LOCK', 'ALERT', 'LOCK_AND_ALERT'].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => update('action', a)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                    config.action === a
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'bg-gray-800 text-gray-400 border-gray-700/30'
                  }`}
                >
                  {a.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    case 'BET_DELAY':
      return (
        <div className="space-y-3">
          <Input
            label="Base Delay (ms)"
            type="number"
            value={config.baseDelay || ''}
            onChange={(e) => update('baseDelay', parseInt(e.target.value) || 0)}
            placeholder="e.g. 500"
          />
          <Input
            label="High Amount Threshold (INR)"
            type="number"
            value={config.highAmountThreshold || ''}
            onChange={(e) => update('highAmountThreshold', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 50000"
          />
          <Input
            label="High Amount Delay (ms)"
            type="number"
            value={config.highAmountDelay || ''}
            onChange={(e) => update('highAmountDelay', parseInt(e.target.value) || 0)}
            placeholder="e.g. 3000"
          />
          <Input
            label="Very High Amount Threshold (INR)"
            type="number"
            value={config.veryHighAmountThreshold || ''}
            onChange={(e) => update('veryHighAmountThreshold', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 200000"
          />
          <Input
            label="Very High Amount Delay (ms)"
            type="number"
            value={config.veryHighAmountDelay || ''}
            onChange={(e) => update('veryHighAmountDelay', parseInt(e.target.value) || 0)}
            placeholder="e.g. 5000"
          />
        </div>
      );

    case 'AUTO_LOCK':
      return (
        <div className="space-y-3">
          <Input
            label="Time Before Event (minutes)"
            type="number"
            value={config.timeBeforeEvent || ''}
            onChange={(e) => update('timeBeforeEvent', parseInt(e.target.value) || 0)}
            placeholder="e.g. 5"
          />
          <Input
            label="Max Consecutive Losses Before Lock"
            type="number"
            value={config.maxConsecutiveLosses || ''}
            onChange={(e) => update('maxConsecutiveLosses', parseInt(e.target.value) || 0)}
            placeholder="e.g. 3"
          />
          <label className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30 cursor-pointer">
            <input
              type="checkbox"
              checked={config.lockOnSuspension || false}
              onChange={(e) => update('lockOnSuspension', e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--color-secondary)]"
            />
            <div>
              <span className="text-sm font-medium text-white">Lock on API Suspension</span>
              <p className="text-xs text-gray-500">Auto-lock when upstream feed suspends</p>
            </div>
          </label>
        </div>
      );

    case 'MARGIN_CONTROL':
      return (
        <div className="space-y-3">
          <Input
            label="Minimum Margin (%)"
            type="number"
            step="0.1"
            value={config.minimumMargin || ''}
            onChange={(e) => update('minimumMargin', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 5"
          />
          <label className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoAdjust || false}
              onChange={(e) => update('autoAdjust', e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--color-secondary)]"
            />
            <div>
              <span className="text-sm font-medium text-white">Auto-adjust Odds</span>
              <p className="text-xs text-gray-500">Automatically adjust odds to maintain minimum margin</p>
            </div>
          </label>
        </div>
      );
  }
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function AutomationPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const role = user?.role as Role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  // State
  const [activeSection, setActiveSection] = useState<'dashboard' | 'rules' | 'liability' | 'sharps' | 'bulk'>('dashboard');
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [editRule, setEditRule] = useState<AutomationRule | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dashboard state
  const [stats, setStats] = useState<AutomationStats>({ betsDelayed: 0, marketsAutoLocked: 0, oddsManipulated: 0, alertsTriggered: 0 });
  const [liabilityEvents, setLiabilityEvents] = useState<LiabilityEvent[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [sharpBettors, setSharpBettors] = useState<SharpBettor[]>([]);
  const [sharpSearch, setSharpSearch] = useState('');
  const [sharpSort, setSharpSort] = useState<'winRate' | 'netPL'>('winRate');

  // Rule form
  const [ruleForm, setRuleForm] = useState<{
    name: string;
    type: RuleType;
    isActive: boolean;
    config: Record<string, any>;
  }>({
    name: '',
    type: 'ODDS_MANIPULATION',
    isActive: true,
    config: {},
  });

  // Bulk operations
  const [globalBetDelay, setGlobalBetDelay] = useState(0);
  const [reduceLimitPercent, setReduceLimitPercent] = useState(10);
  const [bulkConfirm, setBulkConfirm] = useState<string | null>(null);

  // Fetch data
  const fetchRules = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/automation/rules');
      setRules(data.rules || data.data || []);
    } catch {
      // API may not exist yet, use empty state
      setRules([]);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const [statsRes, liabilityRes, alertsRes, sharpsRes] = await Promise.allSettled([
        api.get('/admin/automation/stats'),
        api.get('/admin/automation/liability'),
        api.get('/admin/automation/alerts'),
        api.get('/admin/automation/sharp-bettors'),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data || stats);
      if (liabilityRes.status === 'fulfilled') setLiabilityEvents(liabilityRes.value.data.events || []);
      if (alertsRes.status === 'fulfilled') setRiskAlerts(alertsRes.value.data.alerts || []);
      if (sharpsRes.status === 'fulfilled') setSharpBettors(sharpsRes.value.data.bettors || []);
    } catch {
      // Silent - data will be empty
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([fetchRules(), fetchDashboard()]).finally(() => setLoading(false));
  }, [isAdmin, fetchRules, fetchDashboard]);

  // Refresh every 30 seconds
  useEffect(() => {
    if (!isAdmin) return;
    const iv = setInterval(fetchDashboard, 30000);
    return () => clearInterval(iv);
  }, [isAdmin, fetchDashboard]);

  // Socket for real-time alerts
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleAlert = (alert: RiskAlert) => {
      setRiskAlerts((prev) => [alert, ...prev].slice(0, 50));
    };

    socket.on('automation:alert', handleAlert);
    return () => { socket.off('automation:alert', handleAlert); };
  }, []);

  // Rule CRUD
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name) { addToast('Rule name is required', 'error'); return; }
    setSubmitting(true);
    try {
      await api.post('/admin/automation/rules', ruleForm);
      addToast('Rule created', 'success');
      setShowCreateRule(false);
      setRuleForm({ name: '', type: 'ODDS_MANIPULATION', isActive: true, config: {} });
      fetchRules();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to create rule', 'error');
    }
    setSubmitting(false);
  };

  const handleEditRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRule) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/automation/rules/${editRule.id}`, ruleForm);
      addToast('Rule updated', 'success');
      setEditRule(null);
      fetchRules();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update rule', 'error');
    }
    setSubmitting(false);
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this automation rule?')) return;
    try {
      await api.delete(`/admin/automation/rules/${id}`);
      addToast('Rule deleted', 'success');
      fetchRules();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const toggleRule = async (rule: AutomationRule) => {
    try {
      await api.put(`/admin/automation/rules/${rule.id}`, { isActive: !rule.isActive });
      addToast(`Rule ${rule.isActive ? 'deactivated' : 'activated'}`, 'success');
      fetchRules();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const openEditRule = (rule: AutomationRule) => {
    setRuleForm({ name: rule.name, type: rule.type, isActive: rule.isActive, config: rule.config || {} });
    setEditRule(rule);
  };

  const acknowledgeAlert = (id: string) => {
    setRiskAlerts((prev) => prev.map((a) => a.id === id ? { ...a, acknowledged: true } : a));
  };

  // Bulk operations
  const handleBulkOperation = async (op: string) => {
    setBulkConfirm(null);
    try {
      switch (op) {
        case 'lockAll':
          await api.post('/admin/automation/bulk/lock-all-markets');
          addToast('All active markets locked', 'success');
          break;
        case 'unlockAll':
          await api.post('/admin/automation/bulk/unlock-all-markets');
          addToast('All markets unlocked', 'success');
          break;
        case 'setGlobalDelay':
          await api.post('/admin/automation/bulk/global-bet-delay', { delay: globalBetDelay });
          addToast(`Global bet delay set to ${globalBetDelay}ms`, 'success');
          break;
        case 'reduceLimits':
          await api.post('/admin/automation/bulk/reduce-limits', { percentage: reduceLimitPercent });
          addToast(`All limits reduced by ${reduceLimitPercent}%`, 'success');
          break;
      }
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Operation failed', 'error');
    }
  };

  // Sharp bettors with search and sort
  const filteredSharps = useMemo(() => {
    let filtered = [...sharpBettors];
    if (sharpSearch) {
      const q = sharpSearch.toLowerCase();
      filtered = filtered.filter((s) => s.username.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    filtered.sort((a, b) => sharpSort === 'winRate' ? b.winRate - a.winRate : b.netPL - a.netPL);
    return filtered;
  }, [sharpBettors, sharpSearch, sharpSort]);

  // Access denied for non-admins
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
            <Cpu className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Automation</h1>
        </div>
        <Card className="!border-dashed">
          <CardContent className="py-16 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-gray-500" />
            <p className="text-lg font-semibold text-gray-400 mb-1">Admin Access Required</p>
            <p className="text-sm text-gray-500">Only administrators can access automation controls.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sections = [
    { key: 'dashboard' as const, label: 'Dashboard', icon: <Activity className="h-4 w-4" /> },
    { key: 'rules' as const, label: 'Rules', icon: <Settings className="h-4 w-4" /> },
    { key: 'liability' as const, label: 'Liability', icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'sharps' as const, label: 'Sharp Bettors', icon: <Target className="h-4 w-4" /> },
    { key: 'bulk' as const, label: 'Bulk Ops', icon: <Zap className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-orange-500 shadow-lg shadow-red-500/20">
          <Cpu className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Automation Control Center</h1>
          <p className="text-xs text-gray-500">Risk management, odds control & market automation</p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              activeSection === s.key
                ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/20'
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white border border-gray-700/30'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-700/30 bg-gray-800/30 p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* ═══════ DASHBOARD ═══════ */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DashboardStat icon={<Timer className="h-5 w-5 text-blue-400" />} label="Bets Delayed Today" value={stats.betsDelayed} color="#3b82f6" trend="Today" />
                <DashboardStat icon={<Lock className="h-5 w-5 text-purple-400" />} label="Markets Auto-Locked" value={stats.marketsAutoLocked} color="#8b5cf6" trend="Today" />
                <DashboardStat icon={<Sliders className="h-5 w-5 text-yellow-400" />} label="Odds Manipulated" value={stats.oddsManipulated} color="#f59e0b" trend="Today" />
                <DashboardStat icon={<Bell className="h-5 w-5 text-red-400" />} label="Alerts Triggered" value={stats.alertsTriggered} color="#ef4444" trend="Today" />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Live Liability Overview */}
                <div>
                  <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-[var(--color-secondary)]" /> Live Liability
                  </h3>
                  {liabilityEvents.length === 0 ? (
                    <Card className="!border-dashed">
                      <CardContent className="py-8 text-center">
                        <BarChart3 className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                        <p className="text-sm text-gray-500">No active liability data</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {liabilityEvents.slice(0, 5).map((event) => (
                        <LiabilityEventCard key={event.eventId} event={event} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Risk Alerts Feed */}
                <div>
                  <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" /> Risk Alerts
                    {riskAlerts.filter((a) => !a.acknowledged).length > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {riskAlerts.filter((a) => !a.acknowledged).length}
                      </span>
                    )}
                  </h3>
                  {riskAlerts.length === 0 ? (
                    <Card className="!border-dashed">
                      <CardContent className="py-8 text-center">
                        <Shield className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                        <p className="text-sm text-gray-500">No alerts - all systems normal</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {riskAlerts.map((alert) => (
                        <RiskAlertItem key={alert.id} alert={alert} onAcknowledge={acknowledgeAlert} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════ RULES ═══════ */}
          {activeSection === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{rules.length} automation rules configured</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={fetchRules} className="!rounded-xl">
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" onClick={() => { setRuleForm({ name: '', type: 'ODDS_MANIPULATION', isActive: true, config: {} }); setShowCreateRule(true); }} className="!rounded-xl">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Create Rule
                  </Button>
                </div>
              </div>

              {rules.length === 0 ? (
                <Card className="!border-dashed">
                  <CardContent className="py-16 text-center">
                    <Settings className="mx-auto mb-4 h-12 w-12 text-gray-500" />
                    <p className="text-lg font-semibold text-gray-400 mb-1">No Automation Rules</p>
                    <p className="text-sm text-gray-500 mb-4">Create rules to automate risk management.</p>
                    <Button onClick={() => setShowCreateRule(true)} className="!rounded-xl">
                      <Plus className="mr-1 h-4 w-4" /> Create Your First Rule
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => {
                    const tc = ruleTypeConfig[rule.type];
                    return (
                      <div
                        key={rule.id}
                        className="group flex items-center justify-between rounded-2xl border border-gray-700/30 bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-xl px-5 py-4 hover:border-gray-600/40 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${tc.color}15` }}>
                            <span style={{ color: tc.color }}>{tc.icon}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-white">{rule.name}</p>
                              <Badge variant={rule.isActive ? 'success' : 'danger'}>
                                {rule.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge style={{ background: `${tc.color}20`, color: tc.color }}>{tc.label}</Badge>
                              <span className="text-[11px] text-gray-500">{formatDate(rule.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleRule(rule)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
                          >
                            {rule.isActive ? <ToggleRight className="h-4 w-4 text-green-400" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                          </button>
                          <button
                            onClick={() => openEditRule(rule)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 text-blue-400 hover:bg-blue-500/20 transition-colors"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create Rule Modal */}
              <Modal isOpen={showCreateRule} onClose={() => setShowCreateRule(false)} title="Create Automation Rule" className="max-w-xl">
                <form onSubmit={handleCreateRule} className="space-y-4">
                  <Input
                    label="Rule Name"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                    placeholder="e.g. High Liability Auto-Lock"
                    required
                  />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-300">Rule Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(ruleTypeConfig) as RuleType[]).map((type) => {
                        const tc = ruleTypeConfig[type];
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setRuleForm({ ...ruleForm, type, config: {} })}
                            className={`flex items-center gap-2 rounded-xl p-3 text-left border transition-all ${
                              ruleForm.type === type
                                ? 'border-[var(--color-secondary)]/50 bg-[var(--color-secondary)]/5'
                                : 'border-gray-700/30 bg-gray-800/50 hover:border-gray-600'
                            }`}
                          >
                            <span style={{ color: tc.color }}>{tc.icon}</span>
                            <div>
                              <p className="text-xs font-semibold text-white">{tc.label}</p>
                              <p className="text-[10px] text-gray-500">{tc.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-gray-700/30 pt-4">
                    <p className="text-sm font-semibold text-gray-300 mb-3">Configuration</p>
                    <RuleConfigForm type={ruleForm.type} config={ruleForm.config} onChange={(config) => setRuleForm({ ...ruleForm, config })} />
                  </div>

                  <label className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleForm.isActive}
                      onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })}
                      className="h-4 w-4 rounded accent-[var(--color-secondary)]"
                    />
                    <span className="text-sm font-medium text-white">Enable immediately</span>
                  </label>

                  <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Rule'}
                  </Button>
                </form>
              </Modal>

              {/* Edit Rule Modal */}
              <Modal isOpen={!!editRule} onClose={() => setEditRule(null)} title={`Edit: ${editRule?.name}`} className="max-w-xl">
                <form onSubmit={handleEditRule} className="space-y-4">
                  <Input
                    label="Rule Name"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                    required
                  />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-300">Configuration</label>
                    <RuleConfigForm type={ruleForm.type} config={ruleForm.config} onChange={(config) => setRuleForm({ ...ruleForm, config })} />
                  </div>
                  <label className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-4 py-3 border border-gray-700/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleForm.isActive}
                      onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })}
                      className="h-4 w-4 rounded accent-[var(--color-secondary)]"
                    />
                    <span className="text-sm font-medium text-white">Active</span>
                  </label>
                  <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
                    {submitting ? 'Updating...' : 'Update Rule'}
                  </Button>
                </form>
              </Modal>
            </div>
          )}

          {/* ═══════ LIABILITY ═══════ */}
          {activeSection === 'liability' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{liabilityEvents.length} events with exposure</p>
                <Button size="sm" variant="outline" onClick={fetchDashboard} className="!rounded-xl">
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
              {liabilityEvents.length === 0 ? (
                <Card className="!border-dashed">
                  <CardContent className="py-16 text-center">
                    <BarChart3 className="mx-auto mb-4 h-12 w-12 text-gray-500" />
                    <p className="text-lg font-semibold text-gray-400">No Liability Data</p>
                    <p className="text-sm text-gray-500">Liability details will appear when events have active bets.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {liabilityEvents.map((event) => (
                    <LiabilityEventCard key={event.eventId} event={event} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ SHARP BETTORS ═══════ */}
          {activeSection === 'sharps' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    className="pl-9 !rounded-xl !border-gray-700/50 !bg-gray-800/50"
                    placeholder="Search bettors..."
                    value={sharpSearch}
                    onChange={(e) => setSharpSearch(e.target.value)}
                  />
                </div>
                <div className="flex rounded-xl border border-gray-700/50 bg-gray-800/50 overflow-hidden">
                  <button
                    onClick={() => setSharpSort('winRate')}
                    className={`px-4 py-2 text-xs font-medium transition-colors ${sharpSort === 'winRate' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Win Rate
                  </button>
                  <button
                    onClick={() => setSharpSort('netPL')}
                    className={`px-4 py-2 text-xs font-medium transition-colors ${sharpSort === 'netPL' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Net P&L
                  </button>
                </div>
              </div>

              {filteredSharps.length === 0 ? (
                <Card className="!border-dashed">
                  <CardContent className="py-16 text-center">
                    <Target className="mx-auto mb-4 h-12 w-12 text-gray-500" />
                    <p className="text-lg font-semibold text-gray-400">No Sharp Bettors Detected</p>
                    <p className="text-sm text-gray-500">The system monitors betting patterns automatically.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/30 to-gray-900/30 backdrop-blur-xl">
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Username</Th>
                        <Th>Win Rate</Th>
                        <Th>Total Bets</Th>
                        <Th>Net P&L</Th>
                        <Th>Status</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredSharps.map((bettor) => (
                        <Tr key={bettor.userId}>
                          <Td>
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-900/20 text-[10px] font-bold text-red-400">
                                {bettor.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">{bettor.username}</p>
                                <p className="text-[11px] text-gray-500">{bettor.name}</p>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${bettor.winRate > 60 ? 'bg-red-500' : bettor.winRate > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                  style={{ width: `${bettor.winRate}%` }}
                                />
                              </div>
                              <span className={`text-sm font-bold ${bettor.winRate > 60 ? 'text-red-400' : bettor.winRate > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                                {bettor.winRate.toFixed(1)}%
                              </span>
                            </div>
                          </Td>
                          <Td className="text-gray-300">{bettor.totalBets.toLocaleString()}</Td>
                          <Td>
                            <span className={`text-sm font-bold ${bettor.netPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatCurrency(bettor.netPL)}
                            </span>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-1">
                              {bettor.flagged && <Badge variant="danger"><Flag className="mr-1 h-3 w-3" /> Flagged</Badge>}
                              <Badge variant={bettor.status === 'ACTIVE' ? 'success' : 'danger'}>{bettor.status}</Badge>
                            </div>
                          </Td>
                          <Td>
                            <div className="flex gap-1">
                              <button
                                onClick={async () => {
                                  try {
                                    await api.post(`/admin/automation/sharp-bettors/${bettor.userId}/reduce-limits`);
                                    addToast('Limits reduced', 'success');
                                  } catch { addToast('Failed', 'error'); }
                                }}
                                className="flex h-7 items-center gap-1 rounded-lg bg-yellow-900/20 px-2 text-[11px] font-medium text-yellow-400 hover:bg-yellow-900/30 border border-yellow-900/20 transition-colors"
                                title="Reduce Limits"
                              >
                                <TrendingDown className="h-3 w-3" />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await api.post(`/admin/automation/sharp-bettors/${bettor.userId}/add-delay`);
                                    addToast('Delay added', 'success');
                                  } catch { addToast('Failed', 'error'); }
                                }}
                                className="flex h-7 items-center gap-1 rounded-lg bg-blue-900/20 px-2 text-[11px] font-medium text-blue-400 hover:bg-blue-900/30 border border-blue-900/20 transition-colors"
                                title="Add Delay"
                              >
                                <Timer className="h-3 w-3" />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await api.post(`/admin/automation/sharp-bettors/${bettor.userId}/lock`);
                                    addToast('User locked', 'success');
                                  } catch { addToast('Failed', 'error'); }
                                }}
                                className="flex h-7 items-center gap-1 rounded-lg bg-red-900/20 px-2 text-[11px] font-medium text-red-400 hover:bg-red-900/30 border border-red-900/20 transition-colors"
                                title="Lock User"
                              >
                                <Ban className="h-3 w-3" />
                              </button>
                            </div>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* ═══════ BULK OPERATIONS ═══════ */}
          {activeSection === 'bulk' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-red-900/30 bg-red-900/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <p className="text-sm font-semibold text-red-400">Warning: Bulk Operations</p>
                </div>
                <p className="text-xs text-gray-400">
                  These operations affect all active markets and users. Use with caution. Actions cannot be easily undone.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Lock All Markets */}
                <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                      <Lock className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Lock All Markets</p>
                      <p className="text-xs text-gray-500">Immediately suspend all active markets</p>
                    </div>
                  </div>
                  {bulkConfirm === 'lockAll' ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" onClick={() => handleBulkOperation('lockAll')} className="flex-1 !rounded-xl">
                        Confirm Lock
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setBulkConfirm(null)} className="!rounded-xl">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => setBulkConfirm('lockAll')} className="w-full !rounded-xl">
                      <Lock className="mr-1 h-4 w-4" /> Lock All Active Markets
                    </Button>
                  )}
                </div>

                {/* Unlock All Markets */}
                <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                      <Unlock className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Unlock All Markets</p>
                      <p className="text-xs text-gray-500">Resume all locked markets</p>
                    </div>
                  </div>
                  {bulkConfirm === 'unlockAll' ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleBulkOperation('unlockAll')} className="flex-1 !rounded-xl">
                        Confirm Unlock
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setBulkConfirm(null)} className="!rounded-xl">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => setBulkConfirm('unlockAll')} className="w-full !rounded-xl">
                      <Unlock className="mr-1 h-4 w-4" /> Unlock All Markets
                    </Button>
                  )}
                </div>

                {/* Global Bet Delay */}
                <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                      <Timer className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Global Bet Delay</p>
                      <p className="text-xs text-gray-500">Add delay to all bet placements</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="5000"
                        step="100"
                        value={globalBetDelay}
                        onChange={(e) => setGlobalBetDelay(parseInt(e.target.value))}
                        className="flex-1 accent-blue-500"
                      />
                      <span className="text-sm font-bold text-blue-400 w-16 text-right">
                        {globalBetDelay >= 1000 ? `${(globalBetDelay / 1000).toFixed(1)}s` : `${globalBetDelay}ms`}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>0ms</span><span>1s</span><span>2s</span><span>3s</span><span>4s</span><span>5s</span>
                    </div>
                    {bulkConfirm === 'setGlobalDelay' ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleBulkOperation('setGlobalDelay')} className="flex-1 !rounded-xl">
                          Apply {globalBetDelay}ms
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setBulkConfirm(null)} className="!rounded-xl">
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setBulkConfirm('setGlobalDelay')} className="w-full !rounded-xl">
                        Set Global Delay
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reduce All Limits */}
                <div className="rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                      <TrendingDown className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Reduce All Limits</p>
                      <p className="text-xs text-gray-500">Reduce exposure limits for all users</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={reduceLimitPercent.toString()}
                        onChange={(e) => setReduceLimitPercent(parseInt(e.target.value) || 10)}
                        className="!w-20"
                      />
                      <span className="text-sm text-gray-400">% reduction</span>
                    </div>
                    {bulkConfirm === 'reduceLimits' ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" onClick={() => handleBulkOperation('reduceLimits')} className="flex-1 !rounded-xl">
                          Reduce by {reduceLimitPercent}%
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setBulkConfirm(null)} className="!rounded-xl">
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setBulkConfirm('reduceLimits')} className="w-full !rounded-xl">
                        <TrendingDown className="mr-1 h-4 w-4" /> Reduce Limits
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
