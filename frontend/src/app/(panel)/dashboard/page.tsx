'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore, Role, User } from '@/store/auth';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useToastStore } from '@/components/ui/toast';
import {
  Wallet,
  Shield,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  UserPlus,
  Lock,
  BarChart3,
  ChevronRight,
  Clock,
  Trophy,
  Zap,
  CircleDollarSign,
  RefreshCw,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface MatchRunner {
  selectionId?: string;
  runnerName: string;
  back?: number[];
  lay?: number[];
}

interface MatchOddsData {
  team1Back: number;
  team1Lay: number;
  drawBack: number;
  drawLay: number;
  team2Back: number;
  team2Lay: number;
}

interface MatchData {
  id?: string;
  cricketId?: number;
  eventId?: string;
  eventName?: string;
  team1: string;
  team2: string;
  competition?: string;
  competitionName?: string;
  matchType?: string;
  startTime?: string;
  openDate?: string;
  eventTime?: string;
  inPlay?: boolean;
  isActive?: boolean;
  runners?: MatchRunner[];
  matchOdds?: MatchOddsData;
  marketId?: string;
}

interface CoinHistoryItem {
  id: string;
  type: string;
  amount: number;
  description?: string;
  remark?: string;
  createdAt: string;
  balanceAfter?: number;
}

interface AdminReport {
  totalUsers?: number;
  totalAdmins?: number;
  totalAgents?: number;
  totalClients?: number;
  todayVolume?: number;
  todayCommission?: number;
  todayPnl?: number;
  totalBets?: number;
  liveEvents?: number;
  activeEvents?: number;
}

interface UnsettledBetsResponse {
  bets?: unknown[];
  fancy?: unknown[];
  betsTotal?: number;
  fancyTotal?: number;
  total?: number;
}

// ============================================================
// Helpers
// ============================================================

function formatIndianNumber(num: number): string {
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const parts = abs.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian numbering: last 3 digits, then groups of 2
  if (integerPart.length > 3) {
    const last3 = integerPart.slice(-3);
    const rest = integerPart.slice(0, -3);
    const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    integerPart = grouped + ',' + last3;
  }

  return (isNegative ? '-' : '') + '\u20B9' + integerPart + '.' + decimalPart;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

function getMatchTime(match: MatchData): string {
  const t = match.eventTime || match.startTime || match.openDate;
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  if (isToday) return 'Today, ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (isTomorrow) return 'Tomorrow, ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// Animated Number Component
// ============================================================

function AnimatedNumber({
  value,
  formatter,
  className = '',
}: {
  value: number;
  formatter?: (n: number) => string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const prevVal = prevValueRef.current;
    const newVal = value;
    prevValueRef.current = newVal;

    if (prevVal === newVal) return;

    const duration = 600;
    const startTime = performance.now();
    const diff = newVal - prevVal;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(prevVal + diff * eased);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [value]);

  const formatted = formatter ? formatter(displayValue) : displayValue.toFixed(2);

  return <span className={className}>{formatted}</span>;
}

// ============================================================
// Skeleton Components
// ============================================================

function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-24 rounded bg-white/10" />
        <div className="h-8 w-32 rounded bg-white/10" />
        <div className="h-3 w-20 rounded bg-white/5" />
      </div>
      <div className="absolute right-4 top-4 h-10 w-10 rounded-xl bg-white/5 animate-pulse" />
    </div>
  );
}

function SkeletonMatchCard() {
  return (
    <div className="min-w-[300px] rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
      <div className="h-4 w-20 rounded bg-white/10 mb-3" />
      <div className="h-5 w-40 rounded bg-white/10 mb-4" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-8 rounded bg-white/5" />
        <div className="h-8 rounded bg-white/5" />
        <div className="h-8 rounded bg-white/5" />
        <div className="h-8 rounded bg-white/5" />
      </div>
    </div>
  );
}

function SkeletonActivityItem() {
  return (
    <div className="flex items-center gap-3 py-3 animate-pulse">
      <div className="h-9 w-9 rounded-full bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 rounded bg-white/10" />
        <div className="h-3 w-24 rounded bg-white/5" />
      </div>
      <div className="h-5 w-20 rounded bg-white/10" />
    </div>
  );
}

// ============================================================
// Glass Card Wrapper
// ============================================================

function GlassCard({
  children,
  className = '',
  gradient = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  gradient?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl
        border border-white/[0.08]
        bg-gradient-to-br from-white/[0.06] to-white/[0.02]
        backdrop-blur-xl
        shadow-[0_8px_32px_rgba(0,0,0,0.3)]
        transition-all duration-300
        ${onClick ? 'cursor-pointer hover:border-white/[0.15] hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)] hover:scale-[1.01]' : ''}
        ${className}
      `}
    >
      {gradient && (
        <div className={`absolute inset-0 opacity-10 ${gradient}`} />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ============================================================
// Quick Stats Cards
// ============================================================

function QuickStatsRow({
  user,
  activeBetsCount,
  todayPnl,
  loading,
}: {
  user: User | null;
  activeBetsCount: number;
  todayPnl: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const balance = user?.balance ?? 0;
  const exposure = user?.exposure ?? 0;
  const highExposure = exposure > balance * 0.7;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Balance Card */}
      <GlassCard gradient="bg-gradient-to-br from-emerald-600 to-emerald-900">
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-400">Balance</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
              <Wallet className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <AnimatedNumber
            value={balance}
            formatter={formatIndianNumber}
            className="text-lg md:text-2xl lg:text-3xl font-bold text-white tracking-tight break-all"
          />
          <div className="mt-2 flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${balance > 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-500">Available funds</span>
          </div>
        </div>
      </GlassCard>

      {/* Exposure Card */}
      <GlassCard gradient={highExposure ? 'bg-gradient-to-br from-red-600 to-red-900' : 'bg-gradient-to-br from-amber-600 to-amber-900'}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-400">Exposure</span>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${highExposure ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
              <Shield className={`h-5 w-5 ${highExposure ? 'text-red-400' : 'text-amber-400'}`} />
            </div>
          </div>
          <AnimatedNumber
            value={exposure}
            formatter={formatIndianNumber}
            className={`text-lg md:text-2xl lg:text-3xl font-bold tracking-tight break-all ${highExposure ? 'text-red-400' : 'text-white'}`}
          />
          <div className="mt-2 flex items-center gap-1.5">
            {highExposure && <span className="text-xs text-red-400 font-medium">High exposure!</span>}
            {!highExposure && <span className="text-xs text-gray-500">Current risk</span>}
          </div>
        </div>
      </GlassCard>

      {/* Today's P&L */}
      <GlassCard gradient={todayPnl >= 0 ? 'bg-gradient-to-br from-emerald-600 to-teal-900' : 'bg-gradient-to-br from-red-600 to-rose-900'}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-400">Today&apos;s P&amp;L</span>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${todayPnl >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              {todayPnl >= 0 ? (
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-400" />
              )}
            </div>
          </div>
          <AnimatedNumber
            value={todayPnl}
            formatter={(n) => (n >= 0 ? '+' : '') + formatIndianNumber(n)}
            className={`text-lg md:text-2xl lg:text-3xl font-bold tracking-tight break-all ${todayPnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}
          />
          <div className="mt-2 flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${todayPnl >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-500">Since 12:00 AM</span>
          </div>
        </div>
      </GlassCard>

      {/* Active Bets */}
      <GlassCard gradient="bg-gradient-to-br from-blue-600 to-indigo-900">
        <Link href="/bets">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-400">Active Bets</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                <Activity className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <AnimatedNumber
              value={activeBetsCount}
              formatter={(n) => Math.round(n).toString()}
              className="text-lg md:text-2xl lg:text-3xl font-bold text-white tracking-tight"
            />
            <div className="mt-2 flex items-center gap-1.5 text-blue-400">
              <span className="text-xs font-medium">View all bets</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </Link>
      </GlassCard>
    </div>
  );
}

// ============================================================
// Live Matches Section
// ============================================================

function LiveMatchesSection({
  matches,
  loading,
}: {
  matches: MatchData[];
  loading: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveMatches = useMemo(
    () => matches.filter((m) => m.inPlay),
    [matches]
  );
  const upcomingCount = matches.length - liveMatches.length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-32 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          <SkeletonMatchCard />
          <SkeletonMatchCard />
          <SkeletonMatchCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">Live Matches</h2>
          {liveMatches.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-sm text-red-400 font-medium">{liveMatches.length} Live</span>
            </div>
          )}
        </div>
        <Link href="/matches" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1">
          All matches <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Scrollable Cards */}
      {liveMatches.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800">
              <Trophy className="h-7 w-7 text-gray-500" />
            </div>
            <p className="text-gray-400 font-medium">No live matches right now</p>
            {upcomingCount > 0 && (
              <p className="text-sm text-gray-500">
                {upcomingCount} upcoming match{upcomingCount !== 1 ? 'es' : ''} scheduled
              </p>
            )}
          </div>
        </GlassCard>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
          style={{ scrollbarWidth: 'thin' }}
        >
          {liveMatches.map((match) => (
            <LiveMatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}

function LiveMatchCard({ match }: { match: MatchData }) {
  const odds = match.matchOdds;
  const fmtOdds = (v?: number) => (!v || v <= 0) ? '-' : v.toFixed(2);

  return (
    <Link href={`/matches/${match.cricketId || match.id}`}>
      <GlassCard className="min-w-[320px] max-w-[360px] flex-shrink-0" onClick={() => {}}>
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 truncate max-w-[180px]">
              {match.competition || match.competitionName || 'Cricket'}
            </span>
            <Badge variant="success" className="flex-shrink-0">
              <span className="relative flex h-1.5 w-1.5 mr-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
              </span>
              LIVE
            </Badge>
          </div>

          {/* Team Names */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-white truncate">
              {match.team1} vs {match.team2}
            </p>
          </div>

          {/* Odds Grid */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_60px_60px] gap-1.5 text-[10px] font-medium text-gray-500 px-1">
              <span />
              <span className="text-center">BACK</span>
              <span className="text-center">LAY</span>
            </div>

            {/* Team 1 */}
            <div className="grid grid-cols-[1fr_60px_60px] gap-1.5 items-center">
              <span className="text-xs font-medium text-gray-300 truncate pl-1">
                {match.team1}
              </span>
              <div className="flex items-center justify-center h-8 rounded-md bg-blue-500/20 border border-blue-500/30">
                <span className="text-xs font-bold text-blue-400">
                  {fmtOdds(odds?.team1Back)}
                </span>
              </div>
              <div className="flex items-center justify-center h-8 rounded-md bg-rose-500/20 border border-rose-500/30">
                <span className="text-xs font-bold text-rose-400">
                  {fmtOdds(odds?.team1Lay)}
                </span>
              </div>
            </div>

            {/* Team 2 */}
            <div className="grid grid-cols-[1fr_60px_60px] gap-1.5 items-center">
              <span className="text-xs font-medium text-gray-300 truncate pl-1">
                {match.team2}
              </span>
              <div className="flex items-center justify-center h-8 rounded-md bg-blue-500/20 border border-blue-500/30">
                <span className="text-xs font-bold text-blue-400">
                  {fmtOdds(odds?.team2Back)}
                </span>
              </div>
              <div className="flex items-center justify-center h-8 rounded-md bg-rose-500/20 border border-rose-500/30">
                <span className="text-xs font-bold text-rose-400">
                  {fmtOdds(odds?.team2Lay)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

// ============================================================
// Recent Activity Feed
// ============================================================

function RecentActivityFeed({
  transactions,
  loading,
}: {
  transactions: CoinHistoryItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <GlassCard>
        <div className="p-5">
          <div className="h-6 w-36 rounded bg-white/10 animate-pulse mb-4" />
          <div className="space-y-1 divide-y divide-white/5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonActivityItem key={i} />
            ))}
          </div>
        </div>
      </GlassCard>
    );
  }

  const getActivityStyle = (type: string) => {
    const t = type?.toUpperCase() || '';
    if (t.includes('BET') && (t.includes('WIN') || t.includes('WON'))) return { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/15' };
    if (t.includes('BET') && (t.includes('LOSE') || t.includes('LOST'))) return { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/15' };
    if (t.includes('BET') || t.includes('PLACE')) return { icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/15' };
    if (t.includes('DEPOSIT') || t.includes('CREDIT')) return { icon: ArrowDownLeft, color: 'text-purple-400', bg: 'bg-purple-500/15' };
    if (t.includes('WITHDRAW') || t.includes('DEBIT')) return { icon: ArrowUpRight, color: 'text-orange-400', bg: 'bg-orange-500/15' };
    if (t.includes('COMMISSION')) return { icon: CircleDollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/15' };
    return { icon: Zap, color: 'text-gray-400', bg: 'bg-gray-500/15' };
  };

  return (
    <GlassCard>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Recent Activity</h3>
          <Link href="/account-statement" className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="py-8 text-center">
            <Clock className="h-8 w-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-white/5">
            {transactions.slice(0, 10).map((tx) => {
              const style = getActivityStyle(tx.type);
              const IconComp = style.icon;
              const isPositive = tx.amount > 0;

              return (
                <div key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${style.bg}`}>
                    <IconComp className={`h-4 w-4 ${style.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {tx.description || tx.remark || tx.type?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-500">{timeAgo(tx.createdAt)}</p>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${isPositive ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                    {isPositive ? '+' : ''}{formatIndianNumber(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ============================================================
// Quick Actions Bar (Admin/Agent/Super Admin)
// ============================================================

function QuickActionsBar({ role }: { role: Role }) {
  const actions = useMemo(() => {
    const items = [
      { label: 'Create User', icon: UserPlus, href: '/users', color: 'from-blue-500 to-blue-700' },
      { label: 'Deposit/Withdraw', icon: Wallet, href: '/users', color: 'from-emerald-500 to-emerald-700' },
      { label: 'Lock All Bets', icon: Lock, href: '/settings', color: 'from-red-500 to-red-700' },
      { label: 'View Reports', icon: BarChart3, href: '/reports', color: 'from-purple-500 to-purple-700' },
    ];
    if (role === 'AGENT') {
      return items.filter((a) => a.label !== 'Lock All Bets');
    }
    return items;
  }, [role]);

  return (
    <GlassCard>
      <div className="p-5">
        <h3 className="text-base font-bold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {actions.map((action) => {
            const IconComp = action.icon;
            return (
              <Link key={action.label} href={action.href}>
                <div className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.06]">
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                  <div className="relative z-10 flex flex-col items-center gap-2 text-center">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} shadow-lg`}>
                      <IconComp className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">
                      {action.label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================================
// Cricket Matches Grid
// ============================================================

function CricketMatchesGrid({
  matches,
  loading,
}: {
  matches: MatchData[];
  loading: boolean;
}) {
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      // Live first
      if (a.inPlay && !b.inPlay) return -1;
      if (!a.inPlay && b.inPlay) return 1;
      // Then by start time
      const tA = new Date(a.startTime || a.openDate || 0).getTime();
      const tB = new Date(b.startTime || b.openDate || 0).getTime();
      return tA - tB;
    });
  }, [matches]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 rounded bg-white/10 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonMatchCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (sortedMatches.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Cricket Matches</h2>
        <span className="text-sm text-gray-500">{sortedMatches.length} active</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedMatches.map((match) => (
          <CricketMatchCard key={match.cricketId || match.id} match={match} />
        ))}
      </div>
    </div>
  );
}

function CricketMatchCard({ match }: { match: MatchData }) {
  const odds = match.matchOdds;
  const fmtOdds = (v?: number) => (!v || v <= 0) ? '-' : v.toFixed(2);

  return (
    <Link href={`/matches/${match.cricketId || match.id}`}>
      <GlassCard className="h-full" onClick={() => {}}>
        <div className="p-4">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 truncate max-w-[160px]">
              {match.competition || match.competitionName || 'Cricket'}
            </span>
            {match.inPlay ? (
              <Badge variant="success" className="flex-shrink-0">
                <span className="relative flex h-1.5 w-1.5 mr-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                </span>
                LIVE
              </Badge>
            ) : (
              <div className="flex items-center gap-1 text-gray-500 flex-shrink-0">
                <Clock className="h-3 w-3" />
                <span className="text-[10px]">{getMatchTime(match)}</span>
              </div>
            )}
          </div>

          {/* Match Title */}
          <p className="text-sm font-semibold text-white mb-4 leading-snug">
            {match.team1} <span className="text-gray-500 font-normal">vs</span> {match.team2}
          </p>

          {/* Odds */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_52px_52px] gap-1 text-[10px] font-medium text-gray-500 px-0.5">
              <span />
              <span className="text-center">BACK</span>
              <span className="text-center">LAY</span>
            </div>

            {/* Team 1 */}
            <div className="grid grid-cols-[1fr_52px_52px] gap-1 items-center">
              <span className="text-xs text-gray-400 truncate">{match.team1}</span>
              <div className="flex items-center justify-center h-7 rounded bg-blue-500/15 border border-blue-500/20">
                <span className="text-[11px] font-bold text-blue-400">
                  {fmtOdds(odds?.team1Back)}
                </span>
              </div>
              <div className="flex items-center justify-center h-7 rounded bg-rose-500/15 border border-rose-500/20">
                <span className="text-[11px] font-bold text-rose-400">
                  {fmtOdds(odds?.team1Lay)}
                </span>
              </div>
            </div>

            {/* Team 2 */}
            <div className="grid grid-cols-[1fr_52px_52px] gap-1 items-center">
              <span className="text-xs text-gray-400 truncate">{match.team2}</span>
              <div className="flex items-center justify-center h-7 rounded bg-blue-500/15 border border-blue-500/20">
                <span className="text-[11px] font-bold text-blue-400">
                  {fmtOdds(odds?.team2Back)}
                </span>
              </div>
              <div className="flex items-center justify-center h-7 rounded bg-rose-500/15 border border-rose-500/20">
                <span className="text-[11px] font-bold text-rose-400">
                  {fmtOdds(odds?.team2Lay)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

// ============================================================
// Admin Stats Row
// ============================================================

function AdminStatsRow({
  report,
  loading,
}: {
  report: AdminReport;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Users',
      value: report.totalUsers ?? (report.totalAdmins ?? 0) + (report.totalAgents ?? 0) + (report.totalClients ?? 0),
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/15',
      gradient: 'from-blue-600 to-blue-900',
      formatter: (n: number) => Math.round(n).toLocaleString('en-IN'),
    },
    {
      label: "Today's Volume",
      value: report.todayVolume ?? 0,
      icon: BarChart3,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/15',
      gradient: 'from-cyan-600 to-cyan-900',
      formatter: formatIndianNumber,
    },
    {
      label: "Today's Commission",
      value: report.todayCommission ?? 0,
      icon: CircleDollarSign,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/15',
      gradient: 'from-yellow-600 to-yellow-900',
      formatter: formatIndianNumber,
    },
    {
      label: 'Platform P&L',
      value: report.todayPnl ?? 0,
      icon: TrendingUp,
      color: (report.todayPnl ?? 0) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]',
      bg: (report.todayPnl ?? 0) >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15',
      gradient: (report.todayPnl ?? 0) >= 0 ? 'from-emerald-600 to-emerald-900' : 'from-red-600 to-red-900',
      formatter: (n: number) => (n >= 0 ? '+' : '') + formatIndianNumber(n),
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Platform Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const IconComp = stat.icon;
          return (
            <GlassCard key={stat.label} gradient={`bg-gradient-to-br ${stat.gradient}`}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-400">{stat.label}</span>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                    <IconComp className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
                <AnimatedNumber
                  value={stat.value}
                  formatter={stat.formatter}
                  className={`text-xl lg:text-2xl font-bold tracking-tight ${stat.color}`}
                />
                <div className="mt-2">
                  {/* Mini sparkline indicator */}
                  <div className="flex items-center gap-1">
                    <div className="flex gap-0.5 items-end h-4">
                      {[3, 5, 4, 7, 6, 8, 7].map((h, i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-full ${stat.color.includes('ef4444') ? 'bg-red-400/40' : 'bg-emerald-400/40'}`}
                          style={{ height: `${h * 2}px` }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-500 ml-1">7d trend</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Main Dashboard Page
// ============================================================

export default function DashboardPage() {
  const { user, fetchUser, updateBalance } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const role = (user?.role || 'CLIENT') as Role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isAgent = role === 'AGENT';
  const isAdminOrAgent = isAdmin || isAgent;

  // Data states
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [transactions, setTransactions] = useState<CoinHistoryItem[]>([]);
  const [adminReport, setAdminReport] = useState<AdminReport>({});
  const [activeBetsCount, setActiveBetsCount] = useState(0);
  const [todayPnl, setTodayPnl] = useState(0);

  // Loading states
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [adminStatsLoading, setAdminStatsLoading] = useState(true);

  // Fade in
  const [visible, setVisible] = useState(false);

  // Last refresh
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // ---- Fetch Matches ----
  const fetchMatches = useCallback(async () => {
    try {
      const { data } = await api.get('/cricket/all-matches-dashboard');
      const matchList = Array.isArray(data) ? data : data?.matches || data?.data || [];
      setMatches(matchList);
    } catch {
      // Silent fail on poll
    }
  }, []);

  // ---- Fetch User Stats ----
  const fetchStats = useCallback(async () => {
    try {
      await fetchUser();

      // Fetch unsettled bets and exposure table in parallel
      const [betsRes, exposureRes] = await Promise.all([
        api.post('/user/unsettled-bets', {}).catch(() => ({ data: {} })),
        api.get('/user/exposure-table').catch(() => ({ data: {} })),
      ]);

      // Parse active bets count from unsettled bets
      const betsData = betsRes.data as UnsettledBetsResponse;
      const betsArray = betsData.bets || [];
      const fancyArray = betsData.fancy || [];
      const totalFromCounts = (betsData.betsTotal ?? 0) + (betsData.fancyTotal ?? 0);
      const totalFromArrays = betsArray.length + fancyArray.length;
      const totalDirect = betsData.total ?? 0;
      setActiveBetsCount(totalFromCounts || totalDirect || totalFromArrays);

      // Parse P&L from exposure table
      const exposureData = exposureRes.data;
      let computedPnl = 0;
      if (exposureData) {
        // Try to read totalPnl / pnl / todayPnl from exposure-table response
        if (typeof exposureData.totalPnl === 'number') {
          computedPnl = exposureData.totalPnl;
        } else if (typeof exposureData.pnl === 'number') {
          computedPnl = exposureData.pnl;
        } else if (typeof exposureData.todayPnl === 'number') {
          computedPnl = exposureData.todayPnl;
        } else {
          // Sum up P&L from individual exposure entries
          const entries = Array.isArray(exposureData) ? exposureData : exposureData?.data || exposureData?.exposures || [];
          if (Array.isArray(entries)) {
            computedPnl = entries.reduce((sum: number, entry: Record<string, unknown>) => {
              const val = (entry.pnl ?? entry.profitLoss ?? entry.amount ?? 0) as number;
              return sum + val;
            }, 0);
          }
        }
      }

      // Fetch coin history for both P&L fallback and recent activity
      try {
        const { data: coinData } = await api.get('/user/coin-history');
        const items: CoinHistoryItem[] = Array.isArray(coinData) ? coinData : coinData?.data || coinData?.history || coinData?.records || [];

        // If exposure-table didn't yield P&L, compute from coin history for today
        if (computedPnl === 0 && items.length > 0) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayItems = items.filter((item) => new Date(item.createdAt) >= todayStart);
          computedPnl = todayItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        }

        setTransactions(items.slice(0, 20));
      } catch {
        setTransactions([]);
      }

      setTodayPnl(computedPnl);
    } catch {
      addToast('Failed to load dashboard data', 'error');
    }
    setStatsLoading(false);
    setActivityLoading(false);
  }, [fetchUser, addToast]);

  // ---- Fetch Admin Stats ----
  const fetchAdminStats = useCallback(async () => {
    if (!isAdminOrAgent) {
      setAdminStatsLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/admin/general-report');
      setAdminReport(data || {});
    } catch {
      // Non-critical
    }
    setAdminStatsLoading(false);
  }, [isAdminOrAgent]);

  // ---- Manual Refresh ----
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMatches(), fetchStats(), fetchAdminStats()]);
    setLastRefresh(new Date());
    setRefreshing(false);
    addToast('Dashboard refreshed', 'success');
  }, [fetchMatches, fetchStats, fetchAdminStats, addToast]);

  // ---- Initial Load ----
  useEffect(() => {
    fetchMatches().then(() => setMatchesLoading(false));
    fetchStats();
    fetchAdminStats();

    // Fade in after a tick
    const fadeTimer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(fadeTimer);
  }, [fetchMatches, fetchStats, fetchAdminStats]);

  // ---- Poll Matches Every 10s ----
  useEffect(() => {
    const interval = setInterval(fetchMatches, 10000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  // ---- Socket.IO for Real-time Balance ----
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleBalanceUpdate = (data: { balance: number; exposure?: number }) => {
      if (data && typeof data.balance === 'number') {
        updateBalance(data.balance, data.exposure);
      }
    };

    socket.on('balance-update', handleBalanceUpdate);
    socket.on('balanceUpdate', handleBalanceUpdate);

    return () => {
      socket.off('balance-update', handleBalanceUpdate);
      socket.off('balanceUpdate', handleBalanceUpdate);
    };
  }, [updateBalance]);

  // ---- Greeting ----
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <div
      className={`space-y-6 transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* ===== Page Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
            {greeting}, {user?.name || user?.username}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? 'Admin Dashboard' : isAgent ? 'Agent Dashboard' : 'Your betting dashboard'} &mdash; {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-gray-600">Last updated</p>
            <p className="text-xs text-gray-500">
              {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>
      </div>

      {/* ===== Quick Stats Cards ===== */}
      <QuickStatsRow
        user={user}
        activeBetsCount={activeBetsCount}
        todayPnl={todayPnl}
        loading={statsLoading}
      />

      {/* ===== Quick Actions (Admin/Agent/Super Admin) ===== */}
      {isAdminOrAgent && <QuickActionsBar role={role} />}

      {/* ===== Live Matches ===== */}
      <LiveMatchesSection matches={matches} loading={matchesLoading} />

      {/* ===== Two Column Layout: Activity + Admin Stats or Activity Full Width ===== */}
      <div className={`grid gap-6 ${isAdmin ? 'lg:grid-cols-[1fr_1fr]' : 'grid-cols-1'}`}>
        <RecentActivityFeed transactions={transactions} loading={activityLoading} />

        {isAdmin && (
          <div className="space-y-6">
            <AdminStatsRow report={adminReport} loading={adminStatsLoading} />
          </div>
        )}
      </div>

      {/* ===== Cricket Matches Grid ===== */}
      <CricketMatchesGrid matches={matches} loading={matchesLoading} />

      {/* ===== Bottom Spacer ===== */}
      <div className="h-6" />

      {/* ===== Inline Styles for Custom Animations ===== */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
