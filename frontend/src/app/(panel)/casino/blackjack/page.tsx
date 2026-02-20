'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { Spade, ArrowLeft, Loader2, History } from 'lucide-react';
import Link from 'next/link';

interface Card {
  rank: string;
  suit: string;
  value: number;
}

interface HandState {
  playerCards: Card[];
  dealerCards: Card[];
  playerScore: number;
  dealerScore: number;
  result?: 'WIN' | 'LOSE' | 'PUSH' | 'BLACKJACK' | 'BUST';
  isComplete: boolean;
  payout?: number;
}

interface HistoryEntry {
  id: string;
  amount: string;
  playerCards: Card[];
  playerScore: number;
  profitLoss: string | null;
  status: string;
  actions: string[];
  createdAt: string;
  round: { roundNumber: number; dealerCards: Card[]; dealerScore: number };
}

const CHIPS = [100, 500, 1000, 5000, 10000];

const suitSymbols: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const suitColors: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-white',
  spades: 'text-white',
};

function CardComponent({ card, faceDown }: { card: Card; faceDown?: boolean }) {
  if (faceDown || card.rank === '?') {
    return (
      <div className="flex h-[100px] w-[70px] flex-shrink-0 items-center justify-center rounded-xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-900 to-blue-700 shadow-lg">
        <div className="text-2xl text-blue-300/60">?</div>
      </div>
    );
  }

  const color = suitColors[card.suit] || 'text-white';
  const symbol = suitSymbols[card.suit] || '';

  return (
    <div className="flex h-[100px] w-[70px] flex-shrink-0 flex-col items-center justify-between rounded-xl border border-white/20 bg-white p-1.5 shadow-lg">
      <div className={cn('self-start text-xs font-bold', color === 'text-white' ? 'text-gray-900' : color)}>
        {card.rank}
      </div>
      <div className={cn('text-2xl', color === 'text-white' ? 'text-gray-900' : color)}>
        {symbol}
      </div>
      <div className={cn('self-end text-xs font-bold rotate-180', color === 'text-white' ? 'text-gray-900' : color)}>
        {card.rank}
      </div>
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      <span className="rounded-lg bg-white/10 px-2.5 py-1 text-sm font-bold text-white tabular-nums">
        {score}
      </span>
    </div>
  );
}

const resultConfig: Record<string, { text: string; color: string; bg: string }> = {
  WIN: { text: 'You Win!', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  BLACKJACK: { text: 'Blackjack!', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  LOSE: { text: 'You Lose', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  BUST: { text: 'Bust!', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  PUSH: { text: 'Push', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
};

export default function BlackjackPage() {
  const [betAmount, setBetAmount] = useState(1000);
  const [hand, setHand] = useState<HandState | null>(null);
  const [currentBetId, setCurrentBetId] = useState<string | null>(null);
  const [handHistory, setHandHistory] = useState<HistoryEntry[]>([]);
  const [dealing, setDealing] = useState(false);
  const [acting, setActing] = useState(false);
  // Load history on first render
  useState(() => {
    api.get('/casino/blackjack/history').then((r) => {
      setHandHistory(r.data);
    }).catch(() => {});
  });

  const deal = async () => {
    if (dealing) return;
    setDealing(true);
    setHand(null);
    try {
      const { data } = await api.post('/casino/blackjack/deal', { amount: betAmount });
      if (data.success && data.hand) {
        setHand(data.hand);
        if (data.betId) {
          setCurrentBetId(data.betId);
        }
        if (data.hand.isComplete) {
          setCurrentBetId(null);
        }
        const betsRes = await api.get('/casino/blackjack/history');
        setHandHistory(betsRes.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to deal');
    } finally {
      setDealing(false);
    }
  };

  const doAction = async (action: 'hit' | 'stand' | 'double') => {
    if (!currentBetId || acting) return;
    setActing(true);
    try {
      const { data } = await api.post(`/casino/blackjack/${action}`, { betId: currentBetId });
      if (data.success && data.hand) {
        setHand(data.hand);
        if (data.hand.isComplete) {
          setCurrentBetId(null);
          // Refresh history
          const betsRes = await api.get('/casino/blackjack/history');
          setHandHistory(betsRes.data);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setActing(false);
    }
  };

  const canDouble = hand && !hand.isComplete && hand.playerCards.length === 2;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/casino" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Spade className="h-5 w-5 text-emerald-400" /> Blackjack
          </h1>
          <p className="text-xs text-white/40">Beat the dealer to 21</p>
        </div>
      </div>

      {/* Game Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-emerald-900/20 to-emerald-950/30 backdrop-blur-xl p-6 space-y-8" style={{ minHeight: 400 }}>
        {/* Dealer Area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 uppercase tracking-wider">Dealer</span>
            {hand && <ScoreBadge score={hand.isComplete ? hand.dealerScore : (hand.dealerCards[0]?.value || 0)} label="" />}
          </div>
          <div className="flex gap-3 min-h-[100px]">
            {hand ? (
              hand.dealerCards.map((card, i) => (
                <CardComponent key={i} card={card} />
              ))
            ) : (
              <>
                <div className="h-[100px] w-[70px] rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02]" />
                <div className="h-[100px] w-[70px] rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02]" />
              </>
            )}
          </div>
        </div>

        {/* Result Overlay */}
        {hand?.isComplete && hand.result && (
          <div className={cn('flex items-center justify-center rounded-xl border py-4', resultConfig[hand.result]?.bg || '')}>
            <div className="text-center">
              <p className={cn('text-3xl font-black', resultConfig[hand.result]?.color || 'text-white')}>
                {resultConfig[hand.result]?.text || hand.result}
              </p>
              {hand.payout !== undefined && hand.payout > 0 && (
                <p className="mt-1 text-sm text-white/60">
                  Payout: {formatCurrency(hand.payout)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Player Area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 uppercase tracking-wider">Your Hand</span>
            {hand && <ScoreBadge score={hand.playerScore} label="" />}
          </div>
          <div className="flex gap-3 min-h-[100px]">
            {hand ? (
              hand.playerCards.map((card, i) => (
                <CardComponent key={i} card={card} />
              ))
            ) : (
              <>
                <div className="h-[100px] w-[70px] rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02]" />
                <div className="h-[100px] w-[70px] rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02]" />
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {hand && !hand.isComplete && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => doAction('hit')}
              disabled={acting}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'HIT'}
            </button>
            <button
              onClick={() => doAction('stand')}
              disabled={acting}
              className="flex-1 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30 transition-all disabled:opacity-50"
            >
              STAND
            </button>
            {canDouble && (
              <button
                onClick={() => doAction('double')}
                disabled={acting}
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                DOUBLE
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bet + Deal Controls */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
          {hand?.isComplete ? 'New Hand' : 'Place Bet'}
        </h3>

        {/* Amount Input */}
        <div>
          <label className="text-xs text-white/40 mb-1 block">Bet Amount</label>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-white text-lg font-bold tabular-nums outline-none focus:border-white/20 transition-colors"
            disabled={hand !== null && !hand.isComplete}
          />
        </div>

        {/* Quick Chips */}
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setBetAmount(chip)}
              disabled={hand !== null && !hand.isComplete}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                betAmount === chip
                  ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                  : 'border-white/[0.06] bg-white/[0.03] text-white/60 hover:bg-white/[0.06]',
                (hand !== null && !hand.isComplete) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {chip >= 1000 ? `${chip / 1000}K` : chip}
            </button>
          ))}
        </div>

        {/* Deal Button */}
        <button
          onClick={deal}
          disabled={dealing || betAmount <= 0 || (hand !== null && !hand.isComplete)}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
        >
          {dealing ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          ) : (
            `Deal - ${formatCurrency(betAmount)}`
          )}
        </button>
      </div>

      {/* Hand History */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
          <History className="h-4 w-4 text-white/40" />
          <h3 className="text-sm font-semibold text-white/60">Recent Hands</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04] text-xs text-white/30">
                <th className="px-4 py-2.5 text-left font-medium">Hand</th>
                <th className="px-4 py-2.5 text-right font-medium">Bet</th>
                <th className="px-4 py-2.5 text-center font-medium">Player</th>
                <th className="px-4 py-2.5 text-center font-medium">Dealer</th>
                <th className="px-4 py-2.5 text-right font-medium">P&L</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {handHistory.slice(0, 20).map((h) => {
                const pl = h.profitLoss ? parseFloat(h.profitLoss) : 0;
                return (
                  <tr key={h.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-white/60">#{h.round.roundNumber}</td>
                    <td className="px-4 py-2.5 text-right text-white tabular-nums">{formatCurrency(parseFloat(h.amount))}</td>
                    <td className="px-4 py-2.5 text-center text-white/60 tabular-nums">{h.playerScore}</td>
                    <td className="px-4 py-2.5 text-center text-white/60 tabular-nums">{h.round.dealerScore}</td>
                    <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', pl > 0 ? 'text-emerald-400' : pl < 0 ? 'text-red-400' : 'text-white/40')}>
                      {pl > 0 ? '+' : ''}{formatCurrency(pl)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold',
                        h.status === 'WON' ? 'bg-emerald-500/15 text-emerald-400' :
                        h.status === 'LOST' ? 'bg-red-500/15 text-red-400' :
                        'bg-blue-500/15 text-blue-400'
                      )}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {handHistory.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/30">No hands played yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
