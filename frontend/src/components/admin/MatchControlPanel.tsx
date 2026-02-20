'use client';

import React, { useState, useCallback, memo } from 'react';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { useToastStore } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────

interface EventData {
  isActive: boolean;
  isBetLocked: boolean;
  isFancyLocked: boolean;
  minBet: number;
  maxBet: number;
  oddsDifference: number;
  matchType: string | null;
}

interface MatchControlPanelProps {
  cricketId: number;
  eventData: EventData;
  onUpdate?: () => void;
}

const MATCH_TYPES = ['ODI', 'T20', 'TEST'] as const;

// ── Toggle Switch ──────────────────────────────────────────

interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  loading: boolean;
  onToggle: () => void;
  activeColor?: string;
  icon: React.ReactNode;
}

const ToggleSwitch = memo(function ToggleSwitch({
  label,
  description,
  checked,
  loading,
  onToggle,
  activeColor = 'bg-emerald-500',
  icon,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all w-full text-left',
        'disabled:opacity-60',
        checked
          ? 'border-glass-border-light bg-glass-light'
          : 'border-glass-border bg-glass hover:bg-glass-light'
      )}
    >
      <div className={cn(
        'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
        checked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-glass-medium text-gray-500'
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-gray-200 block">{label}</span>
        {description && (
          <span className="text-[10px] text-gray-500 block">{description}</span>
        )}
      </div>
      <div className="flex-shrink-0">
        {loading ? (
          <div className="h-5 w-5 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
        ) : (
          <div className={cn(
            'relative h-6 w-11 rounded-full transition-colors duration-200',
            checked ? activeColor : 'bg-gray-600'
          )}>
            <span className={cn(
              'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
              checked ? 'translate-x-5' : 'translate-x-0'
            )} />
          </div>
        )}
      </div>
    </button>
  );
});

// ── Main Component ─────────────────────────────────────────

export const MatchControlPanel = memo(function MatchControlPanel({
  cricketId,
  eventData,
  onUpdate,
}: MatchControlPanelProps) {
  const [isActive, setIsActive] = useState(eventData.isActive);
  const [isBetLocked, setIsBetLocked] = useState(eventData.isBetLocked);
  const [isFancyLocked, setIsFancyLocked] = useState(eventData.isFancyLocked);
  const [minBet, setMinBet] = useState(eventData.minBet.toString());
  const [maxBet, setMaxBet] = useState(eventData.maxBet.toString());
  const [oddsDifference, setOddsDifference] = useState(eventData.oddsDifference.toString());
  const [matchType, setMatchType] = useState(eventData.matchType);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(true);

  const addToast = useToastStore((s) => s.addToast);

  const setLoading = useCallback((key: string, value: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleToggleActive = useCallback(async () => {
    setLoading('active', true);
    try {
      await api.put('/cricket/match-enable-disable', {
        cricketId,
        isActive: !isActive,
      });
      setIsActive(!isActive);
      addToast(`Match ${!isActive ? 'enabled' : 'disabled'} successfully`, 'success');
      onUpdate?.();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      addToast(error.response?.data?.message || 'Failed to update match status', 'error');
    } finally {
      setLoading('active', false);
    }
  }, [cricketId, isActive, addToast, onUpdate, setLoading]);

  const handleToggleBetLock = useCallback(async () => {
    setLoading('betLock', true);
    try {
      await api.put('/cricket/match-bet-lock', {
        cricketId,
        isBetLocked: !isBetLocked,
      });
      setIsBetLocked(!isBetLocked);
      addToast(`Bets ${!isBetLocked ? 'locked' : 'unlocked'} successfully`, 'success');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      addToast(error.response?.data?.message || 'Failed to update bet lock', 'error');
    } finally {
      setLoading('betLock', false);
    }
  }, [cricketId, isBetLocked, addToast, setLoading]);

  const handleToggleFancyLock = useCallback(async () => {
    setLoading('fancyLock', true);
    try {
      await api.put('/cricket/match-bet-lock', {
        cricketId,
        isFancyLocked: !isFancyLocked,
      });
      setIsFancyLocked(!isFancyLocked);
      addToast(`Fancy ${!isFancyLocked ? 'locked' : 'unlocked'} successfully`, 'success');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      addToast(error.response?.data?.message || 'Failed to update fancy lock', 'error');
    } finally {
      setLoading('fancyLock', false);
    }
  }, [cricketId, isFancyLocked, addToast, setLoading]);

  const handleUpdateBetLimits = useCallback(async () => {
    const min = parseFloat(minBet);
    const max = parseFloat(maxBet);

    if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
      addToast('Please enter valid bet limits', 'error');
      return;
    }
    if (min > max) {
      addToast('Minimum bet cannot exceed maximum bet', 'error');
      return;
    }

    setLoading('betLimits', true);
    try {
      await api.put('/cricket/match-max-min-bet', {
        cricketId,
        minBet: min,
        maxBet: max,
      });
      addToast('Bet limits updated successfully', 'success');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      addToast(error.response?.data?.message || 'Failed to update bet limits', 'error');
    } finally {
      setLoading('betLimits', false);
    }
  }, [cricketId, minBet, maxBet, addToast, setLoading]);

  const handleUpdateOddsDifference = useCallback(async () => {
    const diff = parseFloat(oddsDifference);
    if (isNaN(diff) || diff < 0) {
      addToast('Please enter a valid odds difference', 'error');
      return;
    }

    setLoading('oddsDiff', true);
    try {
      await api.put('/cricket/odds-difference', {
        cricketId,
        oddsDifference: diff,
      });
      addToast('Odds difference updated successfully', 'success');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      addToast(error.response?.data?.message || 'Failed to update odds difference', 'error');
    } finally {
      setLoading('oddsDiff', false);
    }
  }, [cricketId, oddsDifference, addToast, setLoading]);

  const handleUpdateMatchType = useCallback(async (type: string) => {
    setLoading('matchType', true);
    try {
      await api.put('/cricket/match-type', {
        cricketId,
        matchType: type,
      });
      setMatchType(type);
      addToast(`Match type set to ${type}`, 'success');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      addToast(error.response?.data?.message || 'Failed to update match type', 'error');
    } finally {
      setLoading('matchType', false);
    }
  }, [cricketId, addToast, setLoading]);

  return (
    <div className="sticky top-0 z-30">
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-glass to-amber-500/5 backdrop-blur-xl shadow-glass overflow-hidden">
        {/* Header toolbar */}
        <button
          onClick={() => setIsExpanded(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-glass-light transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-amber-300">Admin Controls</span>

            {/* Quick status indicators */}
            <div className="flex items-center gap-1.5 ml-3">
              <span className={cn(
                'h-2 w-2 rounded-full',
                isActive ? 'bg-emerald-400' : 'bg-gray-600'
              )} title={isActive ? 'Active' : 'Inactive'} />
              <span className={cn(
                'h-2 w-2 rounded-full',
                isBetLocked ? 'bg-red-400' : 'bg-emerald-400'
              )} title={isBetLocked ? 'Bets Locked' : 'Bets Open'} />
              <span className={cn(
                'h-2 w-2 rounded-full',
                isFancyLocked ? 'bg-red-400' : 'bg-emerald-400'
              )} title={isFancyLocked ? 'Fancy Locked' : 'Fancy Open'} />
            </div>
          </div>

          <svg
            className={cn(
              'w-4 h-4 text-gray-500 transition-transform duration-200',
              isExpanded ? 'rotate-180' : ''
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Expandable content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-glass-border animate-slide-up">
            {/* Toggle controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
              <ToggleSwitch
                label="Match Active"
                description={isActive ? 'Active' : 'Inactive'}
                checked={isActive}
                loading={loadingStates.active || false}
                onToggle={handleToggleActive}
                activeColor="bg-emerald-500"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
              />
              <ToggleSwitch
                label="Bet Lock"
                description={isBetLocked ? 'Locked' : 'Unlocked'}
                checked={isBetLocked}
                loading={loadingStates.betLock || false}
                onToggle={handleToggleBetLock}
                activeColor="bg-red-500"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                }
              />
              <ToggleSwitch
                label="Fancy Lock"
                description={isFancyLocked ? 'Locked' : 'Unlocked'}
                checked={isFancyLocked}
                loading={loadingStates.fancyLock || false}
                onToggle={handleToggleFancyLock}
                activeColor="bg-red-500"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                }
              />
            </div>

            {/* Bet limits and odds difference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Bet Limits */}
              <div className="rounded-xl border border-glass-border bg-glass-light p-3 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Bet Limits
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Min"
                    type="number"
                    min="0"
                    value={minBet}
                    onChange={(e) => setMinBet(e.target.value)}
                    placeholder="0"
                    className="text-xs py-1.5"
                  />
                  <Input
                    label="Max"
                    type="number"
                    min="0"
                    value={maxBet}
                    onChange={(e) => setMaxBet(e.target.value)}
                    placeholder="0"
                    className="text-xs py-1.5"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUpdateBetLimits}
                  disabled={loadingStates.betLimits}
                  className={cn(
                    'w-full py-1.5 rounded-lg text-xs font-semibold transition-all',
                    'bg-back/20 text-back-light hover:bg-back/30 border border-back/20',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {loadingStates.betLimits ? 'Saving...' : 'Update Limits'}
                </button>
              </div>

              {/* Odds Difference */}
              <div className="rounded-xl border border-glass-border bg-glass-light p-3 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Odds Difference
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={oddsDifference}
                  onChange={(e) => setOddsDifference(e.target.value)}
                  placeholder="0"
                  className="text-xs py-1.5"
                />
                <button
                  type="button"
                  onClick={handleUpdateOddsDifference}
                  disabled={loadingStates.oddsDiff}
                  className={cn(
                    'w-full py-1.5 rounded-lg text-xs font-semibold transition-all',
                    'bg-back/20 text-back-light hover:bg-back/30 border border-back/20',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {loadingStates.oddsDiff ? 'Saving...' : 'Update Odds Diff'}
                </button>
              </div>
            </div>

            {/* Match Type */}
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Match Type
              </span>
              <div className="grid grid-cols-3 gap-2">
                {MATCH_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleUpdateMatchType(type)}
                    disabled={loadingStates.matchType || false}
                    className={cn(
                      'rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all',
                      'disabled:opacity-50 active:scale-95',
                      matchType === type
                        ? 'border-accent/40 bg-accent/15 text-accent-light shadow-glow-purple'
                        : 'border-glass-border bg-glass-light text-gray-400 hover:border-glass-border-light hover:text-gray-300'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
