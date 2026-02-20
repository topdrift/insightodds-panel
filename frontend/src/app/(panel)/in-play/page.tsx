'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import {
  Search,
  Zap,
  Clock,
  TrendingUp,
  Radio,
  Calendar,
  Filter,
  ChevronRight,
  Activity,
} from 'lucide-react';

/* ───────────────────────── Types ───────────────────────── */

interface MatchOdds {
  team1Back: number;
  team1Lay: number;
  drawBack: number;
  drawLay: number;
  team2Back: number;
  team2Lay: number;
}

const emptyOdds: MatchOdds = { team1Back: 0, team1Lay: 0, drawBack: 0, drawLay: 0, team2Back: 0, team2Lay: 0 };

interface DashboardMatch {
  cricketId: number;
  gameId: string;
  marketId: string;
  eventId: string;
  eventName: string;
  team1: string;
  team2: string;
  eventTime: string;
  inPlay: boolean;
  matchType: string | null;
  matchOdds: MatchOdds;
}

type FilterTab = 'ALL' | 'LIVE' | 'TODAY' | 'TOMORROW';
type SortBy = 'time' | 'popularity';

/* ───────────────────────── Helpers ───────────────────────── */

function getCountdown(eventTime: string): string {
  const now = new Date().getTime();
  const target = new Date(eventTime).getTime();
  const diff = target - now;
  if (diff <= 0) return 'Starting...';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isTomorrow(dateStr: string): boolean {
  const d = new Date(dateStr);
  const tmrw = new Date();
  tmrw.setDate(tmrw.getDate() + 1);
  return d.toDateString() === tmrw.toDateString();
}

function getDateGroup(dateStr: string): string {
  if (isToday(dateStr)) return 'Today';
  if (isTomorrow(dateStr)) return 'Tomorrow';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/* ───────────────────────── Skeleton Loader ───────────────────────── */

function MatchSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-16 rounded-full bg-gray-700" />
        <div className="h-4 w-12 rounded bg-gray-700" />
      </div>
      <div className="h-5 w-3/4 rounded bg-gray-700 mb-4" />
      <div className="space-y-2">
        <div className="h-8 rounded bg-gray-700" />
        <div className="h-8 rounded bg-gray-700" />
      </div>
      <div className="mt-4 h-4 w-1/3 rounded bg-gray-700" />
    </div>
  );
}

/* ───────────────────────── Odds Cell ───────────────────────── */

function OddsCell({
  value,
  type,
  flash,
  onClick,
}: {
  value: number;
  type: 'back' | 'lay';
  flash: boolean;
  onClick?: () => void;
}) {
  const formatted = !value || value <= 0 ? '-' : value.toFixed(2);
  const bg =
    type === 'back'
      ? 'bg-[#72bbef] hover:bg-[#5aa8e0]'
      : 'bg-[#faa9ba] hover:bg-[#f08da4]';

  return (
    <button
      onClick={onClick}
      className={`relative rounded-lg px-2 py-2 text-center transition-all duration-200 ${bg} ${
        flash ? 'ring-2 ring-yellow-400 scale-105' : ''
      }`}
    >
      <span className="text-xs font-bold text-gray-900">{formatted}</span>
      {flash && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
      )}
    </button>
  );
}

/* ───────────────────────── Featured Match Card ───────────────────────── */

function FeaturedMatchCard({
  match: rawMatch,
  onClick,
}: {
  match: DashboardMatch;
  onClick: () => void;
}) {
  const match = { ...rawMatch, matchOdds: rawMatch.matchOdds || emptyOdds };
  const [countdown, setCountdown] = useState(getCountdown(match.eventTime));

  useEffect(() => {
    if (match.inPlay) return;
    const iv = setInterval(() => setCountdown(getCountdown(match.eventTime)), 1000);
    return () => clearInterval(iv);
  }, [match.eventTime, match.inPlay]);

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-gray-600/30 bg-gradient-to-br from-[var(--color-primary)]/20 via-gray-900/60 to-gray-800/40 backdrop-blur-xl p-6 md:p-8 transition-all duration-300 hover:border-[var(--color-secondary)]/50 hover:shadow-2xl hover:shadow-[var(--color-secondary)]/10"
    >
      {/* Decorative glow */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-[var(--color-secondary)]/10 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-[var(--color-primary)]/20 blur-2xl" />

      <div className="relative z-10">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {match.inPlay ? (
              <div className="flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-1.5 border border-red-500/30">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                <span className="text-sm font-bold text-red-400 tracking-wide">LIVE</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-blue-500/20 px-4 py-1.5 border border-blue-500/30">
                <Clock className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-sm font-semibold text-blue-400">{countdown}</span>
              </div>
            )}
            <Badge variant="info" className="hidden sm:inline-flex">FEATURED</Badge>
          </div>
          {match.matchType && (
            <span className="rounded-full bg-gray-700/60 px-3 py-1 text-xs font-medium text-gray-300">
              {match.matchType}
            </span>
          )}
        </div>

        {/* Team Names */}
        <div className="flex items-center justify-center gap-4 md:gap-6 mb-8">
          <div className="flex-1 text-right">
            <h2 className="text-xl md:text-2xl font-bold text-white leading-tight group-hover:text-[var(--color-secondary)] transition-colors">
              {match.team1}
            </h2>
          </div>
          <div className="flex-shrink-0">
            <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-gray-700/60 border border-gray-600">
              <span className="text-sm md:text-base font-bold text-[var(--color-secondary)]">VS</span>
            </div>
          </div>
          <div className="flex-1 text-left">
            <h2 className="text-xl md:text-2xl font-bold text-white leading-tight group-hover:text-[var(--color-secondary)] transition-colors">
              {match.team2}
            </h2>
          </div>
        </div>

        {/* Odds Grid */}
        <div className="rounded-xl bg-gray-800/60 backdrop-blur-sm p-4 border border-gray-700/40">
          {/* Headers */}
          <div className="grid grid-cols-5 gap-2 mb-2 text-center">
            <div className="col-span-1" />
            <div className="col-span-2 text-xs font-bold text-[#72bbef] uppercase tracking-wider">Back</div>
            <div className="col-span-2 text-xs font-bold text-[#faa9ba] uppercase tracking-wider">Lay</div>
          </div>

          {/* Team 1 */}
          <div className="grid grid-cols-5 gap-2 mb-2 items-center">
            <div className="col-span-1 text-sm font-semibold text-white truncate" title={match.team1}>
              {match.team1}
            </div>
            <OddsCell value={match.matchOdds.team1Back} type="back" flash={false} />
            <OddsCell value={match.matchOdds.drawBack} type="back" flash={false} />
            <OddsCell value={match.matchOdds.team1Lay} type="lay" flash={false} />
            <OddsCell value={match.matchOdds.drawLay} type="lay" flash={false} />
          </div>

          {/* Team 2 */}
          <div className="grid grid-cols-5 gap-2 items-center">
            <div className="col-span-1 text-sm font-semibold text-white truncate" title={match.team2}>
              {match.team2}
            </div>
            <OddsCell value={match.matchOdds.team2Back} type="back" flash={false} />
            <div className="rounded-lg bg-gray-700/40 py-2 text-center text-xs text-gray-500">-</div>
            <OddsCell value={match.matchOdds.team2Lay} type="lay" flash={false} />
            <div className="rounded-lg bg-gray-700/40 py-2 text-center text-xs text-gray-500">-</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {match.inPlay ? 'Match in progress' : formatDate(match.eventTime)}
          </span>
          <div className="flex items-center gap-1 text-xs text-[var(--color-secondary)] font-medium group-hover:gap-2 transition-all">
            View Details <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Match Card ───────────────────────── */

function MatchCard({
  match: rawMatch,
  prevOdds,
  onClick,
}: {
  match: DashboardMatch;
  prevOdds: MatchOdds | null;
  onClick: () => void;
}) {
  const match = { ...rawMatch, matchOdds: rawMatch.matchOdds || emptyOdds };
  const [countdown, setCountdown] = useState(getCountdown(match.eventTime));

  useEffect(() => {
    if (match.inPlay) return;
    const iv = setInterval(() => setCountdown(getCountdown(match.eventTime)), 1000);
    return () => clearInterval(iv);
  }, [match.eventTime, match.inPlay]);

  const flashField = (field: keyof MatchOdds): boolean => {
    if (!prevOdds) return false;
    return prevOdds[field] !== match.matchOdds[field];
  };

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-gray-700/40 bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl transition-all duration-300 hover:border-gray-500/60 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-secondary)]/0 to-[var(--color-primary)]/0 group-hover:from-[var(--color-secondary)]/5 group-hover:to-[var(--color-primary)]/5 transition-all duration-300" />

      <div className="relative z-10 p-4 md:p-5">
        {/* Status Row */}
        <div className="flex items-center justify-between mb-3">
          {match.inPlay ? (
            <div className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 border border-red-500/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[11px] font-bold text-red-400 tracking-wide">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-gray-700/50 px-3 py-1">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-[11px] font-semibold text-gray-400">{countdown}</span>
            </div>
          )}
          {match.matchType && (
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              {match.matchType}
            </span>
          )}
        </div>

        {/* Team Names */}
        <div className="mb-4">
          <p className="text-sm font-bold text-white leading-snug group-hover:text-[var(--color-secondary)] transition-colors">
            {match.team1}
          </p>
          <div className="flex items-center gap-2 my-1.5">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
            <span className="text-[10px] font-bold text-gray-500">VS</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
          </div>
          <p className="text-sm font-bold text-white leading-snug group-hover:text-[var(--color-secondary)] transition-colors">
            {match.team2}
          </p>
        </div>

        {/* Mini Odds */}
        <div className="rounded-xl bg-gray-800/60 p-3 border border-gray-700/30">
          {/* Headers */}
          <div className="grid grid-cols-5 gap-1.5 mb-1.5 text-center">
            <div className="col-span-1" />
            <div className="col-span-2 text-[9px] font-bold text-[#72bbef] uppercase tracking-widest">Back</div>
            <div className="col-span-2 text-[9px] font-bold text-[#faa9ba] uppercase tracking-widest">Lay</div>
          </div>

          {/* Team 1 */}
          <div className="grid grid-cols-5 gap-1.5 mb-1.5 items-center">
            <div className="col-span-1 truncate text-[11px] font-medium text-gray-300" title={match.team1}>
              {match.team1.length > 10 ? match.team1.substring(0, 10) + '..' : match.team1}
            </div>
            <OddsCell value={match.matchOdds.team1Back} type="back" flash={flashField('team1Back')} />
            <OddsCell value={match.matchOdds.drawBack} type="back" flash={flashField('drawBack')} />
            <OddsCell value={match.matchOdds.team1Lay} type="lay" flash={flashField('team1Lay')} />
            <OddsCell value={match.matchOdds.drawLay} type="lay" flash={flashField('drawLay')} />
          </div>

          {/* Team 2 */}
          <div className="grid grid-cols-5 gap-1.5 items-center">
            <div className="col-span-1 truncate text-[11px] font-medium text-gray-300" title={match.team2}>
              {match.team2.length > 10 ? match.team2.substring(0, 10) + '..' : match.team2}
            </div>
            <OddsCell value={match.matchOdds.team2Back} type="back" flash={flashField('team2Back')} />
            <div className="rounded-lg bg-gray-700/30 py-2 text-center text-[10px] text-gray-600">-</div>
            <OddsCell value={match.matchOdds.team2Lay} type="lay" flash={flashField('team2Lay')} />
            <div className="rounded-lg bg-gray-700/30 py-2 text-center text-[10px] text-gray-600">-</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-gray-500">
            {match.inPlay ? (
              <span className="flex items-center gap-1 text-green-400">
                <Activity className="h-3 w-3" /> In Progress
              </span>
            ) : (
              formatDate(match.eventTime)
            )}
          </span>
          <span className="text-gray-600 font-mono">#{match.cricketId}</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function InPlayPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<DashboardMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('time');
  const [search, setSearch] = useState('');
  const prevOddsRef = useRef<Record<number, MatchOdds>>({});

  const fetchMatches = useCallback(async () => {
    try {
      const { data } = await api.get('/cricket/all-matches-dashboard');
      if (data.status === 'success') {
        const incoming = data.data || [];
        // Store previous odds for flash detection
        const prevMap: Record<number, MatchOdds> = {};
        matches.forEach((m) => {
          prevMap[m.cricketId] = m.matchOdds;
        });
        prevOddsRef.current = prevMap;
        setMatches(incoming);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Poll every 10 seconds
  useEffect(() => {
    const iv = setInterval(fetchMatches, 10000);
    return () => clearInterval(iv);
  }, [fetchMatches]);

  // Socket: listen for real-time match updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMatchesUpdated = (updatedMatches: DashboardMatch[]) => {
      if (Array.isArray(updatedMatches)) {
        const prevMap: Record<number, MatchOdds> = {};
        matches.forEach((m) => {
          prevMap[m.cricketId] = m.matchOdds;
        });
        prevOddsRef.current = prevMap;
        setMatches(updatedMatches);
      }
    };

    socket.on('matches:updated', handleMatchesUpdated);
    return () => {
      socket.off('matches:updated', handleMatchesUpdated);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  // Filter matches
  const filteredMatches = matches
    .filter((m) => {
      if (activeTab === 'LIVE' && !m.inPlay) return false;
      if (activeTab === 'TODAY' && !isToday(m.eventTime) && !m.inPlay) return false;
      if (activeTab === 'TOMORROW' && !isTomorrow(m.eventTime)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.eventName.toLowerCase().includes(q) ||
          m.team1.toLowerCase().includes(q) ||
          m.team2.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'time') {
        return new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime();
      }
      // Popularity: live first, then by time
      if (a.inPlay && !b.inPlay) return -1;
      if (!a.inPlay && b.inPlay) return 1;
      return new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime();
    });

  const liveMatches = filteredMatches.filter((m) => m.inPlay);
  const upcomingMatches = filteredMatches.filter((m) => !m.inPlay);

  // Group upcoming by date
  const upcomingGrouped = upcomingMatches.reduce<Record<string, DashboardMatch[]>>((acc, m) => {
    const group = getDateGroup(m.eventTime);
    if (!acc[group]) acc[group] = [];
    acc[group].push(m);
    return acc;
  }, {});

  // Featured match (first live, or first upcoming)
  const featuredMatch = liveMatches[0] || upcomingMatches[0];
  const otherLiveMatches = liveMatches.slice(featuredMatch?.inPlay ? 1 : 0);

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'ALL', label: 'All Matches', icon: <Filter className="h-3.5 w-3.5" /> },
    { key: 'LIVE', label: 'Live', icon: <Radio className="h-3.5 w-3.5" /> },
    { key: 'TODAY', label: 'Today', icon: <Zap className="h-3.5 w-3.5" /> },
    { key: 'TOMORROW', label: 'Tomorrow', icon: <Calendar className="h-3.5 w-3.5" /> },
  ];

  const liveCount = matches.filter((m) => m.inPlay).length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">In-Play</h1>
              <p className="text-xs text-gray-500">
                {liveCount} live {liveCount === 1 ? 'match' : 'matches'} &middot; {matches.length} total
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort */}
            <div className="flex items-center rounded-xl border border-gray-700/50 bg-gray-800/50 overflow-hidden">
              <button
                onClick={() => setSortBy('time')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  sortBy === 'time'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Clock className="h-3 w-3" /> Time
              </button>
              <button
                onClick={() => setSortBy('popularity')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  sortBy === 'popularity'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TrendingUp className="h-3 w-3" /> Popular
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Search matches..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 !rounded-xl !border-gray-700/50 !bg-gray-800/50"
              />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/25'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white border border-gray-700/30'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'LIVE' && liveCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {liveCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-6">
          <MatchSkeleton />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <MatchSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : filteredMatches.length === 0 ? (
        <Card className="!border-dashed">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
              <Search className="h-7 w-7 text-gray-500" />
            </div>
            <p className="text-lg font-semibold text-gray-400 mb-1">No matches found</p>
            <p className="text-sm text-gray-500">
              {search ? 'Try a different search term' : 'Check back later for upcoming matches'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Featured Live Match */}
          {featuredMatch && activeTab !== 'TOMORROW' && (
            <section>
              <FeaturedMatchCard
                match={featuredMatch}
                onClick={() => router.push(`/matches/${featuredMatch.cricketId}`)}
              />
            </section>
          )}

          {/* Other Live Matches */}
          {otherLiveMatches.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <h2 className="text-lg font-bold text-white">Live Now</h2>
                </div>
                <Badge variant="danger">{otherLiveMatches.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otherLiveMatches.map((match) => (
                  <MatchCard
                    key={match.cricketId}
                    match={match}
                    prevOdds={prevOddsRef.current[match.cricketId] || null}
                    onClick={() => router.push(`/matches/${match.cricketId}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming Matches grouped by date */}
          {Object.entries(upcomingGrouped).map(([group, groupMatches]) => (
            <section key={group}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 border border-gray-700/50">
                  <Calendar className="h-4 w-4 text-gray-400" />
                </div>
                <h2 className="text-lg font-bold text-white">{group}</h2>
                <span className="rounded-full bg-gray-700/60 px-2.5 py-0.5 text-xs font-medium text-gray-400">
                  {groupMatches.length} {groupMatches.length === 1 ? 'match' : 'matches'}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupMatches.map((match) => (
                  <MatchCard
                    key={match.cricketId}
                    match={match}
                    prevOdds={prevOddsRef.current[match.cricketId] || null}
                    onClick={() => router.push(`/matches/${match.cricketId}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
