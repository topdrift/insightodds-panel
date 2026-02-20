'use client';

import React, { useRef, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────

interface PriceSize {
  price: number;
  size: number;
}

interface Runner {
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
  runners: Runner[];
}

interface BookmakerOddsProps {
  markets: BookmakerMarket[];
  onSelect: (selectionId: number, type: 'BACK' | 'LAY', price: number, marketId: string) => void;
}

// ── Helpers ────────────────────────────────────────────────

function formatSize(size: number): string {
  if (size >= 10000000) return `${(size / 10000000).toFixed(1)}Cr`;
  if (size >= 100000) return `${(size / 100000).toFixed(1)}L`;
  if (size >= 1000) return `${(size / 1000).toFixed(1)}K`;
  return size.toFixed(0);
}

// ── Single Odds Cell ───────────────────────────────────────

interface BookCellProps {
  price: number;
  size: number;
  type: 'BACK' | 'LAY';
  disabled: boolean;
  onClick: () => void;
}

const BookCell = memo(function BookCell({ price, size, type, disabled, onClick }: BookCellProps) {
  const prevPriceRef = useRef<number>(0);
  const cellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prevPrice = prevPriceRef.current;
    if (prevPrice > 0 && price > 0 && prevPrice !== price && cellRef.current) {
      const flashClass = price > prevPrice ? 'odds-up' : 'odds-down';
      cellRef.current.classList.remove('odds-up', 'odds-down');
      void cellRef.current.offsetWidth;
      cellRef.current.classList.add(flashClass);
      const timer = setTimeout(() => {
        cellRef.current?.classList.remove(flashClass);
      }, 600);
      prevPriceRef.current = price;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = price;
  }, [price]);

  if (price <= 0) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center rounded-lg py-2.5 px-3 min-w-[80px] opacity-40',
        type === 'BACK' ? 'bg-back/10' : 'bg-lay/10'
      )}>
        <span className="text-xs font-medium text-gray-600">-</span>
        <span className="text-[9px] text-gray-600">-</span>
      </div>
    );
  }

  return (
    <button
      ref={cellRef}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg py-2.5 px-3 min-w-[80px]',
        'transition-all duration-150 cursor-pointer',
        'active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
        type === 'BACK'
          ? 'bg-back/35 hover:bg-back/50'
          : 'bg-lay/35 hover:bg-lay/50'
      )}
    >
      <span className="text-sm font-bold text-white leading-tight">
        {price.toFixed(2)}
      </span>
      <span className="text-[9px] text-gray-300/80 leading-tight mt-0.5">
        {formatSize(size)}
      </span>
    </button>
  );
});

// ── Bookmaker Runner Row ───────────────────────────────────

interface BookRunnerRowProps {
  runner: Runner;
  marketId: string;
  isSuspended: boolean;
  onSelect: (selectionId: number, type: 'BACK' | 'LAY', price: number, marketId: string) => void;
}

const BookRunnerRow = memo(function BookRunnerRow({ runner, marketId, isSuspended, onSelect }: BookRunnerRowProps) {
  const handleBackClick = useCallback(() => {
    if (!isSuspended && runner.back && runner.back.price > 0) {
      onSelect(runner.selectionId, 'BACK', runner.back.price, marketId);
    }
  }, [runner.selectionId, runner.back, marketId, isSuspended, onSelect]);

  const handleLayClick = useCallback(() => {
    if (!isSuspended && runner.lay && runner.lay.price > 0) {
      onSelect(runner.selectionId, 'LAY', runner.lay.price, marketId);
    }
  }, [runner.selectionId, runner.lay, marketId, isSuspended, onSelect]);

  return (
    <div className="relative">
      <div className={cn(
        'grid grid-cols-[1fr_minmax(80px,120px)_minmax(80px,120px)] gap-0.5 items-center py-1',
        'border-b border-glass-border/50 last:border-b-0'
      )}>
        {/* Runner name */}
        <div className="px-3 py-1">
          <span className="text-sm font-medium text-gray-200 truncate block">
            {runner.runnerName}
          </span>
        </div>

        {/* Back cell */}
        <BookCell
          price={runner.back?.price || 0}
          size={runner.back?.size || 0}
          type="BACK"
          disabled={isSuspended}
          onClick={handleBackClick}
        />

        {/* Lay cell */}
        <BookCell
          price={runner.lay?.price || 0}
          size={runner.lay?.size || 0}
          type="LAY"
          disabled={isSuspended}
          onClick={handleLayClick}
        />
      </div>

      {/* Suspended overlay */}
      {isSuspended && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 backdrop-blur-[2px] rounded-lg z-10">
          <span className="bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border border-red-500/30">
            Suspended
          </span>
        </div>
      )}
    </div>
  );
});

// ── Main Component ─────────────────────────────────────────

export default function BookmakerOdds({ markets, onSelect }: BookmakerOddsProps) {
  return (
    <div className="space-y-3">
      {markets.map((market) => (
        <div
          key={market.marketId}
          className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <h3 className="text-sm font-semibold text-white">
                {market.marketName || 'Bookmaker'}
              </h3>
            </div>
            {market.status === 'SUSPENDED' && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                Suspended
              </span>
            )}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_minmax(80px,120px)_minmax(80px,120px)] gap-0.5 items-center px-0 py-1">
            <div className="px-3">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Runner</span>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-bold text-back uppercase tracking-wider">Back</span>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-bold text-lay uppercase tracking-wider">Lay</span>
            </div>
          </div>

          {/* Runners */}
          <div className="px-0 pb-1">
            {(market.runners || []).map((runner) => (
              <BookRunnerRow
                key={runner.selectionId}
                runner={runner}
                marketId={market.marketId}
                isSuspended={runner.status === 'SUSPENDED' || market.status === 'SUSPENDED'}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
