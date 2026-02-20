'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ScoreBoard from '@/components/score/ScoreBoard';
import OddsLadder from '@/components/odds/OddsLadder';
import BookmakerOdds from '@/components/odds/BookmakerOdds';
import FancyOdds from '@/components/odds/FancyOdds';
import BetSlip from '@/components/bet/BetSlip';
import FancyBetSlip from '@/components/bet/FancyBetSlip';
import { MatchControlPanel } from '@/components/admin/MatchControlPanel';

// ── Interfaces ───────────────────────────────────────────────

interface PriceSize {
  price: number;
  size: number;
}

interface Runner {
  selectionId: number;
  runnerName: string;
  back: PriceSize[];
  lay: PriceSize[];
  status: string;
}

interface MatchOddsMarket {
  marketId: string;
  marketName: string;
  status: string;
  isPlay: boolean;
  runners: Runner[];
}

interface BookmakerRunner {
  selectionId: number;
  runnerName: string;
  back: PriceSize;
  lay: PriceSize;
  status: string;
}

interface BookmakerMarket {
  marketId: string;
  marketName: string;
  status: string;
  runners: BookmakerRunner[];
}

interface FancyMarket {
  marketId: string;
  marketName: string;
  gameType: string | null;
  selectionId: number;
  runnerName: string;
  back: number;
  backSize: number;
  lay: number;
  laySize: number;
  status: string;
  maxLimit: number | null;
}

interface ScoreData {
  score1: string;
  score2: string;
  spnnation1: string;
  spnnation2: string;
  spnrunrate1: string;
  spnrunrate2: string;
  spnreqrate1: string;
  spnreqrate2: string;
  spnmessage: string;
  balls: string[];
  activenation1: string;
  activenation2: string;
  isfinished: string;
  spnballrunningstatus: string;
  dayno: string;
}

interface EventData {
  id: string;
  cricketId: number;
  eventName: string;
  eventId: string;
  marketId: string;
  isActive: boolean;
  isBetLocked: boolean;
  isFancyLocked: boolean;
  minBet: number;
  maxBet: number;
  oddsDifference: number;
  matchType: string | null;
  markets: any[];
}

interface SelectedBet {
  selectionId: number;
  runnerName: string;
  type: 'BACK' | 'LAY';
  price: number;
  marketId: string;
  marketName: string;
}

interface SelectedFancy {
  marketId: string;
  marketName: string;
  runnerName: string;
  gameType: string | null;
  type: 'YES' | 'NO';
  odds: number;
  rate: number;
}

interface BetRecord {
  id: string;
  betType: string;
  runnerName: string;
  marketName: string;
  amount: number;
  rate: number;
  profit: number;
  loss: number;
  betStatus: string;
  profitLoss: number | null;
  createdAt: string;
}

interface FancyBetRecord {
  id: string;
  runnerName: string;
  marketName: string;
  amount: number;
  oddsBack: number | null;
  oddsLay: number | null;
  backRate: number | null;
  layRate: number | null;
  profit: number;
  loss: number;
  betStatus: string;
  profitLoss: number | null;
  createdAt: string;
}

interface UserBookEntry {
  runnerName: string;
  pnl: number;
}

// ── Helpers ──────────────────────────────────────────────────

function formatIndian(num: number): string {
  if (num === 0) return '0.00';
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const str = absNum.toFixed(2);
  const [intPart, decPart] = str.split('.');
  let result = '';
  const len = intPart.length;
  if (len <= 3) {
    result = intPart;
  } else {
    result = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    while (remaining.length > 2) {
      result = remaining.slice(-2) + ',' + result;
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) {
      result = remaining + ',' + result;
    }
  }
  return (isNegative ? '-' : '') + result + '.' + decPart;
}

// ── Skeleton Components ─────────────────────────────────────

function OddsSkeleton() {
  return (
    <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass overflow-hidden">
      <div className="px-4 py-3 border-b border-glass-border">
        <div className="h-4 w-32 bg-glass-medium rounded animate-pulse" />
      </div>
      <div className="p-2 space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-[1fr_repeat(6,minmax(60px,1fr))] gap-0.5 py-2">
            <div className="px-3">
              <div className="h-4 w-24 bg-glass-medium rounded animate-pulse" />
            </div>
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="h-10 bg-glass-medium rounded-lg animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreSkeleton() {
  return (
    <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass p-5">
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-glass-medium animate-pulse" />
            <div className="h-4 w-28 bg-glass-medium rounded animate-pulse" />
          </div>
          <div className="h-5 w-20 bg-glass-medium rounded animate-pulse" />
        </div>
        <div className="flex justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-glass-medium animate-pulse" />
            <div className="h-4 w-28 bg-glass-medium rounded animate-pulse" />
          </div>
          <div className="h-5 w-20 bg-glass-medium rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────

export default function MatchDetailPage() {
  const { id } = useParams();
  const cricketId = id as string;
  const { user, fetchUser } = useAuthStore();

  // Data states
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [matchOdds, setMatchOdds] = useState<MatchOddsMarket[]>([]);
  const [bookmakerOdds, setBookmakerOdds] = useState<BookmakerMarket[]>([]);
  const [fancyOdds, setFancyOdds] = useState<FancyMarket[]>([]);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [myBets, setMyBets] = useState<BetRecord[]>([]);
  const [myFancyBets, setMyFancyBets] = useState<FancyBetRecord[]>([]);
  const [userBook, setUserBook] = useState<UserBookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Bet slip states
  const [selectedBet, setSelectedBet] = useState<SelectedBet | null>(null);
  const [selectedFancy, setSelectedFancy] = useState<SelectedFancy | null>(null);
  const [mobileBetSlipOpen, setMobileBetSlipOpen] = useState(false);

  // My Bets tab
  const [betsTab, setBetsTab] = useState<'open' | 'settled'>('open');

  // Expanded bet rows
  const [expandedBetId, setExpandedBetId] = useState<string | null>(null);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch functions ────────────────────────────────────────

  const fetchEventData = useCallback(async () => {
    try {
      const { data } = await api.get(`/cricket/event-data/${cricketId}`);
      if (data.status === 'success') {
        setEventData(data.data);
      }
    } catch {
      // Event may not be in DB yet
    }
  }, [cricketId]);

  const fetchOdds = useCallback(async () => {
    try {
      const { data } = await api.get(`/cricket/odds/${cricketId}`);
      if (data.status === 'success' && data.data) {
        setMatchOdds(data.data.matchOdds || []);
        setBookmakerOdds(data.data.bookMakerOdds || []);
        setFancyOdds(data.data.fancyOdds || []);
      }
    } catch {
      // silent
    }
  }, [cricketId]);

  const fetchMyBets = useCallback(async () => {
    try {
      const { data } = await api.get(`/bet/my-bet/${cricketId}`);
      if (data.status === 'success') {
        setMyBets(data.data.bets || []);
        setMyFancyBets(data.data.fancyBets || []);
      }
    } catch {
      // silent
    }
  }, [cricketId]);

  const fetchUserBook = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get(`/bet/user-book/${cricketId}`);
      if (data.status === 'success') {
        setUserBook(data.data || []);
      }
    } catch {
      // silent - endpoint may not exist
    }
  }, [cricketId, isAdmin]);

  // ── Initial load ───────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchEventData(), fetchOdds(), fetchMyBets(), fetchUserBook()]);
      setLoading(false);
    };
    init();
  }, [fetchEventData, fetchOdds, fetchMyBets, fetchUserBook]);

  // ── Polling (fallback for odds every 3 seconds) ────────────

  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchOdds();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchOdds]);

  // ── Socket ─────────────────────────────────────────────────

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !cricketId) return;

    socket.emit('match:join', cricketId);

    const safeguardRunners = (markets: any[]) =>
      markets.map((m: any) => ({ ...m, runners: m.runners || [] }));

    const handleMatchOdds = (data: any) => {
      if (data?.matchOdds) {
        setMatchOdds(safeguardRunners(data.matchOdds));
      } else if (Array.isArray(data)) {
        setMatchOdds(safeguardRunners(data));
      }
    };

    const handleBookmakerOdds = (data: any) => {
      if (Array.isArray(data)) {
        setBookmakerOdds(safeguardRunners(data));
      }
    };

    const handleFancyOdds = (data: any) => {
      if (Array.isArray(data)) {
        setFancyOdds(data);
      }
    };

    const handleScore = (data: ScoreData) => {
      setScoreData(data);
    };

    socket.on(`odds:match:${cricketId}`, handleMatchOdds);
    socket.on(`odds:bookmaker:${cricketId}`, handleBookmakerOdds);
    socket.on(`odds:fancy:${cricketId}`, handleFancyOdds);
    socket.on(`score:${cricketId}`, handleScore);

    return () => {
      socket.emit('match:leave', cricketId);
      socket.off(`odds:match:${cricketId}`, handleMatchOdds);
      socket.off(`odds:bookmaker:${cricketId}`, handleBookmakerOdds);
      socket.off(`odds:fancy:${cricketId}`, handleFancyOdds);
      socket.off(`score:${cricketId}`, handleScore);
    };
  }, [cricketId]);

  // ── Handlers ───────────────────────────────────────────────

  const handleOddsSelect = useCallback(
    (selectionId: number, type: 'BACK' | 'LAY', price: number) => {
      let runnerName = '';
      let marketId = '';
      let marketName = '';

      for (const market of matchOdds) {
        const runner = (market.runners || []).find((r) => r.selectionId === selectionId);
        if (runner) {
          runnerName = runner.runnerName;
          marketId = market.marketId;
          marketName = market.marketName;
          break;
        }
      }

      setSelectedFancy(null);
      setSelectedBet({ selectionId, runnerName, type, price, marketId, marketName });
      setMobileBetSlipOpen(true);
    },
    [matchOdds]
  );

  const handleBookmakerSelect = useCallback(
    (selectionId: number, type: 'BACK' | 'LAY', price: number, marketId: string) => {
      let runnerName = '';
      let marketName = '';

      for (const market of bookmakerOdds) {
        const runner = (market.runners || []).find((r) => r.selectionId === selectionId);
        if (runner) {
          runnerName = runner.runnerName;
          marketName = market.marketName || 'Bookmaker';
          break;
        }
      }

      setSelectedFancy(null);
      setSelectedBet({ selectionId, runnerName, type, price, marketId, marketName });
      setMobileBetSlipOpen(true);
    },
    [bookmakerOdds]
  );

  const handleFancySelect = useCallback(
    (marketId: string, type: 'YES' | 'NO', odds: number, rate: number) => {
      setSelectedBet(null);
      const fancy = fancyOdds.find((f) => f.marketId === marketId);
      setSelectedFancy({
        marketId,
        marketName: fancy?.runnerName || fancy?.marketName || marketId,
        runnerName: fancy?.runnerName || '',
        gameType: fancy?.gameType || null,
        type,
        odds,
        rate,
      });
      setMobileBetSlipOpen(true);
    },
    [fancyOdds]
  );

  const handleBetPlaced = useCallback(() => {
    setSelectedBet(null);
    setSelectedFancy(null);
    setMobileBetSlipOpen(false);
    fetchMyBets();
    fetchUserBook();
    fetchUser();
  }, [fetchMyBets, fetchUserBook, fetchUser]);

  const handleCloseBetSlip = useCallback(() => {
    setSelectedBet(null);
    setSelectedFancy(null);
    setMobileBetSlipOpen(false);
  }, []);

  // ── Derived data ───────────────────────────────────────────

  const eventName = eventData?.eventName || '';
  const [team1, team2] = useMemo(() => {
    if (eventName.includes(' v ')) {
      return eventName.split(' v ').map((t) => t.trim());
    }
    return [eventName, ''];
  }, [eventName]);

  const primaryMarket = matchOdds.length > 0 ? matchOdds[0] : null;
  const hasBetSlip = selectedBet !== null || selectedFancy !== null;

  // Separate open and settled bets
  const openBets = useMemo(() => myBets.filter((b) => b.betStatus === 'MATCHED' || b.betStatus === 'UNMATCHED'), [myBets]);
  const settledBets = useMemo(() => myBets.filter((b) => b.betStatus !== 'MATCHED' && b.betStatus !== 'UNMATCHED'), [myBets]);
  const openFancyBets = useMemo(() => myFancyBets.filter((b) => b.betStatus === 'MATCHED' || b.betStatus === 'UNMATCHED'), [myFancyBets]);
  const settledFancyBets = useMemo(() => myFancyBets.filter((b) => b.betStatus !== 'MATCHED' && b.betStatus !== 'UNMATCHED'), [myFancyBets]);

  const totalBets = myBets.length + myFancyBets.length;

  // Match status
  const matchStatus = useMemo(() => {
    if (scoreData?.isfinished === 'true' || scoreData?.isfinished === '1') return 'COMPLETED' as const;
    if (primaryMarket?.isPlay) return 'LIVE' as const;
    return 'UPCOMING' as const;
  }, [scoreData, primaryMarket]);

  // ── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <ScoreSkeleton />
        <OddsSkeleton />
        <OddsSkeleton />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* ─── Admin Controls (sticky top) ──────────────────────── */}
      {isAdmin && eventData && (
        <div className="mb-4">
          <MatchControlPanel
            cricketId={parseInt(cricketId)}
            eventData={eventData}
            onUpdate={fetchEventData}
          />
        </div>
      )}

      {/* ─── Event header badges ──────────────────────────────── */}
      {eventData && (eventData.isBetLocked || !eventData.isActive) && (
        <div className="flex items-center gap-2 mb-3">
          {eventData.isBetLocked && (
            <div className="flex items-center gap-1.5 bg-loss-surface border border-loss/20 rounded-full px-3 py-1">
              <svg className="w-3 h-3 text-loss" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-[10px] font-bold text-loss uppercase tracking-wider">Bets Locked</span>
            </div>
          )}
          {!eventData.isActive && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
              <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Inactive</span>
            </div>
          )}
          {eventData.matchType && (
            <Badge variant="info">{eventData.matchType}</Badge>
          )}
        </div>
      )}

      {/* ─── 3-Column Desktop / Single Column Mobile Layout ───── */}
      <div className="flex gap-4">
        {/* ═══ LEFT + CENTER (main content) ═══ */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* ─── Scoreboard ─────────────────────────────────── */}
          <ScoreBoard
            scoreData={scoreData}
            team1={team1}
            team2={team2}
            matchStatus={matchStatus}
          />

          {/* ─── Match Odds ─────────────────────────────────── */}
          {primaryMarket && (primaryMarket.runners || []).length > 0 && (
            <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-back" />
                  <h3 className="text-sm font-semibold text-white">
                    {primaryMarket.marketName || 'Match Odds'}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {primaryMarket.status === 'SUSPENDED' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                      Suspended
                    </span>
                  )}
                  {primaryMarket.isPlay && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-2.5 py-0.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">In-Play</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Odds ladder */}
              <div className="p-2">
                <OddsLadder
                  runners={primaryMarket.runners}
                  marketStatus={primaryMarket.status}
                  onSelect={handleOddsSelect}
                />
              </div>
            </div>
          )}

          {/* Additional match odds markets */}
          {matchOdds.slice(1).map((market) => (
            <div
              key={market.marketId}
              className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-back" />
                  <h3 className="text-sm font-semibold text-white">{market.marketName}</h3>
                </div>
              </div>
              <div className="p-2">
                <OddsLadder
                  runners={market.runners}
                  marketStatus={market.status}
                  onSelect={handleOddsSelect}
                />
              </div>
            </div>
          ))}

          {/* ─── Bookmaker Odds ──────────────────────────────── */}
          {bookmakerOdds.length > 0 && (
            <BookmakerOdds markets={bookmakerOdds} onSelect={handleBookmakerSelect} />
          )}

          {/* ─── Fancy Odds ─────────────────────────────────── */}
          {fancyOdds.length > 0 && (
            <FancyOdds markets={fancyOdds} onSelect={handleFancySelect} />
          )}

          {/* ─── User Book / Position (admin) ──────────────── */}
          {isAdmin && userBook.length > 0 && (
            <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <h3 className="text-sm font-semibold text-white">User Book / Position</h3>
                </div>
                <button
                  onClick={fetchUserBook}
                  className="text-[10px] text-gray-500 hover:text-gray-300 font-medium uppercase tracking-wider transition-colors"
                >
                  Refresh
                </button>
              </div>
              <div className="p-3 space-y-2">
                {userBook.map((entry, idx) => {
                  const isPositive = entry.pnl >= 0;
                  const maxAbsPnl = Math.max(...userBook.map((e) => Math.abs(e.pnl)), 1);
                  const barWidth = Math.min(Math.abs(entry.pnl) / maxAbsPnl * 100, 100);

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-xl bg-glass-light px-4 py-3 border border-glass-border"
                    >
                      <span className="text-sm font-medium text-gray-200 min-w-[120px]">
                        If <span className="text-white font-semibold">{entry.runnerName}</span> wins:
                      </span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-3 bg-glass-medium rounded-full overflow-hidden relative">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              isPositive ? 'bg-profit/60' : 'bg-loss/60'
                            )}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className={cn(
                          'text-sm font-bold tabular-nums min-w-[80px] text-right',
                          isPositive ? 'text-profit' : 'text-loss'
                        )}>
                          {isPositive ? '+' : ''}{formatIndian(entry.pnl)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── My Bets Section ────────────────────────────── */}
          {totalBets > 0 && (
            <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass overflow-hidden">
              {/* Header with tabs */}
              <div className="px-4 py-3 border-b border-glass-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">My Bets</h3>
                    <span className="text-[10px] text-gray-500 bg-glass-medium rounded-full px-2 py-0.5">
                      {totalBets}
                    </span>
                  </div>
                  <button
                    onClick={fetchMyBets}
                    className="text-[10px] text-gray-500 hover:text-gray-300 font-medium uppercase tracking-wider transition-colors"
                  >
                    Refresh
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setBetsTab('open')}
                    className={cn(
                      'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all',
                      betsTab === 'open'
                        ? 'bg-back/15 text-back-light border border-back/20'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-glass-light'
                    )}
                  >
                    Open Bets ({openBets.length + openFancyBets.length})
                  </button>
                  <button
                    onClick={() => setBetsTab('settled')}
                    className={cn(
                      'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all',
                      betsTab === 'settled'
                        ? 'bg-gray-500/15 text-gray-300 border border-gray-500/20'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-glass-light'
                    )}
                  >
                    Settled ({settledBets.length + settledFancyBets.length})
                  </button>
                </div>
              </div>

              {/* Bet list */}
              <div className="max-h-[500px] overflow-y-auto">
                {betsTab === 'open' && (
                  <>
                    {openBets.length === 0 && openFancyBets.length === 0 ? (
                      <EmptyBets message="No open bets" />
                    ) : (
                      <>
                        {openBets.map((bet) => (
                          <BetRow
                            key={bet.id}
                            bet={bet}
                            isExpanded={expandedBetId === bet.id}
                            onToggle={() => setExpandedBetId(expandedBetId === bet.id ? null : bet.id)}
                          />
                        ))}
                        {openFancyBets.map((bet) => (
                          <FancyBetRow
                            key={bet.id}
                            bet={bet}
                            isExpanded={expandedBetId === bet.id}
                            onToggle={() => setExpandedBetId(expandedBetId === bet.id ? null : bet.id)}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
                {betsTab === 'settled' && (
                  <>
                    {settledBets.length === 0 && settledFancyBets.length === 0 ? (
                      <EmptyBets message="No settled bets" />
                    ) : (
                      <>
                        {settledBets.map((bet) => (
                          <BetRow
                            key={bet.id}
                            bet={bet}
                            isExpanded={expandedBetId === bet.id}
                            onToggle={() => setExpandedBetId(expandedBetId === bet.id ? null : bet.id)}
                          />
                        ))}
                        {settledFancyBets.map((bet) => (
                          <FancyBetRow
                            key={bet.id}
                            bet={bet}
                            isExpanded={expandedBetId === bet.id}
                            onToggle={() => setExpandedBetId(expandedBetId === bet.id ? null : bet.id)}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT COLUMN - Desktop Bet Slip (sticky) ═══ */}
        <div className="hidden lg:block w-[340px] flex-shrink-0">
          <div className="sticky top-4 space-y-4">
            {hasBetSlip ? (
              <>
                {selectedBet && (
                  <BetSlip
                    eventId={parseInt(cricketId)}
                    selection={{
                      selectionId: selectedBet.selectionId,
                      runnerName: selectedBet.runnerName,
                      marketId: selectedBet.marketId,
                      marketName: selectedBet.marketName,
                      type: selectedBet.type,
                      price: selectedBet.price,
                    }}
                    onClose={handleCloseBetSlip}
                    onPlaced={handleBetPlaced}
                  />
                )}
                {selectedFancy && (
                  <FancyBetSlip
                    eventId={parseInt(cricketId)}
                    selection={{
                      marketId: selectedFancy.marketId,
                      marketName: selectedFancy.marketName,
                      type: selectedFancy.type,
                      odds: selectedFancy.odds,
                      rate: selectedFancy.rate,
                    }}
                    onClose={handleCloseBetSlip}
                    onPlaced={handleBetPlaced}
                  />
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass p-6 text-center">
                <div className="h-12 w-12 rounded-2xl bg-glass-medium mx-auto mb-3 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-gray-400 mb-1">Bet Slip</h4>
                <p className="text-xs text-gray-600">Click on any odds to place a bet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MOBILE BET SLIP (Bottom Sheet) ═══ */}
      {hasBetSlip && (
        <>
          {/* Backdrop */}
          <div
            className={cn(
              'lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
              mobileBetSlipOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            onClick={handleCloseBetSlip}
          />

          {/* Bottom sheet */}
          <div
            className={cn(
              'lg:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out',
              mobileBetSlipOpen ? 'translate-y-0' : 'translate-y-full'
            )}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-2 bg-[var(--color-card)] rounded-t-3xl border-t border-glass-border">
              <div className="h-1 w-10 rounded-full bg-gray-600" />
            </div>

            <div className="bg-[var(--color-card)] px-4 pb-6 max-h-[80vh] overflow-y-auto">
              {selectedBet && (
                <BetSlip
                  eventId={parseInt(cricketId)}
                  selection={{
                    selectionId: selectedBet.selectionId,
                    runnerName: selectedBet.runnerName,
                    marketId: selectedBet.marketId,
                    marketName: selectedBet.marketName,
                    type: selectedBet.type,
                    price: selectedBet.price,
                  }}
                  onClose={handleCloseBetSlip}
                  onPlaced={handleBetPlaced}
                />
              )}
              {selectedFancy && (
                <FancyBetSlip
                  eventId={parseInt(cricketId)}
                  selection={{
                    marketId: selectedFancy.marketId,
                    marketName: selectedFancy.marketName,
                    type: selectedFancy.type,
                    odds: selectedFancy.odds,
                    rate: selectedFancy.rate,
                  }}
                  onClose={handleCloseBetSlip}
                  onPlaced={handleBetPlaced}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Bet Row Component ────────────────────────────────────────

function BetRow({
  bet,
  isExpanded,
  onToggle,
}: {
  bet: BetRecord;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isBack = bet.betType === 'BACK';

  return (
    <div className="border-b border-glass-border/50 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-glass-light transition-colors text-left"
      >
        {/* Type badge */}
        <span className={cn(
          'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider flex-shrink-0',
          isBack ? 'bg-back/20 text-back-light' : 'bg-lay/20 text-lay-light'
        )}>
          {bet.betType}
        </span>

        {/* Runner + Market */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-200 block truncate">{bet.runnerName}</span>
          <span className="text-[10px] text-gray-500 block truncate">{bet.marketName}</span>
        </div>

        {/* Odds */}
        <span className="text-sm font-bold text-white tabular-nums flex-shrink-0">
          {Number(bet.rate).toFixed(2)}
        </span>

        {/* Amount */}
        <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
          &#8377;{formatIndian(bet.amount)}
        </span>

        {/* Status */}
        <StatusBadge status={bet.betStatus} />

        {/* P&L */}
        {bet.profitLoss !== null ? (
          <span className={cn(
            'text-xs font-bold tabular-nums flex-shrink-0 min-w-[60px] text-right',
            Number(bet.profitLoss) >= 0 ? 'text-profit' : 'text-loss'
          )}>
            {Number(bet.profitLoss) >= 0 ? '+' : ''}&#8377;{formatIndian(Number(bet.profitLoss))}
          </span>
        ) : (
          <span className="text-xs text-gray-600 flex-shrink-0 min-w-[60px] text-right">-</span>
        )}

        {/* Expand icon */}
        <svg
          className={cn(
            'w-3.5 h-3.5 text-gray-600 transition-transform flex-shrink-0',
            isExpanded && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-3 animate-slide-up">
          <div className="grid grid-cols-3 gap-2">
            <DetailCell label="Profit" value={`+${formatIndian(bet.profit)}`} color="text-profit" />
            <DetailCell label="Loss" value={`-${formatIndian(bet.loss)}`} color="text-loss" />
            <DetailCell
              label="Placed"
              value={new Date(bet.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              color="text-gray-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FancyBetRow({
  bet,
  isExpanded,
  onToggle,
}: {
  bet: FancyBetRecord;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isYes = bet.oddsBack !== null && Number(bet.oddsBack) > 0;

  return (
    <div className="border-b border-glass-border/50 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-glass-light transition-colors text-left"
      >
        <span className={cn(
          'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider flex-shrink-0',
          isYes ? 'bg-back/20 text-back-light' : 'bg-lay/20 text-lay-light'
        )}>
          {isYes ? 'YES' : 'NO'}
        </span>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-200 block truncate">{bet.runnerName}</span>
          <span className="text-[10px] text-gray-500 block truncate">{bet.marketName}</span>
        </div>

        <span className="text-sm font-bold text-white tabular-nums flex-shrink-0">
          {isYes ? Number(bet.oddsBack).toFixed(0) : Number(bet.oddsLay).toFixed(0)}
        </span>

        <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
          &#8377;{formatIndian(bet.amount)}
        </span>

        <StatusBadge status={bet.betStatus} />

        {bet.profitLoss !== null ? (
          <span className={cn(
            'text-xs font-bold tabular-nums flex-shrink-0 min-w-[60px] text-right',
            Number(bet.profitLoss) >= 0 ? 'text-profit' : 'text-loss'
          )}>
            {Number(bet.profitLoss) >= 0 ? '+' : ''}&#8377;{formatIndian(Number(bet.profitLoss))}
          </span>
        ) : (
          <span className="text-xs text-gray-600 flex-shrink-0 min-w-[60px] text-right">-</span>
        )}

        <svg
          className={cn(
            'w-3.5 h-3.5 text-gray-600 transition-transform flex-shrink-0',
            isExpanded && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 animate-slide-up">
          <div className="grid grid-cols-3 gap-2">
            <DetailCell label="Profit" value={`+${formatIndian(bet.profit)}`} color="text-profit" />
            <DetailCell label="Loss" value={`-${formatIndian(bet.loss)}`} color="text-loss" />
            <DetailCell
              label="Placed"
              value={new Date(bet.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              color="text-gray-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0',
      status === 'MATCHED' && 'bg-emerald-500/15 text-emerald-400',
      status === 'UNMATCHED' && 'bg-amber-500/15 text-amber-400',
      status === 'SETTLED' && 'bg-gray-500/15 text-gray-400',
      status === 'DELETED' && 'bg-red-500/15 text-red-400',
      !['MATCHED', 'UNMATCHED', 'SETTLED', 'DELETED'].includes(status) && 'bg-gray-500/15 text-gray-500'
    )}>
      {status}
    </span>
  );
}

function DetailCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-glass-light px-3 py-2">
      <span className="block text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</span>
      <span className={cn('text-xs font-semibold', color)}>{value}</span>
    </div>
  );
}

function EmptyBets({ message }: { message: string }) {
  return (
    <div className="py-10 text-center">
      <div className="h-10 w-10 rounded-2xl bg-glass-medium mx-auto mb-2 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}
