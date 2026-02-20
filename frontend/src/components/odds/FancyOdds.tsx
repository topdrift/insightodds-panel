'use client';

import React, { useRef, useEffect, useCallback, memo, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────

interface FancyMarket {
  marketId: string;
  marketName: string;
  runnerName: string;
  back: number;
  backSize: number;
  lay: number;
  laySize: number;
  status: string;
  gameType: string | null;
  maxLimit: number | null;
}

interface FancyOddsProps {
  markets: FancyMarket[];
  onSelect: (marketId: string, type: 'YES' | 'NO', odds: number, rate: number) => void;
}

// ── Helpers ────────────────────────────────────────────────

function formatSize(size: number): string {
  if (size >= 10000000) return `${(size / 10000000).toFixed(1)}Cr`;
  if (size >= 100000) return `${(size / 100000).toFixed(1)}L`;
  if (size >= 1000) return `${(size / 1000).toFixed(1)}K`;
  return size.toFixed(0);
}

function isBallRunning(status: string): boolean {
  const s = (status || '').toUpperCase().replace(/[_ ]/g, '');
  return s === 'BALLRUNNING';
}

function getGameTypeLabel(gameType: string | null): string {
  if (!gameType) return '';
  const gt = gameType.toUpperCase();
  if (gt.includes('NORMAL') || gt.includes('MATCH')) return 'Match';
  if (gt.includes('OVER') || gt.includes('SESSION')) return 'Session';
  if (gt.includes('BALL') || gt.includes('ONLY')) return 'Ball';
  if (gt.includes('ODD') || gt.includes('EVEN')) return 'Odd/Even';
  if (gt.includes('KHADO') || gt.includes('KHADDA')) return 'Khado';
  if (gt.includes('ADVANCE') || gt.includes('ADV')) return 'Advance';
  return gameType;
}

function getGameTypeColor(gameType: string | null): string {
  if (!gameType) return 'text-gray-500 bg-gray-500/10';
  const gt = gameType.toUpperCase();
  if (gt.includes('NORMAL') || gt.includes('MATCH')) return 'text-emerald-400 bg-emerald-500/10';
  if (gt.includes('OVER') || gt.includes('SESSION')) return 'text-blue-400 bg-blue-500/10';
  if (gt.includes('BALL') || gt.includes('ONLY')) return 'text-violet-400 bg-violet-500/10';
  if (gt.includes('ODD') || gt.includes('EVEN')) return 'text-amber-400 bg-amber-500/10';
  return 'text-gray-400 bg-gray-500/10';
}

// ── Fancy Cell ─────────────────────────────────────────────

interface FancyCellProps {
  odds: number;
  size: number;
  type: 'YES' | 'NO';
  disabled: boolean;
  onClick: () => void;
}

const FancyCell = memo(function FancyCell({ odds, size, type, disabled, onClick }: FancyCellProps) {
  const prevOddsRef = useRef<number>(0);
  const cellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = prevOddsRef.current;
    if (prev > 0 && odds > 0 && prev !== odds && cellRef.current) {
      const flashClass = odds > prev ? 'odds-up' : 'odds-down';
      cellRef.current.classList.remove('odds-up', 'odds-down');
      void cellRef.current.offsetWidth;
      cellRef.current.classList.add(flashClass);
      const timer = setTimeout(() => {
        cellRef.current?.classList.remove(flashClass);
      }, 600);
      prevOddsRef.current = odds;
      return () => clearTimeout(timer);
    }
    prevOddsRef.current = odds;
  }, [odds]);

  if (odds <= 0) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center rounded-lg py-2.5 px-3 min-w-[80px] opacity-40',
        type === 'NO' ? 'bg-lay/10' : 'bg-back/10'
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
        type === 'NO'
          ? 'bg-lay/35 hover:bg-lay/50'
          : 'bg-back/35 hover:bg-back/50'
      )}
    >
      <span className="text-sm font-bold text-white leading-tight">{odds}</span>
      <span className="text-[9px] text-gray-300/80 leading-tight mt-0.5">
        {formatSize(size)}
      </span>
    </button>
  );
});

// ── Fancy Row ──────────────────────────────────────────────

interface FancyRowProps {
  market: FancyMarket;
  onSelect: (marketId: string, type: 'YES' | 'NO', odds: number, rate: number) => void;
}

const FancyRow = memo(function FancyRow({ market, onSelect }: FancyRowProps) {
  const ballRun = isBallRunning(market.status);
  const suspended = market.status === 'SUSPENDED';
  const showOverlay = ballRun || suspended;

  const handleNoClick = useCallback(() => {
    if (!showOverlay && market.lay > 0) {
      onSelect(market.marketId, 'NO', market.lay, market.laySize);
    }
  }, [market.marketId, market.lay, market.laySize, showOverlay, onSelect]);

  const handleYesClick = useCallback(() => {
    if (!showOverlay && market.back > 0) {
      onSelect(market.marketId, 'YES', market.back, market.backSize);
    }
  }, [market.marketId, market.back, market.backSize, showOverlay, onSelect]);

  return (
    <div className="relative">
      <div className={cn(
        'grid grid-cols-[1fr_minmax(80px,120px)_minmax(80px,120px)] gap-0.5 items-center py-1',
        'border-b border-glass-border/50 last:border-b-0'
      )}>
        {/* Market name */}
        <div className="px-3 py-1 min-w-0">
          <span className="text-sm font-medium text-gray-200 truncate block">
            {market.runnerName || market.marketName}
          </span>
          {market.gameType && (
            <span className={cn(
              'text-[9px] font-medium uppercase tracking-wider rounded-full px-1.5 py-0.5 mt-0.5 inline-block',
              getGameTypeColor(market.gameType)
            )}>
              {getGameTypeLabel(market.gameType)}
            </span>
          )}
        </div>

        {/* NO cell (lay - pink) */}
        <FancyCell
          odds={market.lay}
          size={market.laySize}
          type="NO"
          disabled={showOverlay}
          onClick={handleNoClick}
        />

        {/* YES cell (back - blue) */}
        <FancyCell
          odds={market.back}
          size={market.backSize}
          type="YES"
          disabled={showOverlay}
          onClick={handleYesClick}
        />
      </div>

      {/* Ball Running / Suspended overlay */}
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 backdrop-blur-[2px] rounded-lg z-10">
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border',
            ballRun
              ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
              : 'text-red-400 bg-red-500/15 border-red-500/30'
          )}>
            {ballRun ? 'Ball Running' : 'Suspended'}
          </span>
        </div>
      )}
    </div>
  );
});

// ── Main Component ─────────────────────────────────────────

export default function FancyOdds({ markets, onSelect }: FancyOddsProps) {
  const [activeTab, setActiveTab] = useState<string>('ALL');

  // Group markets by game type
  const groups = useMemo(() => {
    const groupMap: Record<string, FancyMarket[]> = {};
    const types = new Set<string>();

    for (const m of markets) {
      const key = m.gameType || 'Other';
      types.add(key);
      if (!groupMap[key]) groupMap[key] = [];
      groupMap[key].push(m);
    }

    return { groupMap, types: Array.from(types) };
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    if (activeTab === 'ALL') return markets;
    return groups.groupMap[activeTab] || [];
  }, [activeTab, markets, groups.groupMap]);

  const showTabs = groups.types.length > 1;

  return (
    <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-glass-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-violet-400" />
            <h3 className="text-sm font-semibold text-white">Fancy</h3>
            <span className="text-[10px] text-gray-500 bg-glass-medium rounded-full px-2 py-0.5">
              {markets.length}
            </span>
          </div>
        </div>

        {/* Game type tabs */}
        {showTabs && (
          <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveTab('ALL')}
              className={cn(
                'text-[10px] font-medium uppercase tracking-wider px-3 py-1 rounded-full transition-all whitespace-nowrap',
                activeTab === 'ALL'
                  ? 'bg-accent/20 text-accent-light border border-accent/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-glass-light'
              )}
            >
              All ({markets.length})
            </button>
            {groups.types.map((type) => (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={cn(
                  'text-[10px] font-medium uppercase tracking-wider px-3 py-1 rounded-full transition-all whitespace-nowrap',
                  activeTab === type
                    ? 'bg-accent/20 text-accent-light border border-accent/30'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-glass-light'
                )}
              >
                {getGameTypeLabel(type)} ({groups.groupMap[type]?.length || 0})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_minmax(80px,120px)_minmax(80px,120px)] gap-0.5 items-center px-0 py-1">
        <div className="px-3">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Session</span>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-bold text-lay uppercase tracking-wider">No</span>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-bold text-back uppercase tracking-wider">Yes</span>
        </div>
      </div>

      {/* Market rows */}
      <div className="pb-1 max-h-[600px] overflow-y-auto">
        {filteredMarkets.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No fancy markets available</p>
          </div>
        ) : (
          filteredMarkets.map((market) => (
            <FancyRow key={market.marketId} market={market} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
}
