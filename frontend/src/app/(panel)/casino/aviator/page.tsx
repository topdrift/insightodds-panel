'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn, formatCurrency } from '@/lib/utils';
import { Plane, Loader2, History, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type Phase = 'WAITING' | 'BETTING' | 'FLYING' | 'CRASHED';

interface RoundHistory {
  id: string;
  roundNumber: number;
  crashPoint: string;
}

interface MyBet {
  id: string;
  amount: string;
  cashOutMultiplier: string | null;
  profitLoss: string | null;
  status: string;
  createdAt: string;
  round: { roundNumber: number; crashPoint: string };
}

const CHIPS = [100, 500, 1000, 5000, 10000];

export default function AviatorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const multiplierRef = useRef(1.0);

  const [phase, setPhase] = useState<Phase>('WAITING');
  const [multiplier, setMultiplier] = useState(1.0);
  const [countdown, setCountdown] = useState(0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [serverSeed, setServerSeed] = useState('');
  const [hashChain, setHashChain] = useState('');
  const [roundNumber, setRoundNumber] = useState(0);

  const [betAmount, setBetAmount] = useState(1000);
  const [currentBetId, setCurrentBetId] = useState<string | null>(null);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashOutMultiplier, setCashOutMultiplier] = useState<number | null>(null);

  const [history, setHistory] = useState<RoundHistory[]>([]);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  // Fetch initial state
  useEffect(() => {
    Promise.all([
      api.get('/casino/aviator/state'),
      api.get('/casino/aviator/history'),
      api.get('/casino/aviator/my-bets'),
    ])
      .then(([stateRes, historyRes, betsRes]) => {
        const s = stateRes.data;
        setPhase(s.phase || 'WAITING');
        setRoundNumber(s.roundNumber || 0);
        setHashChain(s.hashChain || '');
        if (s.currentMultiplier) {
          setMultiplier(s.currentMultiplier);
          multiplierRef.current = s.currentMultiplier;
        }
        setHistory(historyRes.data);
        setMyBets(betsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Socket.IO handlers
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('casino:join', 'aviator');

    const onRoundStart = (data: any) => {
      setPhase('BETTING');
      setRoundNumber(data.roundNumber);
      setHashChain(data.hashChain);
      setCountdown(data.countdown || 10);
      setCrashPoint(null);
      setServerSeed('');
      setMultiplier(1.0);
      multiplierRef.current = 1.0;
      setCurrentBetId(null);
      setHasBet(false);
      setCashedOut(false);
      setCashOutMultiplier(null);
    };

    const onFlying = () => {
      setPhase('FLYING');
      setCountdown(0);
    };

    const onTick = (data: { multiplier: number }) => {
      setMultiplier(data.multiplier);
      multiplierRef.current = data.multiplier;
    };

    const onCrashed = (data: any) => {
      setPhase('CRASHED');
      setCrashPoint(data.crashPoint);
      setServerSeed(data.serverSeed);
      setMultiplier(data.crashPoint);
      multiplierRef.current = data.crashPoint;

      // Add to history
      setHistory((prev) => [
        { id: data.roundId, roundNumber: data.roundNumber, crashPoint: String(data.crashPoint) },
        ...prev.slice(0, 29),
      ]);

      // Refresh my bets
      api.get('/casino/aviator/my-bets').then((r) => setMyBets(r.data)).catch(() => {});
    };

    socket.on('aviator:round-start', onRoundStart);
    socket.on('aviator:flying', onFlying);
    socket.on('aviator:tick', onTick);
    socket.on('aviator:crashed', onCrashed);

    return () => {
      socket.off('aviator:round-start', onRoundStart);
      socket.off('aviator:flying', onFlying);
      socket.off('aviator:tick', onTick);
      socket.off('aviator:crashed', onCrashed);
      socket.emit('casino:leave', 'aviator');
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'BETTING' || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, countdown]);

  // Canvas animation
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const m = multiplierRef.current;

    if (phase === 'FLYING' || phase === 'CRASHED') {
      // Draw curve
      const maxY = Math.max(m * 1.2, 3);

      ctx.beginPath();
      ctx.moveTo(40, h - 40);

      const steps = 200;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const val = 1 + (m - 1) * Math.pow(t, 1.5);
        const x = 40 + (t * (w - 60));
        const y = h - 40 - ((val - 1) / (maxY - 1)) * (h - 80);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      // Color gradient based on multiplier
      const gradient = ctx.createLinearGradient(40, h - 40, w - 20, 40);
      if (phase === 'CRASHED') {
        gradient.addColorStop(0, '#ef4444');
        gradient.addColorStop(1, '#dc2626');
      } else if (m < 1.5) {
        gradient.addColorStop(0, '#22c55e');
        gradient.addColorStop(1, '#4ade80');
      } else if (m < 3) {
        gradient.addColorStop(0, '#eab308');
        gradient.addColorStop(1, '#facc15');
      } else {
        gradient.addColorStop(0, '#f97316');
        gradient.addColorStop(1, '#ef4444');
      }

      ctx.strokeStyle = phase === 'CRASHED' ? '#ef4444' : gradient;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Fill area under curve
      const lastX = 40 + (1 * (w - 60));
      const lastY = h - 40 - ((m - 1) / (maxY - 1)) * (h - 80);
      ctx.lineTo(lastX, h - 40);
      ctx.lineTo(40, h - 40);
      ctx.closePath();
      ctx.fillStyle = phase === 'CRASHED' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)';
      ctx.fill();

      // Plane icon at end of curve
      if (phase === 'FLYING') {
        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('\u2708', lastX - 14, lastY - 10);
      }
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(40, h - 40);
    ctx.lineTo(w - 20, h - 40);
    ctx.stroke();

    animFrameRef.current = requestAnimationFrame(drawGraph);
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(2, 2);
    }
    animFrameRef.current = requestAnimationFrame(drawGraph);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawGraph]);

  // Place bet
  const placeBet = async () => {
    if (placing || hasBet) return;
    setPlacing(true);
    try {
      const { data } = await api.post('/casino/aviator/bet', { amount: betAmount });
      if (data.success) {
        setCurrentBetId(data.betId);
        setHasBet(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  };

  // Cash out
  const cashOut = async () => {
    if (!currentBetId || cashedOut) return;
    try {
      const { data } = await api.post('/casino/aviator/cashout', { betId: currentBetId });
      if (data.success) {
        setCashedOut(true);
        setCashOutMultiplier(data.multiplier);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cash out');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  const crashColor = (cp: number) => {
    if (cp >= 2) return 'bg-emerald-500/20 text-emerald-400';
    if (cp >= 1.5) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/casino" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Plane className="h-5 w-5 text-red-400" /> Aviator
          </h1>
          <p className="text-xs text-white/40">Round #{roundNumber}</p>
        </div>
      </div>

      {/* Recent Crashes Bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {history.slice(0, 15).map((h) => {
          const cp = parseFloat(h.crashPoint);
          return (
            <span
              key={h.id}
              className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', crashColor(cp))}
            >
              {cp.toFixed(2)}x
            </span>
          );
        })}
      </div>

      {/* Main Area: Graph + Bet Panel */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Crash Graph */}
        <div className="lg:col-span-2 relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden" style={{ minHeight: 320 }}>
          <canvas ref={canvasRef} className="w-full h-full" style={{ minHeight: 320 }} />

          {/* Multiplier Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {phase === 'BETTING' && (
              <div className="text-center">
                <p className="text-sm text-white/40 uppercase tracking-wider mb-1">Place your bets</p>
                <p className="text-5xl font-bold text-white">{countdown}s</p>
              </div>
            )}
            {phase === 'FLYING' && (
              <p className={cn(
                'text-6xl font-black tabular-nums',
                multiplier < 1.5 ? 'text-emerald-400' : multiplier < 3 ? 'text-yellow-400' : 'text-orange-400'
              )}>
                {multiplier.toFixed(2)}x
              </p>
            )}
            {phase === 'CRASHED' && (
              <div className="text-center">
                <p className="text-sm text-red-400 uppercase tracking-wider mb-1">Crashed</p>
                <p className="text-6xl font-black text-red-500">{crashPoint?.toFixed(2)}x</p>
              </div>
            )}
            {phase === 'WAITING' && (
              <p className="text-lg text-white/30">Waiting for next round...</p>
            )}
          </div>
        </div>

        {/* Bet Panel */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Place Bet</h3>

          {/* Amount Input */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Amount</label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-white text-lg font-bold tabular-nums outline-none focus:border-white/20 transition-colors"
              disabled={hasBet}
            />
          </div>

          {/* Quick Chips */}
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => setBetAmount(chip)}
                disabled={hasBet}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                  betAmount === chip
                    ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                    : 'border-white/[0.06] bg-white/[0.03] text-white/60 hover:bg-white/[0.06]',
                  hasBet && 'opacity-50 cursor-not-allowed'
                )}
              >
                {chip >= 1000 ? `${chip / 1000}K` : chip}
              </button>
            ))}
          </div>

          {/* Action Button */}
          {phase === 'BETTING' && !hasBet && (
            <button
              onClick={placeBet}
              disabled={placing || betAmount <= 0}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
            >
              {placing ? 'Placing...' : `Place Bet - ${formatCurrency(betAmount)}`}
            </button>
          )}

          {phase === 'BETTING' && hasBet && (
            <div className="w-full rounded-xl bg-yellow-500/10 border border-yellow-500/20 py-3.5 text-center text-sm font-semibold text-yellow-400">
              Bet Placed - Waiting for takeoff...
            </div>
          )}

          {phase === 'FLYING' && hasBet && !cashedOut && (
            <button
              onClick={cashOut}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-base font-bold text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all animate-pulse"
            >
              Cash Out @ {multiplier.toFixed(2)}x
              <span className="block text-xs font-normal opacity-80">
                Win {formatCurrency(betAmount * multiplier)}
              </span>
            </button>
          )}

          {phase === 'FLYING' && cashedOut && (
            <div className="w-full rounded-xl bg-emerald-500/10 border border-emerald-500/20 py-3.5 text-center text-sm font-semibold text-emerald-400">
              Cashed out @ {cashOutMultiplier?.toFixed(2)}x!
              <span className="block text-xs opacity-70 mt-0.5">
                Won {formatCurrency(betAmount * (cashOutMultiplier || 1))}
              </span>
            </div>
          )}

          {phase === 'FLYING' && !hasBet && (
            <div className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] py-3.5 text-center text-sm text-white/40">
              Round in progress...
            </div>
          )}

          {phase === 'CRASHED' && (
            <div className="w-full rounded-xl bg-red-500/10 border border-red-500/20 py-3.5 text-center text-sm text-red-400">
              {cashedOut
                ? `You cashed out @ ${cashOutMultiplier?.toFixed(2)}x`
                : hasBet
                ? 'Crashed! Better luck next time'
                : `Crashed @ ${crashPoint?.toFixed(2)}x`}
            </div>
          )}

          {phase === 'WAITING' && (
            <div className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] py-3.5 text-center text-sm text-white/30">
              Waiting for next round...
            </div>
          )}

          {/* Server Seed Verification */}
          {serverSeed && phase === 'CRASHED' && (
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-white/30">Provably Fair</p>
              <p className="text-[10px] text-white/40 break-all">
                <span className="text-white/60">Hash:</span> {hashChain.substring(0, 32)}...
              </p>
              <p className="text-[10px] text-white/40 break-all">
                <span className="text-white/60">Seed:</span> {serverSeed.substring(0, 32)}...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* My Bets */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
          <History className="h-4 w-4 text-white/40" />
          <h3 className="text-sm font-semibold text-white/60">My Bets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04] text-xs text-white/30">
                <th className="px-4 py-2.5 text-left font-medium">Round</th>
                <th className="px-4 py-2.5 text-right font-medium">Bet</th>
                <th className="px-4 py-2.5 text-right font-medium">Cash Out</th>
                <th className="px-4 py-2.5 text-right font-medium">Crash</th>
                <th className="px-4 py-2.5 text-right font-medium">P&L</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {myBets.slice(0, 20).map((bet) => {
                const pl = bet.profitLoss ? parseFloat(bet.profitLoss) : 0;
                return (
                  <tr key={bet.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-white/60">#{bet.round.roundNumber}</td>
                    <td className="px-4 py-2.5 text-right text-white tabular-nums">{formatCurrency(parseFloat(bet.amount))}</td>
                    <td className="px-4 py-2.5 text-right text-white/60 tabular-nums">
                      {bet.cashOutMultiplier ? `${parseFloat(bet.cashOutMultiplier).toFixed(2)}x` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-white/60 tabular-nums">
                      {parseFloat(bet.round.crashPoint).toFixed(2)}x
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', pl > 0 ? 'text-emerald-400' : pl < 0 ? 'text-red-400' : 'text-white/40')}>
                      {pl > 0 ? '+' : ''}{formatCurrency(pl)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold',
                        bet.status === 'CASHED_OUT' ? 'bg-emerald-500/15 text-emerald-400' :
                        bet.status === 'LOST' ? 'bg-red-500/15 text-red-400' :
                        'bg-yellow-500/15 text-yellow-400'
                      )}>
                        {bet.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {myBets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/30">No bets yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
