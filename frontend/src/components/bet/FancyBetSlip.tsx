'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────

interface FancySelection {
  marketId: string;
  marketName: string;
  type: 'YES' | 'NO';
  odds: number;
  rate: number;
}

interface FancyBetSlipProps {
  eventId: number;
  selection: FancySelection | null;
  onClose: () => void;
  onPlaced: () => void;
}

// ── Constants ──────────────────────────────────────────────

const CHIPS = [
  { value: 100, label: '100' },
  { value: 500, label: '500' },
  { value: 1000, label: '1K' },
  { value: 5000, label: '5K' },
  { value: 10000, label: '10K' },
  { value: 25000, label: '25K' },
  { value: 50000, label: '50K' },
  { value: 100000, label: '1L' },
];

// ── Helpers ────────────────────────────────────────────────

function formatIndian(num: number): string {
  if (num === 0) return '0';
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

// ── Component ──────────────────────────────────────────────

export default memo(function FancyBetSlip({ eventId, selection, onClose, onPlaced }: FancyBetSlipProps) {
  const { user } = useAuthStore();

  const [rate, setRate] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successAnim, setSuccessAnim] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selection) {
      setRate(selection.rate.toString());
      setAmount(0);
      setError(null);
      setSuccessAnim(false);
      setTimeout(() => amountInputRef.current?.focus(), 200);
    }
  }, [selection]);

  const parsedRate = parseFloat(rate) || 0;
  const isYes = selection?.type === 'YES';

  // Profit = (amount * rate) / 100
  const profit = amount > 0 && parsedRate > 0 ? (amount * parsedRate) / 100 : 0;
  const balance = user?.balance || 0;
  const exposure = user?.exposure || 0;
  const insufficientBalance = isYes ? amount > balance : profit > balance;

  const handleChipClick = useCallback((chipValue: number) => {
    setAmount(prev => prev + chipValue);
    setError(null);
  }, []);

  const handleClearAmount = useCallback(() => {
    setAmount(0);
    setError(null);
  }, []);

  const handleRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRate(e.target.value);
    setError(null);
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(e.target.value) || 0);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selection) return;

    if (parsedRate <= 0) {
      setError('Rate must be greater than 0');
      return;
    }
    if (amount <= 0) {
      setError('Please enter a valid stake amount');
      return;
    }
    if (insufficientBalance) {
      setError('Insufficient balance to place this bet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isYesBet = selection.type === 'YES';
      await api.post('/bet/fancy-place', {
        eventId,
        marketId: selection.marketId,
        marketName: selection.marketName,
        runnerName: selection.marketName,
        amount,
        ...(isYesBet
          ? { oddsBack: selection.odds, backRate: parsedRate }
          : { oddsLay: selection.odds, layRate: parsedRate }),
        profit,
        loss: amount,
      });

      setSuccessAnim(true);
      setTimeout(() => {
        setSuccessAnim(false);
        onPlaced();
      }, 1200);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string; message?: string } } };
      setError(axiosError.response?.data?.error || axiosError.response?.data?.message || 'Failed to place bet');
    } finally {
      setLoading(false);
    }
  }, [selection, parsedRate, amount, insufficientBalance, eventId, onPlaced]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && amount > 0 && parsedRate > 0) {
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }, [handleSubmit, onClose, loading, amount, parsedRate]);

  if (!selection) return null;

  return (
    <div
      onKeyDown={handleKeyDown}
      className={cn(
        'rounded-2xl border overflow-hidden shadow-glass-lg animate-slide-up relative',
        isYes
          ? 'border-back/30 bg-gradient-to-b from-back-surface to-[var(--color-card)]'
          : 'border-lay/30 bg-gradient-to-b from-lay-surface to-[var(--color-card)]'
      )}
    >
      {/* Success overlay */}
      {successAnim && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-2xl">
          <div className="flex flex-col items-center gap-2 animate-slide-up">
            <div className="h-14 w-14 rounded-full bg-profit/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-profit" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-profit">Bet Placed!</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3',
        isYes ? 'bg-back/15' : 'bg-lay/15'
      )}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            'text-[10px] font-bold uppercase px-2 py-0.5 rounded-md tracking-wider flex-shrink-0',
            isYes ? 'bg-back text-white' : 'bg-lay text-white'
          )}>
            {selection.type}
          </span>
          <span className="text-sm font-semibold text-white truncate">
            {selection.marketName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-glass-medium text-gray-400 hover:text-white transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Odds indicator */}
      <div className="px-4 pt-2">
        <span className="text-[10px] text-gray-500">
          Odds: <span className="text-gray-300 font-semibold">{selection.odds}</span>
        </span>
      </div>

      {/* Inputs */}
      <div className="px-4 pt-3 pb-2 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Rate input */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-medium">
              Rate
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={rate}
              onChange={handleRateChange}
              className={cn(
                'w-full rounded-lg border px-3 py-2.5 text-sm font-bold text-center text-white',
                'bg-glass-light focus:outline-none focus:ring-2 transition-all',
                isYes
                  ? 'border-back/30 focus:ring-back/50 focus:border-back'
                  : 'border-lay/30 focus:ring-lay/50 focus:border-lay'
              )}
            />
          </div>

          {/* Stake input */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-medium">
              Stake
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                &#8377;
              </span>
              <input
                ref={amountInputRef}
                type="number"
                min="0"
                value={amount || ''}
                onChange={handleAmountChange}
                placeholder="0"
                className={cn(
                  'w-full rounded-lg border px-3 py-2.5 text-sm font-bold text-center text-white pl-7',
                  'bg-glass-light focus:outline-none focus:ring-2 transition-all',
                  isYes
                    ? 'border-back/30 focus:ring-back/50 focus:border-back'
                    : 'border-lay/30 focus:ring-lay/50 focus:border-lay'
                )}
              />
            </div>
          </div>
        </div>

        {/* Quick bet chips */}
        <div className="grid grid-cols-4 gap-1.5">
          {CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => handleChipClick(chip.value)}
              className={cn(
                'rounded-lg py-2 text-xs font-semibold transition-all active:scale-95',
                'bg-glass-light hover:bg-glass-medium text-gray-300 hover:text-white',
                'border border-glass-border hover:border-glass-border-light'
              )}
            >
              +&#8377;{chip.label}
            </button>
          ))}
        </div>

        {amount > 0 && (
          <button
            onClick={handleClearAmount}
            className="w-full text-center text-[10px] text-gray-500 hover:text-red-400 transition-colors font-medium uppercase tracking-wider py-1"
          >
            Clear Stake
          </button>
        )}

        {/* Profit/Loss display */}
        {amount > 0 && parsedRate > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-profit-surface px-3 py-2 text-center">
              <span className="block text-[9px] text-gray-500 uppercase tracking-wider">Profit</span>
              <span className="text-sm font-bold text-profit">
                &#8377;{formatIndian(profit)}
              </span>
            </div>
            <div className="rounded-lg bg-loss-surface px-3 py-2 text-center">
              <span className="block text-[9px] text-gray-500 uppercase tracking-wider">Loss</span>
              <span className="text-sm font-bold text-loss">
                &#8377;{formatIndian(amount)}
              </span>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-loss-surface border border-loss/20 px-3 py-2 animate-slide-up">
            <p className="text-xs text-loss font-medium">{error}</p>
          </div>
        )}

        {/* Place bet button */}
        <button
          onClick={handleSubmit}
          disabled={loading || amount <= 0 || parsedRate <= 0 || insufficientBalance}
          className={cn(
            'w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'active:scale-[0.98] shadow-lg',
            isYes
              ? 'bg-gradient-to-r from-back to-back-dark text-white hover:shadow-glow-blue disabled:shadow-none'
              : 'bg-gradient-to-r from-lay to-lay-dark text-white hover:shadow-glow-red disabled:shadow-none'
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Placing...
            </span>
          ) : insufficientBalance ? (
            'Insufficient Balance'
          ) : (
            `Place ${selection.type} Bet`
          )}
        </button>

        {/* Balance info */}
        <div className="flex items-center justify-between text-[10px] text-gray-500 px-1">
          <span>
            Balance: <span className="text-gray-300 font-medium">&#8377;{formatIndian(balance)}</span>
          </span>
          <span>
            Exposure: <span className="text-amber-400 font-medium">&#8377;{formatIndian(Math.abs(exposure))}</span>
          </span>
        </div>
      </div>
    </div>
  );
});
