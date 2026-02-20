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
  back: PriceSize[];
  lay: PriceSize[];
  status: string;
}

interface OddsLadderProps {
  runners: Runner[];
  marketStatus?: string;
  onSelect: (selectionId: number, type: 'BACK' | 'LAY', price: number) => void;
}

// ── Helpers ────────────────────────────────────────────────

function formatSize(size: number): string {
  if (size >= 10000000) return `${(size / 10000000).toFixed(1)}Cr`;
  if (size >= 100000) return `${(size / 100000).toFixed(1)}L`;
  if (size >= 1000) return `${(size / 1000).toFixed(1)}K`;
  return size.toFixed(0);
}

function getBackPrices(back: PriceSize[]): (PriceSize | null)[] {
  // Best back = highest price, displayed closest to center
  // Column order: [worst, mid, best] -> visual: left to right toward center
  const sorted = [...back].filter(p => p.price > 0).sort((a, b) => b.price - a.price);
  const result: (PriceSize | null)[] = [null, null, null];
  // index 0 = best (highest), index 1 = mid, index 2 = worst
  for (let i = 0; i < Math.min(3, sorted.length); i++) {
    result[i] = sorted[i];
  }
  // Reverse so best is rightmost (closest to center divider)
  return result.reverse();
}

function getLayPrices(lay: PriceSize[]): (PriceSize | null)[] {
  // Best lay = lowest price, displayed closest to center
  // Column order left to right: [best, mid, worst]
  const sorted = [...lay].filter(p => p.price > 0).sort((a, b) => a.price - b.price);
  const result: (PriceSize | null)[] = [null, null, null];
  for (let i = 0; i < Math.min(3, sorted.length); i++) {
    result[i] = sorted[i];
  }
  return result;
}

// ── Odds Cell ──────────────────────────────────────────────

const BACK_CLASSES = [
  'bg-back/20 hover:bg-back/30',     // worst (lightest)
  'bg-back/30 hover:bg-back/40',     // mid
  'bg-back/45 hover:bg-back/55',     // best (darkest, closest to center)
];

const LAY_CLASSES = [
  'bg-lay/45 hover:bg-lay/55',       // best (darkest, closest to center)
  'bg-lay/30 hover:bg-lay/40',       // mid
  'bg-lay/20 hover:bg-lay/30',       // worst (lightest)
];

interface OddsCellProps {
  ps: PriceSize | null;
  type: 'BACK' | 'LAY';
  depthIndex: number;
  disabled: boolean;
  onClick: () => void;
}

const OddsCell = memo(function OddsCell({ ps, type, depthIndex, disabled, onClick }: OddsCellProps) {
  const prevPriceRef = useRef<number>(0);
  const cellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const currentPrice = ps?.price || 0;
    const prevPrice = prevPriceRef.current;

    if (prevPrice > 0 && currentPrice > 0 && prevPrice !== currentPrice && cellRef.current) {
      const flashClass = currentPrice > prevPrice ? 'odds-up' : 'odds-down';
      cellRef.current.classList.remove('odds-up', 'odds-down');
      // Force reflow
      void cellRef.current.offsetWidth;
      cellRef.current.classList.add(flashClass);
      const timer = setTimeout(() => {
        cellRef.current?.classList.remove(flashClass);
      }, 600);
      prevPriceRef.current = currentPrice;
      return () => clearTimeout(timer);
    }

    prevPriceRef.current = currentPrice;
  }, [ps?.price]);

  const bgClass = type === 'BACK' ? BACK_CLASSES[depthIndex] : LAY_CLASSES[depthIndex];

  if (!ps || ps.price <= 0) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center rounded-lg py-2 px-1 min-w-[60px] lg:min-w-[72px] opacity-40',
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
        'flex flex-col items-center justify-center rounded-lg py-2 px-1 min-w-[60px] lg:min-w-[72px]',
        'transition-all duration-150 cursor-pointer',
        'active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
        bgClass
      )}
    >
      <span className="text-sm font-bold text-white leading-tight">
        {ps.price.toFixed(2)}
      </span>
      <span className="text-[9px] text-gray-300/80 leading-tight mt-0.5">
        {formatSize(ps.size)}
      </span>
    </button>
  );
});

// ── Runner Row ─────────────────────────────────────────────

interface RunnerRowProps {
  runner: Runner;
  isSuspended: boolean;
  onSelect: (selectionId: number, type: 'BACK' | 'LAY', price: number) => void;
  isFavorite: boolean;
}

const RunnerRow = memo(function RunnerRow({ runner, isSuspended, onSelect, isFavorite }: RunnerRowProps) {
  const backPrices = getBackPrices(runner.back);
  const layPrices = getLayPrices(runner.lay);

  const handleClick = useCallback(
    (type: 'BACK' | 'LAY', price: number) => {
      if (!isSuspended) {
        onSelect(runner.selectionId, type, price);
      }
    },
    [runner.selectionId, isSuspended, onSelect]
  );

  return (
    <div className="relative group">
      <div className={cn(
        'grid grid-cols-[1fr_repeat(6,minmax(60px,1fr))] lg:grid-cols-[1fr_repeat(6,minmax(72px,1fr))] gap-0.5 items-center py-1',
        'border-b border-glass-border/50 last:border-b-0'
      )}>
        {/* Runner name */}
        <div className="flex items-center gap-2 px-3 py-1 min-w-0">
          {isFavorite && (
            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          )}
          <span className="text-sm font-medium text-gray-200 truncate">
            {runner.runnerName}
          </span>
        </div>

        {/* Back cells (3 columns: worst to best, left to right) */}
        {backPrices.map((ps, idx) => (
          <OddsCell
            key={`back-${idx}`}
            ps={ps}
            type="BACK"
            depthIndex={idx}
            disabled={isSuspended}
            onClick={() => ps && ps.price > 0 && handleClick('BACK', ps.price)}
          />
        ))}

        {/* Lay cells (3 columns: best to worst, left to right) */}
        {layPrices.map((ps, idx) => (
          <OddsCell
            key={`lay-${idx}`}
            ps={ps}
            type="LAY"
            depthIndex={idx}
            disabled={isSuspended}
            onClick={() => ps && ps.price > 0 && handleClick('LAY', ps.price)}
          />
        ))}
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

export default function OddsLadder({ runners, marketStatus, onSelect }: OddsLadderProps) {
  // Find favorite: runner with lowest best-back price (most favored)
  const favoriteId = React.useMemo(() => {
    let minPrice = Infinity;
    let favId = -1;
    for (const r of runners) {
      const bestBack = r.back.filter(p => p.price > 0).sort((a, b) => b.price - a.price)[0];
      if (bestBack && bestBack.price < minPrice) {
        minPrice = bestBack.price;
        favId = r.selectionId;
      }
    }
    return favId;
  }, [runners]);

  const isMarketSuspended = marketStatus === 'SUSPENDED';

  return (
    <div className="w-full overflow-x-auto">
      {/* Header */}
      <div className="grid grid-cols-[1fr_repeat(6,minmax(60px,1fr))] lg:grid-cols-[1fr_repeat(6,minmax(72px,1fr))] gap-0.5 items-center mb-1">
        <div className="px-3">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Runner</span>
        </div>
        <div className="col-span-3 text-center">
          <span className="text-[10px] font-bold text-back uppercase tracking-wider">Back</span>
        </div>
        <div className="col-span-3 text-center">
          <span className="text-[10px] font-bold text-lay uppercase tracking-wider">Lay</span>
        </div>
      </div>

      {/* Runners */}
      <div className="relative">
        {runners.map((runner) => (
          <RunnerRow
            key={runner.selectionId}
            runner={runner}
            isSuspended={runner.status === 'SUSPENDED' || isMarketSuspended}
            onSelect={onSelect}
            isFavorite={runner.selectionId === favoriteId}
          />
        ))}

        {/* Full market suspend overlay */}
        {isMarketSuspended && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm rounded-lg z-20">
            <span className="bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest px-6 py-2 rounded-full border border-red-500/30">
              Market Suspended
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
