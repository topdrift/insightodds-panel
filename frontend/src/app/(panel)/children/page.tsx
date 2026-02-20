'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
// card import removed - unused
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
  Search,
  ArrowUpDown,
  Edit3,
  Shield,
  Key,
  Info,
  History,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  UserX,
  Wallet,
  AlertTriangle,
  ChevronDown,
  Lock,
  Unlock,
  BarChart3,
  ArrowDownCircle,
  ArrowUpCircle,
  MoreVertical,
  DollarSign,
  UserPlus,
} from 'lucide-react';

/* ───────────────────────── Types ───────────────────────── */

interface Child {
  id: string;
  username: string;
  name: string;
  role: string;
  balance: number;
  exposure: number;
  creditReference: number;
  exposureLimit: number;
  isActive: boolean;
  isBetLocked: boolean;
  matchCommission: number;
  sessionCommission: number;
  casinoCommission: number;
  matkaCommission: number;
  myPartnership: number;
  myCasinoPartnership: number;
  myMatkaPartnership: number;
}

interface CoinHistoryEntry {
  id: string;
  type: string;
  amount: number;
  balance: number;
  remark: string;
  createdAt: string;
}

type SortField = 'username' | 'name' | 'role' | 'balance' | 'exposure' | 'creditReference';
type SortDir = 'asc' | 'desc';
type RoleFilter = 'ALL' | 'ADMIN' | 'AGENT' | 'CLIENT';

/* ───────────────────────── Stats Card ───────────────────────── */

function StatCard({
  icon,
  label,
  value,
  color,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  subtext?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl p-4">
      <div className="absolute -top-8 -right-8 h-16 w-16 rounded-full opacity-10 blur-xl" style={{ background: color }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl`} style={{ background: `${color}20` }}>
            {icon}
          </div>
        </div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {subtext && <p className="text-[10px] text-gray-600 mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}

/* ───────────────────────── Action Dropdown ───────────────────────── */

function ActionDropdown({
  child,
  onDeposit,
  onEdit,
  onLimits,
  onToggleActive,
  onToggleBetLock,
  onPassword,
  onInfo,
  onCoinHistory,
  onDashboard,
}: {
  child: Child;
  onDeposit: () => void;
  onEdit: () => void;
  onLimits: () => void;
  onToggleActive: () => void;
  onToggleBetLock: () => void;
  onPassword: () => void;
  onInfo: () => void;
  onCoinHistory: () => void;
  onDashboard: () => void;
}) {
  const [open, setOpen] = useState(false);

  const actions = [
    { icon: <DollarSign className="h-3.5 w-3.5" />, label: 'Deposit / Withdraw', onClick: onDeposit, color: 'text-green-400' },
    { icon: <Edit3 className="h-3.5 w-3.5" />, label: 'Edit Commissions', onClick: onEdit, color: 'text-blue-400' },
    { icon: <Shield className="h-3.5 w-3.5" />, label: 'Set Limits', onClick: onLimits, color: 'text-purple-400' },
    { icon: child.isActive ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />, label: child.isActive ? 'Lock User' : 'Unlock User', onClick: onToggleActive, color: child.isActive ? 'text-red-400' : 'text-green-400' },
    { icon: child.isBetLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />, label: child.isBetLocked ? 'Unlock Bets' : 'Lock Bets', onClick: onToggleBetLock, color: 'text-yellow-400' },
    { icon: <Key className="h-3.5 w-3.5" />, label: 'Change Password', onClick: onPassword, color: 'text-orange-400' },
    { icon: <BarChart3 className="h-3.5 w-3.5" />, label: 'View Dashboard', onClick: onDashboard, color: 'text-cyan-400' },
    { icon: <History className="h-3.5 w-3.5" />, label: 'Coin History', onClick: onCoinHistory, color: 'text-indigo-400' },
    { icon: <Info className="h-3.5 w-3.5" />, label: 'Full Info', onClick: onInfo, color: 'text-gray-400' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-white transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-gray-700/50 bg-gray-800 shadow-2xl shadow-black/40 overflow-hidden">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => { action.onClick(); setOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700/50 hover:text-white transition-colors"
              >
                <span className={action.color}>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Skeleton Row ───────────────────────── */

function SkeletonRow() {
  return (
    <Tr>
      {[...Array(8)].map((_, i) => (
        <Td key={i}>
          <div className="h-4 rounded bg-gray-700 animate-pulse" style={{ width: `${50 + Math.random() * 50}%` }} />
        </Td>
      ))}
    </Tr>
  );
}

/* ───────────────────────── Sortable Header ───────────────────────── */

function SortableHeader({
  field,
  label,
  currentSort,
  currentDir,
  onSort,
}: {
  field: SortField;
  label: string;
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;
  return (
    <Th>
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:text-white transition-colors"
      >
        {label}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${
            isActive
              ? currentDir === 'desc' ? 'rotate-180 text-[var(--color-secondary)]' : 'text-[var(--color-secondary)]'
              : 'text-gray-600'
          }`}
        />
      </button>
    </Th>
  );
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function ChildrenPage() {
  const router = useRouter();
  useAuthStore();
  const { addToast } = useToastStore();

  const [children, setChildren] = useState<Child[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size] = useState(20);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Modal states
  const [showDW, setShowDW] = useState<Child | null>(null);
  const [showEdit, setShowEdit] = useState<Child | null>(null);
  const [showLimits, setShowLimits] = useState<Child | null>(null);
  const [showPassword, setShowPassword] = useState<Child | null>(null);
  const [showInfo, setShowInfo] = useState<Child | null>(null);
  const [showCoinHistory, setShowCoinHistory] = useState<Child | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedRow] = useState<string | null>(null);

  // Form states
  const [editForm, setEditForm] = useState({
    matchCommission: 0, sessionCommission: 0, casinoCommission: 0, matkaCommission: 0,
    myPartnership: 0, myCasinoPartnership: 0, myMatkaPartnership: 0,
  });
  const [limitsForm, setLimitsForm] = useState({ creditReference: 0, exposureLimit: 0 });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [infoData, setInfoData] = useState<any>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [coinHistory, setCoinHistory] = useState<CoinHistoryEntry[]>([]);
  const [coinHistoryTotal, setCoinHistoryTotal] = useState(0);
  const [coinHistoryPage, setCoinHistoryPage] = useState(1);
  const [coinHistoryLoading, setCoinHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchChildren = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/list-children', {
        params: { page, size, search: search || undefined },
      });
      setChildren(data.children || data.data || []);
      setTotal(data.total || data.totalCount || 0);
    } catch {
      addToast('Failed to load children', 'error');
    }
    setLoading(false);
  }, [page, size, search, addToast]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  // Stats
  const stats = useMemo(() => {
    const activeCount = children.filter((c) => c.isActive).length;
    const blockedCount = children.filter((c) => !c.isActive).length;
    const totalBalance = children.reduce((sum, c) => sum + (c.balance || 0), 0);
    const totalExposure = children.reduce((sum, c) => sum + (c.exposure || 0), 0);
    return { activeCount, blockedCount, totalBalance, totalExposure };
  }, [children]);

  // Client-side sort and role filter
  const displayedChildren = useMemo(() => {
    let filtered = [...children];
    if (roleFilter !== 'ALL') {
      filtered = filtered.filter((c) => c.role === roleFilter);
    }
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });
    return filtered;
  }, [children, roleFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // --- Edit ---
  const openEdit = (child: Child) => {
    setEditForm({
      matchCommission: child.matchCommission, sessionCommission: child.sessionCommission,
      casinoCommission: child.casinoCommission, matkaCommission: child.matkaCommission,
      myPartnership: child.myPartnership, myCasinoPartnership: child.myCasinoPartnership,
      myMatkaPartnership: child.myMatkaPartnership,
    });
    setShowEdit(child);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/children/${showEdit.id}/edit`, editForm);
      addToast('User updated successfully', 'success');
      setShowEdit(null);
      fetchChildren();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update user', 'error');
    }
    setSubmitting(false);
  };

  // --- Limits ---
  const openLimits = (child: Child) => {
    setLimitsForm({ creditReference: child.creditReference, exposureLimit: child.exposureLimit });
    setShowLimits(child);
  };

  const handleLimitsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showLimits) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/children/${showLimits.id}/limit`, limitsForm);
      addToast('Limits updated', 'success');
      setShowLimits(null);
      fetchChildren();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update limits', 'error');
    }
    setSubmitting(false);
  };

  // --- Status toggles ---
  const toggleStatus = async (child: Child, field: 'isActive' | 'isBetLocked') => {
    try {
      await api.put(`/admin/children/${child.id}/status`, { [field]: !child[field] });
      addToast(`${field === 'isActive' ? 'Active status' : 'Bet lock'} toggled`, 'success');
      fetchChildren();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  // --- Password ---
  const openPassword = (child: Child) => {
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowPassword(child);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPassword) return;
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/admin/children/${showPassword.id}/password`, { newPassword: passwordForm.newPassword });
      addToast('Password changed', 'success');
      setShowPassword(null);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to change password', 'error');
    }
    setSubmitting(false);
  };

  // --- Info ---
  const openInfo = async (child: Child) => {
    setInfoLoading(true);
    setShowInfo(child);
    try {
      const { data } = await api.get(`/admin/children/${child.id}/info`);
      setInfoData(data);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to load info', 'error');
    }
    setInfoLoading(false);
  };

  // --- Coin History ---
  const openCoinHistory = async (child: Child) => {
    setShowCoinHistory(child);
    setCoinHistoryPage(1);
    setCoinHistory([]);
    await fetchCoinHistory(child.id, 1);
  };

  const fetchCoinHistory = async (childId: string, pg: number) => {
    setCoinHistoryLoading(true);
    try {
      const { data } = await api.get(`/admin/children/${childId}/coin-history`, { params: { page: pg, size: 20 } });
      setCoinHistory(data.records || data.data || []);
      setCoinHistoryTotal(data.total || data.totalCount || 0);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to load coin history', 'error');
    }
    setCoinHistoryLoading(false);
  };

  const totalPages = Math.ceil(total / size);
  const roleFilterOptions: { key: RoleFilter; label: string }[] = [
    { key: 'ALL', label: 'All Roles' },
    { key: 'ADMIN', label: 'Admin' },
    { key: 'AGENT', label: 'Agent' },
    { key: 'CLIENT', label: 'Client' },
  ];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return <Badge variant="danger">SUPER ADMIN</Badge>;
      case 'ADMIN': return <Badge variant="info">ADMIN</Badge>;
      case 'AGENT': return <Badge variant="warning">AGENT</Badge>;
      case 'CLIENT': return <Badge variant="success">CLIENT</Badge>;
      default: return <Badge>{role}</Badge>;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-xs text-gray-500">{total} users total</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="!rounded-xl">
          <UserPlus className="mr-2 h-4 w-4" /> Create User
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard
          icon={<Users className="h-4 w-4 text-blue-400" />}
          label="Total Children"
          value={total}
          color="#3b82f6"
        />
        <StatCard
          icon={<UserCheck className="h-4 w-4 text-green-400" />}
          label="Active"
          value={stats.activeCount}
          color="#22c55e"
        />
        <StatCard
          icon={<UserX className="h-4 w-4 text-red-400" />}
          label="Blocked"
          value={stats.blockedCount}
          color="#ef4444"
        />
        <StatCard
          icon={<Wallet className="h-4 w-4 text-[var(--color-secondary)]" />}
          label="Total Balance Given"
          value={formatCurrency(stats.totalBalance)}
          color="#f59e0b"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-orange-400" />}
          label="Total Exposure"
          value={formatCurrency(stats.totalExposure)}
          color="#f97316"
        />
      </div>

      {/* Search + Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            className="pl-9 !rounded-xl !border-gray-700/50 !bg-gray-800/50"
            placeholder="Search by username or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {roleFilterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRoleFilter(opt.key)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                roleFilter === opt.key
                  ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white border border-gray-700/30'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-700/30 bg-gradient-to-br from-gray-800/30 to-gray-900/30 backdrop-blur-xl">
        <Table>
          <Thead>
            <Tr className="!hover:bg-transparent">
              <SortableHeader field="username" label="Username" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader field="name" label="Name" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader field="role" label="Role" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader field="balance" label="Balance" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader field="exposure" label="Exposure" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader field="creditReference" label="Credit Ref" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
              <Th>Status</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : displayedChildren.length === 0 ? (
              <Tr>
                <Td colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-gray-600" />
                    <p className="text-gray-500 font-medium">No users found</p>
                    <p className="text-xs text-gray-600">
                      {search ? 'Try a different search term' : 'Create your first user to get started'}
                    </p>
                  </div>
                </Td>
              </Tr>
            ) : (
              displayedChildren.map((child) => (
                <Tr
                  key={child.id}
                  className={`transition-colors ${expandedRow === child.id ? 'bg-gray-800/30' : ''}`}
                >
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-primary)]/30 to-[var(--color-secondary)]/10 text-[10px] font-bold text-[var(--color-secondary)]">
                        {child.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-white">{child.username}</span>
                    </div>
                  </Td>
                  <Td className="text-gray-300">{child.name}</Td>
                  <Td>{getRoleBadge(child.role)}</Td>
                  <Td>
                    <span className="font-medium text-green-400">{formatCurrency(child.balance)}</span>
                  </Td>
                  <Td>
                    <span className={`font-medium ${child.exposure > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                      {formatCurrency(child.exposure)}
                    </span>
                  </Td>
                  <Td className="text-gray-300">{formatCurrency(child.creditReference)}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${child.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="text-xs text-gray-400">{child.isActive ? 'Active' : 'Locked'}</span>
                      {child.isBetLocked && (
                        <Badge variant="warning" className="!px-1.5 !py-0 !text-[9px]">BET LOCK</Badge>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      {/* Quick D/W button */}
                      <button
                        onClick={() => setShowDW(child)}
                        className="flex h-8 items-center gap-1 rounded-lg bg-green-900/30 px-2.5 text-xs font-medium text-green-400 hover:bg-green-900/50 transition-colors border border-green-900/30"
                        title="Deposit / Withdraw"
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        <span className="hidden lg:inline">D/W</span>
                      </button>
                      <ActionDropdown
                        child={child}
                        onDeposit={() => setShowDW(child)}
                        onEdit={() => openEdit(child)}
                        onLimits={() => openLimits(child)}
                        onToggleActive={() => toggleStatus(child, 'isActive')}
                        onToggleBetLock={() => toggleStatus(child, 'isBetLocked')}
                        onPassword={() => openPassword(child)}
                        onInfo={() => openInfo(child)}
                        onCoinHistory={() => openCoinHistory(child)}
                        onDashboard={() => router.push(`/children/${child.id}/dashboard`)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * size + 1} - {Math.min(page * size, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700/40 bg-gray-800/50 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = page <= 3 ? i + 1 : page + i - 2;
              if (pageNum < 1 || pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    pageNum === page
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'border border-gray-700/40 bg-gray-800/50 text-gray-400 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700/40 bg-gray-800/50 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Deposit / Withdraw Modal ─── */}
      {showDW && (
        <DepositWithdrawModal
          child={showDW}
          onClose={() => setShowDW(null)}
          onSuccess={() => { setShowDW(null); fetchChildren(); }}
        />
      )}

      {/* ─── Create User Modal ─── */}
      {showCreate && (
        <UserCreateModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); fetchChildren(); }}
        />
      )}

      {/* ─── Edit Commissions Modal ─── */}
      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title={`Edit - ${showEdit?.username}`}>
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <p className="text-xs text-gray-500 mb-2">Commission Percentages</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Match Commission %', key: 'matchCommission' },
              { label: 'Session Commission %', key: 'sessionCommission' },
              { label: 'Casino Commission %', key: 'casinoCommission' },
              { label: 'Matka Commission %', key: 'matkaCommission' },
            ].map((f) => (
              <Input
                key={f.key}
                label={f.label}
                type="number"
                step="0.01"
                value={(editForm as any)[f.key].toString()}
                onChange={(e) => setEditForm({ ...editForm, [f.key]: parseFloat(e.target.value) || 0 })}
              />
            ))}
          </div>
          <div className="border-t border-gray-700/40 pt-4">
            <p className="text-xs text-gray-500 mb-3">Partnership Percentages</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'My Partnership %', key: 'myPartnership' },
                { label: 'Casino Partnership %', key: 'myCasinoPartnership' },
                { label: 'Matka Partnership %', key: 'myMatkaPartnership' },
              ].map((f) => (
                <Input
                  key={f.key}
                  label={f.label}
                  type="number"
                  step="0.01"
                  value={(editForm as any)[f.key].toString()}
                  onChange={(e) => setEditForm({ ...editForm, [f.key]: parseFloat(e.target.value) || 0 })}
                />
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Modal>

      {/* ─── Limits Modal ─── */}
      <Modal isOpen={!!showLimits} onClose={() => setShowLimits(null)} title={`Limits - ${showLimits?.username}`}>
        <form onSubmit={handleLimitsSubmit} className="space-y-4">
          <Input
            label="Credit Reference"
            type="number"
            step="0.01"
            value={limitsForm.creditReference.toString()}
            onChange={(e) => setLimitsForm({ ...limitsForm, creditReference: parseFloat(e.target.value) || 0 })}
          />
          <Input
            label="Exposure Limit"
            type="number"
            step="0.01"
            value={limitsForm.exposureLimit.toString()}
            onChange={(e) => setLimitsForm({ ...limitsForm, exposureLimit: parseFloat(e.target.value) || 0 })}
          />
          <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
            {submitting ? 'Saving...' : 'Update Limits'}
          </Button>
        </form>
      </Modal>

      {/* ─── Password Modal ─── */}
      <Modal isOpen={!!showPassword} onClose={() => setShowPassword(null)} title={`Change Password - ${showPassword?.username}`}>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <Input
            label="New Password"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            required
          />
          <Input
            label="Confirm Password"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            required
          />
          <Button type="submit" className="w-full !rounded-xl" disabled={submitting}>
            {submitting ? 'Changing...' : 'Change Password'}
          </Button>
        </form>
      </Modal>

      {/* ─── Info Modal ─── */}
      <Modal
        isOpen={!!showInfo}
        onClose={() => { setShowInfo(null); setInfoData(null); }}
        title={`User Info - ${showInfo?.username}`}
        className="max-w-2xl"
      >
        {infoLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
          </div>
        ) : infoData ? (
          <div className="space-y-4">
            {/* Profile header */}
            <div className="flex items-center gap-4 rounded-xl bg-gray-800/40 p-4 border border-gray-700/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-lg font-bold text-white">
                {infoData.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{infoData.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  {getRoleBadge(infoData.role)}
                  <span className="text-xs text-gray-500">@{infoData.username}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Balance', value: formatCurrency(infoData.balance || 0), color: 'text-green-400' },
                { label: 'Exposure', value: formatCurrency(infoData.exposure || 0), color: 'text-red-400' },
                { label: 'Credit Reference', value: formatCurrency(infoData.creditReference || 0), color: 'text-white' },
                { label: 'Exposure Limit', value: formatCurrency(infoData.exposureLimit || 0), color: 'text-white' },
                { label: 'Mobile', value: infoData.mobile || 'N/A', color: 'text-white' },
                { label: 'Active', value: infoData.isActive ? 'Yes' : 'No', color: infoData.isActive ? 'text-green-400' : 'text-red-400' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-gray-800/30 px-3 py-2 border border-gray-700/20">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <p className={`text-sm font-medium ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-700/30 pt-3">
              <p className="text-xs font-semibold text-gray-400 mb-2">Commissions</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Match', value: `${infoData.matchCommission}%` },
                  { label: 'Session', value: `${infoData.sessionCommission}%` },
                  { label: 'Casino', value: `${infoData.casinoCommission}%` },
                  { label: 'Matka', value: `${infoData.matkaCommission}%` },
                ].map((c) => (
                  <div key={c.label} className="text-center rounded-lg bg-gray-800/30 py-2 border border-gray-700/20">
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className="text-sm font-bold text-white">{c.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-700/30 pt-3">
              <p className="text-xs font-semibold text-gray-400 mb-2">Partnerships</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Sports', value: `${infoData.myPartnership}%` },
                  { label: 'Casino', value: `${infoData.myCasinoPartnership}%` },
                  { label: 'Matka', value: `${infoData.myMatkaPartnership}%` },
                ].map((p) => (
                  <div key={p.label} className="text-center rounded-lg bg-gray-800/30 py-2 border border-gray-700/20">
                    <p className="text-xs text-gray-500">{p.label}</p>
                    <p className="text-sm font-bold text-[var(--color-secondary)]">{p.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-6">No data available</p>
        )}
      </Modal>

      {/* ─── Coin History Modal ─── */}
      <Modal
        isOpen={!!showCoinHistory}
        onClose={() => { setShowCoinHistory(null); setCoinHistory([]); }}
        title={`Coin History - ${showCoinHistory?.username}`}
        className="max-w-3xl"
      >
        {coinHistoryLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
          </div>
        ) : coinHistory.length === 0 ? (
          <div className="text-center py-8">
            <History className="mx-auto mb-3 h-8 w-8 text-gray-600" />
            <p className="text-gray-500">No transactions found</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {coinHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl bg-gray-800/30 px-4 py-3 border border-gray-700/20"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      entry.type === 'DEPOSIT' ? 'bg-green-900/30' : 'bg-red-900/30'
                    }`}>
                      {entry.type === 'DEPOSIT' ? (
                        <ArrowDownCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.type === 'DEPOSIT' ? 'success' : entry.type === 'WITHDRAW' ? 'danger' : 'default'}>
                          {entry.type}
                        </Badge>
                        <span className={`text-sm font-bold ${entry.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(entry.amount)}
                        </span>
                      </div>
                      {entry.remark && (
                        <p className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">{entry.remark}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-300">{formatCurrency(entry.balance)}</p>
                    <p className="text-[10px] text-gray-500">{formatDate(entry.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
            {coinHistoryTotal > 20 && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={coinHistoryPage === 1}
                  onClick={() => {
                    const newP = coinHistoryPage - 1;
                    setCoinHistoryPage(newP);
                    if (showCoinHistory) fetchCoinHistory(showCoinHistory.id, newP);
                  }}
                  className="!rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-gray-400">
                  {coinHistoryPage} / {Math.ceil(coinHistoryTotal / 20)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={coinHistoryPage * 20 >= coinHistoryTotal}
                  onClick={() => {
                    const newP = coinHistoryPage + 1;
                    setCoinHistoryPage(newP);
                    if (showCoinHistory) fetchCoinHistory(showCoinHistory.id, newP);
                  }}
                  className="!rounded-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ─── Mobile FAB ─── */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-2xl shadow-[var(--color-primary)]/30 sm:hidden hover:scale-105 transition-transform"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Deposit / Withdraw Modal
   ═══════════════════════════════════════════════════════════ */

function DepositWithdrawModal({
  child,
  onClose,
  onSuccess,
}: {
  child: Child;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [mode, setMode] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [transactionPassword, setTransactionPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const quickAmounts = [500, 1000, 5000, 10000, 25000, 50000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      addToast('Enter a valid amount', 'error');
      return;
    }
    if (mode === 'WITHDRAW' && numAmount > child.balance) {
      addToast('Cannot withdraw more than child balance', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/admin/children/${child.id}/deposit-withdraw`, {
        type: mode,
        amount: numAmount,
        remark,
        transactionPassword,
      });
      addToast(`${mode === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} successful`, 'success');
      onSuccess();
    } catch (err: any) {
      addToast(err.response?.data?.error || `${mode} failed`, 'error');
    }
    setSubmitting(false);
  };

  return (
    <Modal isOpen onClose={onClose} title={`D/W - ${child.username}`}>
      {/* Mode Toggle */}
      <div className="flex rounded-xl bg-gray-800/50 p-1 mb-5 border border-gray-700/30">
        <button
          onClick={() => setMode('DEPOSIT')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
            mode === 'DEPOSIT'
              ? 'bg-green-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ArrowDownCircle className="h-4 w-4" /> Deposit
        </button>
        <button
          onClick={() => setMode('WITHDRAW')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
            mode === 'WITHDRAW'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ArrowUpCircle className="h-4 w-4" /> Withdraw
        </button>
      </div>

      {/* Balance display */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 rounded-xl bg-gray-800/40 px-4 py-3 border border-gray-700/20 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Your Balance</p>
          <p className="text-sm font-bold text-[var(--color-secondary)]">{formatCurrency(user?.balance || 0)}</p>
        </div>
        <div className="flex-1 rounded-xl bg-gray-800/40 px-4 py-3 border border-gray-700/20 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Child Balance</p>
          <p className="text-sm font-bold text-green-400">{formatCurrency(child.balance)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          required
        />

        {/* Quick amounts */}
        <div className="flex flex-wrap gap-2">
          {quickAmounts.map((qa) => (
            <button
              key={qa}
              type="button"
              onClick={() => setAmount(qa.toString())}
              className="rounded-lg bg-gray-700/50 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-600/50 hover:text-white transition-colors border border-gray-600/30"
            >
              {qa >= 1000 ? `${qa / 1000}K` : qa}
            </button>
          ))}
        </div>

        <Input
          label="Remark (optional)"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Add a note..."
        />

        <Input
          label="Transaction Password"
          type="password"
          value={transactionPassword}
          onChange={(e) => setTransactionPassword(e.target.value)}
          placeholder="Enter transaction password"
          required
        />

        <Button
          type="submit"
          variant={mode === 'DEPOSIT' ? 'primary' : 'danger'}
          className="w-full !rounded-xl !py-3"
          disabled={submitting}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processing...
            </span>
          ) : (
            `${mode === 'DEPOSIT' ? 'Deposit' : 'Withdraw'} ${amount ? formatCurrency(parseFloat(amount) || 0) : ''}`
          )}
        </Button>
      </form>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   User Create Modal
   ═══════════════════════════════════════════════════════════ */

function UserCreateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    mobile: '',
    role: user?.role === 'SUPER_ADMIN' ? 'ADMIN' : user?.role === 'ADMIN' ? 'AGENT' : 'CLIENT',
    creditReference: 0,
    exposureLimit: 0,
    matchCommission: 0,
    sessionCommission: 0,
    casinoCommission: 0,
    matkaCommission: 0,
    myPartnership: 0,
    myCasinoPartnership: 0,
    myMatkaPartnership: 0,
    transactionPassword: '',
  });

  const availableRoles = (() => {
    if (user?.role === 'SUPER_ADMIN') return ['ADMIN', 'AGENT', 'CLIENT'];
    if (user?.role === 'ADMIN') return ['AGENT', 'CLIENT'];
    return ['CLIENT'];
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.name) {
      addToast('Username, password, and name are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/create-user', form);
      addToast('User created successfully!', 'success');
      onSuccess();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to create user', 'error');
    }
    setSubmitting(false);
  };

  return (
    <Modal isOpen onClose={onClose} title="Create New User" className="max-w-2xl">
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className="flex items-center gap-2 flex-1"
          >
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              step >= s ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-700 text-gray-500'
            }`}>
              {s}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${step >= s ? 'text-white' : 'text-gray-500'}`}>
              {s === 1 ? 'Basic Info' : s === 2 ? 'Limits' : 'Commissions'}
            </span>
            {s < 3 && <div className={`h-px flex-1 ${step > s ? 'bg-[var(--color-primary)]' : 'bg-gray-700'}`} />}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                placeholder="e.g. john_doe"
                required
              />
              <Input
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <Input
                label="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="Mobile"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Role</label>
              <div className="flex gap-2">
                {availableRoles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, role: r })}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition-all border ${
                      form.role === r
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-lg'
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Button type="button" onClick={() => setStep(2)} className="w-full !rounded-xl">
              Next: Set Limits
            </Button>
          </div>
        )}

        {/* Step 2: Limits */}
        {step === 2 && (
          <div className="space-y-4">
            <Input
              label="Credit Reference"
              type="number"
              step="0.01"
              value={form.creditReference.toString()}
              onChange={(e) => setForm({ ...form, creditReference: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Exposure Limit"
              type="number"
              step="0.01"
              value={form.exposureLimit.toString()}
              onChange={(e) => setForm({ ...form, exposureLimit: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Transaction Password"
              type="password"
              value={form.transactionPassword}
              onChange={(e) => setForm({ ...form, transactionPassword: e.target.value })}
              placeholder="Your transaction password"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 !rounded-xl">
                Back
              </Button>
              <Button type="button" onClick={() => setStep(3)} className="flex-1 !rounded-xl">
                Next: Commissions
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Commissions */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Commission Percentages</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Match %" type="number" step="0.01" value={form.matchCommission.toString()} onChange={(e) => setForm({ ...form, matchCommission: parseFloat(e.target.value) || 0 })} />
              <Input label="Session %" type="number" step="0.01" value={form.sessionCommission.toString()} onChange={(e) => setForm({ ...form, sessionCommission: parseFloat(e.target.value) || 0 })} />
              <Input label="Casino %" type="number" step="0.01" value={form.casinoCommission.toString()} onChange={(e) => setForm({ ...form, casinoCommission: parseFloat(e.target.value) || 0 })} />
              <Input label="Matka %" type="number" step="0.01" value={form.matkaCommission.toString()} onChange={(e) => setForm({ ...form, matkaCommission: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="border-t border-gray-700/30 pt-3">
              <p className="text-xs text-gray-500 mb-3">Partnership Percentages</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Partnership %" type="number" step="0.01" value={form.myPartnership.toString()} onChange={(e) => setForm({ ...form, myPartnership: parseFloat(e.target.value) || 0 })} />
                <Input label="Casino %" type="number" step="0.01" value={form.myCasinoPartnership.toString()} onChange={(e) => setForm({ ...form, myCasinoPartnership: parseFloat(e.target.value) || 0 })} />
                <Input label="Matka %" type="number" step="0.01" value={form.myMatkaPartnership.toString()} onChange={(e) => setForm({ ...form, myMatkaPartnership: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 !rounded-xl">
                Back
              </Button>
              <Button type="submit" className="flex-1 !rounded-xl" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
