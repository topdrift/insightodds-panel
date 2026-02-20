import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import { EventEmitter } from 'events';

// ─── TYPES ─────────────────────────────────────────────────

export interface AutomationRule {
  id: string;
  name: string;
  type: 'ODDS_MANIPULATION' | 'LIABILITY_THRESHOLD' | 'BET_DELAY' | 'SHARP_DETECTION' | 'AUTO_LOCK' | 'MARGIN_CONTROL';
  config: any;
  isActive: boolean;
  createdAt: Date;
}

export interface LiabilityRunner {
  selectionId: number;
  runnerName: string;
  backExposure: number;
  layExposure: number;
  netExposure: number;
  potentialLoss: number;
  potentialProfit: number;
}

export interface LiabilityResult {
  runners: LiabilityRunner[];
  totalExposure: number;
  worstCase: number;
  bestCase: number;
}

export interface RiskAlert {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;
  message: string;
  eventId?: string;
  userId?: string;
  amount?: number;
  timestamp: Date;
}

export interface SharpBettorInfo {
  userId: string;
  username: string;
  winRate: number;
  totalBets: number;
  netPL: number;
  recommendation: string;
}

// ─── ENGINE ────────────────────────────────────────────────

class AutomationEngine extends EventEmitter {
  private rules: AutomationRule[] = [];
  private liabilityCache: Map<string, { matchExposure: number; fancyExposure: number; timestamp: number }> = new Map();
  private userWinRates: Map<string, { wins: number; total: number; lastUpdated: number }> = new Map();
  private betDelayMs: number = 0;

  // ─── INITIALIZE ──────────────────────────────────────────

  async initialize(): Promise<void> {
    try {
      // Load all active rules from DB
      const dbRules = await prisma.automationRule.findMany({
        where: { isActive: true },
      });

      this.rules = dbRules.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type as AutomationRule['type'],
        config: r.config,
        isActive: r.isActive,
        createdAt: r.createdAt,
      }));

      // Load global bet delay from system settings
      const delaySetting = await prisma.systemSettings.findUnique({
        where: { key: 'global_bet_delay_ms' },
      });
      if (delaySetting) {
        this.betDelayMs = (delaySetting.value as any)?.value ?? 0;
      }

      // Pre-warm user win rate cache
      await this._warmUserWinRateCache();

      console.log(`Automation engine initialized with ${this.rules.length} active rules`);
    } catch (err: any) {
      console.error('Automation engine init error:', err.message);
    }
  }

  // ─── RULE MANAGEMENT ─────────────────────────────────────

  async reloadRules(): Promise<void> {
    const dbRules = await prisma.automationRule.findMany({
      where: { isActive: true },
    });

    this.rules = dbRules.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as AutomationRule['type'],
      config: r.config,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
  }

  getRules(): AutomationRule[] {
    return [...this.rules];
  }

  getActiveRulesByType(type: AutomationRule['type']): AutomationRule[] {
    return this.rules.filter((r) => r.type === type && r.isActive);
  }

  // ─── ODDS MANIPULATION ───────────────────────────────────

  /**
   * Apply odds manipulation based on liability.
   * Shifts odds to attract bets on the less-exposed side.
   *
   * @param odds - The raw odds object (e.g. { runners: [{ selectionId, back, lay }] })
   * @param eventId - The cricketId (numeric)
   * @returns Modified odds with shifts applied
   */
  applyOddsManipulation(odds: any, eventId: number): any {
    const manipRules = this.getActiveRulesByType('ODDS_MANIPULATION');
    if (manipRules.length === 0 || !odds) return odds;

    // Clone to avoid mutating original
    const modified = JSON.parse(JSON.stringify(odds));

    const cached = this.liabilityCache.get(String(eventId));
    if (!cached) return modified;

    for (const rule of manipRules) {
      const config = rule.config as {
        liabilityThreshold?: number;       // Minimum liability difference to trigger manipulation
        manipulationPercent?: number;       // Percentage to shift odds (e.g. 2 = 2%)
        maxShiftPercent?: number;           // Maximum shift cap
        targetEventIds?: number[];          // If specified, only apply to these events
      };

      // Skip if rule targets specific events and this isn't one
      if (config.targetEventIds && config.targetEventIds.length > 0) {
        if (!config.targetEventIds.includes(eventId)) continue;
      }

      const threshold = config.liabilityThreshold ?? 100000;
      const manipPercent = config.manipulationPercent ?? 2;
      const maxShift = config.maxShiftPercent ?? 5;

      // If we have runner-level odds, shift them
      if (modified.runners && Array.isArray(modified.runners)) {
        // Calculate per-runner liability from cache
        // We need to determine which side is over-exposed
        const totalMatchExposure = cached.matchExposure;

        if (Math.abs(totalMatchExposure) > threshold) {
          // Positive matchExposure means we're more liable on one side
          // Shift odds to attract bets on the other side
          const shiftFactor = Math.min(manipPercent, maxShift) / 100;
          const direction = totalMatchExposure > 0 ? -1 : 1;

          for (let i = 0; i < modified.runners.length; i++) {
            const runner = modified.runners[i];

            // Shift back odds for the first runner (the over-exposed side)
            if (runner.back && Array.isArray(runner.back)) {
              for (const level of runner.back) {
                if (level.price) {
                  // For the first runner, decrease back odds to discourage more backing on over-exposed side
                  // For the second runner, increase back odds to attract backing
                  const adjustSign = i === 0 ? direction : -direction;
                  const originalPrice = parseFloat(level.price);
                  const shift = originalPrice * shiftFactor * adjustSign;
                  level.price = Math.max(1.01, parseFloat((originalPrice + shift).toFixed(2)));
                }
              }
            }

            if (runner.lay && Array.isArray(runner.lay)) {
              for (const level of runner.lay) {
                if (level.price) {
                  const adjustSign = i === 0 ? -direction : direction;
                  const originalPrice = parseFloat(level.price);
                  const shift = originalPrice * shiftFactor * adjustSign;
                  level.price = Math.max(1.01, parseFloat((originalPrice + shift).toFixed(2)));
                }
              }
            }

            // Handle flat back/lay properties (bookmaker-style odds)
            if (typeof runner.back === 'number') {
              const adjustSign = i === 0 ? direction : -direction;
              const shift = runner.back * shiftFactor * adjustSign;
              runner.back = Math.max(1, parseFloat((runner.back + shift).toFixed(2)));
            }
            if (typeof runner.lay === 'number') {
              const adjustSign = i === 0 ? -direction : direction;
              const shift = runner.lay * shiftFactor * adjustSign;
              runner.lay = Math.max(1, parseFloat((runner.lay + shift).toFixed(2)));
            }
          }
        }
      }
    }

    return modified;
  }

  // ─── LIABILITY CALCULATION ────────────────────────────────

  /**
   * Calculate real-time liability for a given event.
   * Queries all unsettled MATCHED bets and computes what happens if each runner wins.
   *
   * @param eventId - The CricketEvent internal ID (cuid)
   */
  async calculateLiability(eventId: string): Promise<LiabilityResult> {
    // Fetch all unsettled matched bets for this event
    const bets = await prisma.bet.findMany({
      where: {
        cricketEventId: eventId,
        betStatus: 'MATCHED',
        settledAt: null,
      },
      select: {
        selectionId: true,
        runnerName: true,
        betType: true,
        amount: true,
        rate: true,
        profit: true,
        loss: true,
      },
    });

    // Build runner map
    const runnerMap: Map<number, {
      selectionId: number;
      runnerName: string;
      backStakes: number;
      layStakes: number;
      backProfitTotal: number;     // sum of profit from BACK bets on this runner
      backLossTotal: number;       // sum of loss from BACK bets on this runner
      layProfitTotal: number;      // sum of profit from LAY bets on this runner
      layLossTotal: number;        // sum of loss from LAY bets on this runner
    }> = new Map();

    for (const bet of bets) {
      if (!runnerMap.has(bet.selectionId)) {
        runnerMap.set(bet.selectionId, {
          selectionId: bet.selectionId,
          runnerName: bet.runnerName,
          backStakes: 0,
          layStakes: 0,
          backProfitTotal: 0,
          backLossTotal: 0,
          layProfitTotal: 0,
          layLossTotal: 0,
        });
      }

      const r = runnerMap.get(bet.selectionId)!;
      const profit = parseFloat(bet.profit.toString());
      const loss = parseFloat(bet.loss.toString());
      const amount = parseFloat(bet.amount.toString());

      if (bet.betType === 'BACK') {
        r.backStakes += amount;
        r.backProfitTotal += profit;
        r.backLossTotal += loss;
      } else {
        r.layStakes += amount;
        r.layProfitTotal += profit;
        r.layLossTotal += loss;
      }
    }

    const selectionIds = Array.from(runnerMap.keys());
    const runners: LiabilityRunner[] = [];

    // For each possible winner, calculate platform P&L
    // Platform P&L = -(user P&L)
    // If runner X wins:
    //   - BACK bets on X: users win their profit -> platform pays -backProfitTotal[X]
    //   - BACK bets on other runners: users lose their loss -> platform gains +backLossTotal[other]
    //   - LAY bets on X: users lose their loss -> platform gains +layLossTotal[X]
    //   - LAY bets on other runners: users win their profit -> platform pays -layProfitTotal[other]

    for (const sid of selectionIds) {
      const data = runnerMap.get(sid)!;

      // Calculate platform P&L if this runner wins
      let platformPLIfWins = 0;

      for (const [otherSid, otherData] of runnerMap.entries()) {
        if (otherSid === sid) {
          // This runner wins
          // BACK bets on this runner: user wins profit, platform loses
          platformPLIfWins -= otherData.backProfitTotal;
          // LAY bets on this runner: user loses loss, platform gains
          platformPLIfWins += otherData.layLossTotal;
        } else {
          // Other runners lose
          // BACK bets on other runners: user loses loss, platform gains
          platformPLIfWins += otherData.backLossTotal;
          // LAY bets on other runners: user wins profit, platform loses
          platformPLIfWins -= otherData.layProfitTotal;
        }
      }

      const backExposure = data.backProfitTotal;  // What platform owes if BACK bets on this runner win
      const layExposure = data.layLossTotal;       // What platform gains if LAY bets on this runner lose

      runners.push({
        selectionId: sid,
        runnerName: data.runnerName,
        backExposure,
        layExposure,
        netExposure: backExposure - layExposure,
        potentialLoss: platformPLIfWins < 0 ? Math.abs(platformPLIfWins) : 0,
        potentialProfit: platformPLIfWins > 0 ? platformPLIfWins : 0,
      });
    }

    // Calculate totals
    const platformPLs = runners.map((r) => r.potentialProfit - r.potentialLoss);
    const worstCase = platformPLs.length > 0 ? Math.min(...platformPLs) : 0;
    const bestCase = platformPLs.length > 0 ? Math.max(...platformPLs) : 0;
    const totalExposure = runners.reduce((sum, r) => sum + r.potentialLoss, 0);

    // Update liability cache
    const event = await prisma.cricketEvent.findUnique({ where: { id: eventId } });
    if (event) {
      this.liabilityCache.set(String(event.cricketId), {
        matchExposure: worstCase,
        fancyExposure: 0, // will be computed separately if needed
        timestamp: Date.now(),
      });
    }

    return { runners, totalExposure, worstCase, bestCase };
  }

  /**
   * Get liability overview for all active events.
   */
  async getLiabilityOverview(): Promise<Array<{
    eventId: string;
    cricketId: number;
    eventName: string;
    totalBets: number;
    totalStake: number;
    worstCase: number;
    bestCase: number;
    fancyExposure: number;
  }>> {
    const activeEvents = await prisma.cricketEvent.findMany({
      where: { isActive: true, isSettled: false },
      select: { id: true, cricketId: true, eventName: true },
    });

    const results = [];

    for (const event of activeEvents) {
      const [liability, betAgg, fancyAgg] = await Promise.all([
        this.calculateLiability(event.id),
        prisma.bet.aggregate({
          where: { cricketEventId: event.id, betStatus: 'MATCHED', settledAt: null },
          _count: true,
          _sum: { amount: true },
        }),
        prisma.fancyBet.aggregate({
          where: { cricketEventId: event.id, betStatus: 'MATCHED', settledAt: null },
          _sum: { loss: true },
        }),
      ]);

      const fancyExposure = parseFloat(fancyAgg._sum.loss?.toString() || '0');

      results.push({
        eventId: event.id,
        cricketId: event.cricketId,
        eventName: event.eventName,
        totalBets: betAgg._count || 0,
        totalStake: parseFloat(betAgg._sum.amount?.toString() || '0'),
        worstCase: liability.worstCase,
        bestCase: liability.bestCase,
        fancyExposure,
      });
    }

    return results;
  }

  // ─── BET DELAY ───────────────────────────────────────────

  /**
   * Calculate how many milliseconds a bet should be delayed.
   * Higher amounts and sharp bettors get more delay to prevent scalping live odds.
   */
  getBetDelay(userId: string, amount: number): number {
    // Start with global delay
    let delay = this.betDelayMs;

    // Check bet delay rules
    const delayRules = this.getActiveRulesByType('BET_DELAY');
    for (const rule of delayRules) {
      const config = rule.config as {
        baseDelayMs?: number;          // Base delay for all bets
        amountThresholds?: Array<{     // Progressive delay based on amount
          minAmount: number;
          delayMs: number;
        }>;
        sharpBettorExtraDelayMs?: number;  // Extra delay for flagged sharp bettors
      };

      // Apply base delay from rule
      if (config.baseDelayMs && config.baseDelayMs > delay) {
        delay = config.baseDelayMs;
      }

      // Apply amount-based progressive delay
      if (config.amountThresholds && Array.isArray(config.amountThresholds)) {
        // Sort descending so we match the highest threshold first
        const sorted = [...config.amountThresholds].sort((a, b) => b.minAmount - a.minAmount);
        for (const tier of sorted) {
          if (amount >= tier.minAmount) {
            delay = Math.max(delay, tier.delayMs);
            break;
          }
        }
      }

      // Apply extra delay for sharp bettors
      if (config.sharpBettorExtraDelayMs) {
        const winData = this.userWinRates.get(userId);
        if (winData && winData.total >= 50) {
          const winRate = winData.wins / winData.total;
          if (winRate > 0.55) {
            delay += config.sharpBettorExtraDelayMs;
          }
        }
      }
    }

    return delay;
  }

  /**
   * Set the global bet delay.
   */
  async setGlobalBetDelay(delayMs: number): Promise<void> {
    this.betDelayMs = delayMs;
    await prisma.systemSettings.upsert({
      where: { key: 'global_bet_delay_ms' },
      create: { key: 'global_bet_delay_ms', value: { value: delayMs } },
      update: { value: { value: delayMs } },
    });
  }

  getGlobalBetDelay(): number {
    return this.betDelayMs;
  }

  // ─── SHARP BETTOR DETECTION ───────────────────────────────

  /**
   * Detect sharp bettors - users who consistently win more than expected.
   * Queries settled bet history, calculates win rate, and flags users with
   * win rate > 55% and > 50 total bets.
   */
  async detectSharpBettors(): Promise<SharpBettorInfo[]> {
    // Get all users who have settled bets
    const users = await prisma.user.findMany({
      where: {
        role: 'CLIENT',
        bets: {
          some: { settledAt: { not: null } },
        },
      },
      select: {
        id: true,
        username: true,
        name: true,
      },
    });

    const sharpBettors: SharpBettorInfo[] = [];

    for (const user of users) {
      // Get all settled bets
      const settledBets = await prisma.bet.findMany({
        where: {
          userId: user.id,
          settledAt: { not: null },
          betStatus: 'MATCHED',
        },
        select: { profitLoss: true },
      });

      // Get all settled fancy bets
      const settledFancyBets = await prisma.fancyBet.findMany({
        where: {
          userId: user.id,
          settledAt: { not: null },
          betStatus: 'MATCHED',
        },
        select: { profitLoss: true },
      });

      const allBets = [
        ...settledBets.map((b) => parseFloat(b.profitLoss?.toString() || '0')),
        ...settledFancyBets.map((b) => parseFloat(b.profitLoss?.toString() || '0')),
      ];

      const totalBets = allBets.length;
      if (totalBets < 50) continue; // Not enough data

      const wins = allBets.filter((pl) => pl > 0).length;
      const winRate = wins / totalBets;
      const netPL = allBets.reduce((sum, pl) => sum + pl, 0);

      // Update cache
      this.userWinRates.set(user.id, {
        wins,
        total: totalBets,
        lastUpdated: Date.now(),
      });

      if (winRate > 0.55) {
        let recommendation: string;
        if (winRate > 0.70) {
          recommendation = 'BLOCK_IMMEDIATELY - Possible insider/bot. Lock betting and investigate.';
        } else if (winRate > 0.65) {
          recommendation = 'HIGH_RISK - Apply maximum bet delay, reduce bet limits significantly.';
        } else if (winRate > 0.60) {
          recommendation = 'MEDIUM_RISK - Apply extra bet delay, reduce max bet limits by 50%.';
        } else {
          recommendation = 'MONITOR - Apply moderate bet delay, keep under observation.';
        }

        sharpBettors.push({
          userId: user.id,
          username: user.username,
          winRate: parseFloat((winRate * 100).toFixed(2)),
          totalBets,
          netPL: parseFloat(netPL.toFixed(2)),
          recommendation,
        });
      }
    }

    // Sort by win rate descending
    sharpBettors.sort((a, b) => b.winRate - a.winRate);

    return sharpBettors;
  }

  // ─── AUTO LOCK ────────────────────────────────────────────

  /**
   * Check if a market should be auto-locked based on liability threshold rules.
   */
  async shouldAutoLock(eventId: string, _marketId: string): Promise<boolean> {
    const lockRules = this.getActiveRulesByType('AUTO_LOCK');
    if (lockRules.length === 0) return false;

    const liability = await this.calculateLiability(eventId);

    for (const rule of lockRules) {
      const config = rule.config as {
        maxExposure?: number;          // Maximum total exposure before auto-lock
        maxWorstCase?: number;         // Maximum worst-case loss before auto-lock
        perRunnerMaxExposure?: number;  // Maximum exposure per single runner
      };

      // Check total exposure threshold
      if (config.maxExposure && liability.totalExposure > config.maxExposure) {
        return true;
      }

      // Check worst-case loss threshold
      if (config.maxWorstCase && Math.abs(liability.worstCase) > config.maxWorstCase) {
        return true;
      }

      // Check per-runner exposure
      if (config.perRunnerMaxExposure) {
        for (const runner of liability.runners) {
          if (runner.potentialLoss > config.perRunnerMaxExposure) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // ─── AUTO SETTLE ──────────────────────────────────────────

  /**
   * Check if a match should be auto-settled based on match status from the API.
   * If match is completed and we have a result, emit a settlement event.
   */
  async checkAutoSettle(eventId: number, matchStatus: any): Promise<void> {
    if (!matchStatus) return;

    const isCompleted =
      matchStatus.status === 'completed' ||
      matchStatus.status === 'COMPLETED' ||
      matchStatus.isCompleted === true ||
      matchStatus.matchStatus === 'Match Over';

    if (!isCompleted) return;

    // Check if there's a winner in the match status
    const winner = matchStatus.winner || matchStatus.winnerName || matchStatus.result?.winner;
    if (!winner) return;

    // Find the event
    const event = await prisma.cricketEvent.findUnique({
      where: { cricketId: eventId },
      include: { markets: true },
    });

    if (!event || event.isSettled) return;

    // Check if there are unsettled matched bets
    const unsettledCount = await prisma.bet.count({
      where: {
        cricketEventId: event.id,
        betStatus: 'MATCHED',
        settledAt: null,
      },
    });

    if (unsettledCount === 0) return;

    // Emit auto-settle event - let the settlement service handle actual settlement
    this.emit('auto-settle', {
      eventId,
      cricketEventId: event.id,
      winner,
      matchStatus,
      markets: event.markets.filter((m) => !m.isSettled),
    });

    console.log(`Auto-settle triggered for event ${eventId}: winner = ${winner}`);
  }

  // ─── RISK ALERTS ──────────────────────────────────────────

  /**
   * Generate risk alerts across all active events.
   * Checks for high liability, sharp bettor activity, unusual patterns, and large bets.
   */
  async getRiskAlerts(): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];
    const now = new Date();

    // Get thresholds from LIABILITY_THRESHOLD rules
    const thresholdRules = this.getActiveRulesByType('LIABILITY_THRESHOLD');
    const highLiabilityThreshold = thresholdRules.length > 0
      ? (thresholdRules[0].config as any)?.highThreshold ?? 500000
      : 500000;
    const criticalLiabilityThreshold = thresholdRules.length > 0
      ? (thresholdRules[0].config as any)?.criticalThreshold ?? 1000000
      : 1000000;
    const largeBetThreshold = thresholdRules.length > 0
      ? (thresholdRules[0].config as any)?.largeBetThreshold ?? 100000
      : 100000;

    // 1. Check all active events for high liability
    const activeEvents = await prisma.cricketEvent.findMany({
      where: { isActive: true, isSettled: false },
      select: { id: true, cricketId: true, eventName: true },
    });

    for (const event of activeEvents) {
      try {
        const liability = await this.calculateLiability(event.id);

        if (Math.abs(liability.worstCase) > criticalLiabilityThreshold) {
          alerts.push({
            level: 'CRITICAL',
            type: 'HIGH_LIABILITY',
            message: `CRITICAL liability on ${event.eventName}: worst case loss = ${Math.abs(liability.worstCase).toLocaleString()}`,
            eventId: String(event.cricketId),
            amount: Math.abs(liability.worstCase),
            timestamp: now,
          });
        } else if (Math.abs(liability.worstCase) > highLiabilityThreshold) {
          alerts.push({
            level: 'HIGH',
            type: 'HIGH_LIABILITY',
            message: `High liability on ${event.eventName}: worst case loss = ${Math.abs(liability.worstCase).toLocaleString()}`,
            eventId: String(event.cricketId),
            amount: Math.abs(liability.worstCase),
            timestamp: now,
          });
        }
      } catch (err: any) {
        // Skip events that fail calculation
      }
    }

    // 2. Check for sharp bettor activity in last 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sharpBettorIds: string[] = [];
    for (const [uid, data] of this.userWinRates.entries()) {
      if (data.total >= 50 && data.wins / data.total > 0.55) {
        sharpBettorIds.push(uid);
      }
    }

    if (sharpBettorIds.length > 0) {
      const recentSharpBets = await prisma.bet.findMany({
        where: {
          userId: { in: sharpBettorIds },
          createdAt: { gte: oneHourAgo },
          betStatus: 'MATCHED',
        },
        include: {
          user: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      for (const bet of recentSharpBets) {
        const amount = parseFloat(bet.amount.toString());
        alerts.push({
          level: amount > largeBetThreshold ? 'HIGH' : 'MEDIUM',
          type: 'SHARP_BETTOR_ACTIVITY',
          message: `Sharp bettor ${bet.user.username} placed ${bet.betType} bet of ${amount.toLocaleString()} on ${bet.runnerName}`,
          eventId: bet.cricketEventId,
          userId: bet.userId,
          amount,
          timestamp: bet.createdAt,
        });
      }
    }

    // 3. Check for unusual betting patterns (same IP, multiple accounts)
    const recentBets = await prisma.bet.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
        betStatus: 'MATCHED',
        ip: { not: null },
      },
      select: {
        ip: true,
        userId: true,
        selectionId: true,
        amount: true,
        cricketEventId: true,
        runnerName: true,
      },
    });

    // Group by IP
    const ipMap: Map<string, Set<string>> = new Map();
    for (const bet of recentBets) {
      if (!bet.ip) continue;
      if (!ipMap.has(bet.ip)) ipMap.set(bet.ip, new Set());
      ipMap.get(bet.ip)!.add(bet.userId);
    }

    // Flag IPs with multiple user accounts
    for (const [ip, userIds] of ipMap.entries()) {
      if (userIds.size >= 3) {
        alerts.push({
          level: userIds.size >= 5 ? 'CRITICAL' : 'HIGH',
          type: 'MULTI_ACCOUNT_IP',
          message: `${userIds.size} different accounts placing bets from same IP ${ip} in last hour`,
          amount: 0,
          timestamp: now,
        });
      }
    }

    // 4. Check for large single bets
    const largeBets = await prisma.bet.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
        betStatus: 'MATCHED',
        amount: { gte: largeBetThreshold },
      },
      include: {
        user: { select: { username: true } },
        cricketEvent: { select: { eventName: true } },
      },
      orderBy: { amount: 'desc' },
      take: 20,
    });

    for (const bet of largeBets) {
      const amount = parseFloat(bet.amount.toString());
      alerts.push({
        level: amount > largeBetThreshold * 5 ? 'CRITICAL' : amount > largeBetThreshold * 2 ? 'HIGH' : 'MEDIUM',
        type: 'LARGE_BET',
        message: `Large ${bet.betType} bet of ${amount.toLocaleString()} by ${bet.user.username} on ${bet.runnerName} (${bet.cricketEvent.eventName})`,
        eventId: bet.cricketEventId,
        userId: bet.userId,
        amount,
        timestamp: bet.createdAt,
      });
    }

    // 5. Check for large fancy bets
    const largeFancyBets = await prisma.fancyBet.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
        betStatus: 'MATCHED',
        amount: { gte: largeBetThreshold },
      },
      include: {
        user: { select: { username: true } },
        cricketEvent: { select: { eventName: true } },
      },
      orderBy: { amount: 'desc' },
      take: 20,
    });

    for (const bet of largeFancyBets) {
      const amount = parseFloat(bet.amount.toString());
      alerts.push({
        level: amount > largeBetThreshold * 5 ? 'CRITICAL' : amount > largeBetThreshold * 2 ? 'HIGH' : 'MEDIUM',
        type: 'LARGE_FANCY_BET',
        message: `Large fancy bet of ${amount.toLocaleString()} by ${bet.user.username} on ${bet.marketName || 'unknown'} (${bet.cricketEvent.eventName})`,
        eventId: bet.cricketEventId,
        userId: bet.userId,
        amount,
        timestamp: bet.createdAt,
      });
    }

    // Sort by level priority, then timestamp
    const levelPriority: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    alerts.sort((a, b) => {
      const pDiff = levelPriority[a.level] - levelPriority[b.level];
      if (pDiff !== 0) return pDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return alerts;
  }

  // ─── MARGIN CONTROL ───────────────────────────────────────

  /**
   * Apply margin control to ensure minimum profit margin on a market.
   * Widens the back/lay spread so that the admin retains at least `marginPercent`.
   *
   * @param backOdds  - Current best back odds
   * @param layOdds   - Current best lay odds
   * @param marginPercent - Desired minimum margin percentage (e.g. 5 = 5%)
   * @returns Adjusted { back, lay } odds
   */
  applyMarginControl(backOdds: number, layOdds: number, marginPercent: number): { back: number; lay: number } {
    if (backOdds <= 0 || layOdds <= 0) {
      return { back: backOdds, lay: layOdds };
    }

    // Current implied probability: 1/back + 1/lay
    // Target overround: 1 + margin/100
    // Widen spread symmetrically to achieve target margin
    const currentOverround = (1 / backOdds) + (1 / layOdds);
    const targetOverround = 1 + (marginPercent / 100);

    if (currentOverround >= targetOverround) {
      // Already has sufficient margin
      return { back: backOdds, lay: layOdds };
    }

    // Need to widen spread
    // Reduce back odds (worse for punter), increase lay odds (worse for punter)
    const midpoint = (backOdds + layOdds) / 2;
    const backImplied = 1 / backOdds;
    const layImplied = 1 / layOdds;
    const totalImplied = backImplied + layImplied;

    // Distribute the extra margin proportionally
    const extraMargin = targetOverround - currentOverround;
    const backShare = backImplied / totalImplied;
    const layShare = layImplied / totalImplied;

    const newBackImplied = backImplied + (extraMargin * backShare);
    const newLayImplied = layImplied + (extraMargin * layShare);

    const newBack = Math.max(1.01, parseFloat((1 / newBackImplied).toFixed(2)));
    const newLay = Math.max(newBack + 0.01, parseFloat((1 / newLayImplied).toFixed(2)));

    // Ensure lay > back (back odds should be lower than lay odds for punter)
    // Actually in betting, back odds < lay odds because lay is the "ask" price
    // If somehow inverted, correct it
    if (newBack >= newLay) {
      return {
        back: parseFloat((midpoint - 0.02).toFixed(2)),
        lay: parseFloat((midpoint + 0.02).toFixed(2)),
      };
    }

    return { back: newBack, lay: newLay };
  }

  /**
   * Apply margin control using active MARGIN_CONTROL rules.
   */
  applyMarginControlFromRules(backOdds: number, layOdds: number): { back: number; lay: number } {
    const marginRules = this.getActiveRulesByType('MARGIN_CONTROL');
    if (marginRules.length === 0) {
      return { back: backOdds, lay: layOdds };
    }

    // Use the first active margin control rule
    const config = marginRules[0].config as {
      marginPercent?: number;
      minSpread?: number;    // Minimum point spread between back and lay
    };

    const marginPercent = config.marginPercent ?? 5;
    let result = this.applyMarginControl(backOdds, layOdds, marginPercent);

    // Enforce minimum spread if configured
    if (config.minSpread && (result.lay - result.back) < config.minSpread) {
      const mid = (result.back + result.lay) / 2;
      result = {
        back: parseFloat((mid - config.minSpread / 2).toFixed(2)),
        lay: parseFloat((mid + config.minSpread / 2).toFixed(2)),
      };
    }

    return result;
  }

  // ─── DASHBOARD ────────────────────────────────────────────

  /**
   * Get full automation dashboard data.
   */
  async getDashboardData(): Promise<{
    rules: AutomationRule[];
    alerts: RiskAlert[];
    liabilityOverview: any[];
    sharpBettors: SharpBettorInfo[];
    todayStats: {
      totalBetsToday: number;
      totalStakeToday: number;
      totalUsersToday: number;
      settledPLToday: number;
    };
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [rules, alerts, liabilityOverview, sharpBettors, betStats, fancyBetStats, uniqueUsers, settledBets, settledFancy] = await Promise.all([
      prisma.automationRule.findMany({ orderBy: { createdAt: 'desc' } }),
      this.getRiskAlerts(),
      this.getLiabilityOverview(),
      this.detectSharpBettors(),
      prisma.bet.aggregate({
        where: { createdAt: { gte: todayStart }, betStatus: 'MATCHED' },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.fancyBet.aggregate({
        where: { createdAt: { gte: todayStart }, betStatus: 'MATCHED' },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.bet.findMany({
        where: { createdAt: { gte: todayStart } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.bet.aggregate({
        where: { settledAt: { gte: todayStart }, betStatus: 'MATCHED' },
        _sum: { profitLoss: true },
      }),
      prisma.fancyBet.aggregate({
        where: { settledAt: { gte: todayStart }, betStatus: 'MATCHED' },
        _sum: { profitLoss: true },
      }),
    ]);

    const totalBetsToday = (betStats._count || 0) + (fancyBetStats._count || 0);
    const totalStakeToday =
      parseFloat(betStats._sum.amount?.toString() || '0') +
      parseFloat(fancyBetStats._sum.amount?.toString() || '0');
    const totalUsersToday = uniqueUsers.length;

    // Platform P&L is negative of user P&L
    const userPL =
      parseFloat(settledBets._sum.profitLoss?.toString() || '0') +
      parseFloat(settledFancy._sum.profitLoss?.toString() || '0');
    const settledPLToday = -userPL;

    return {
      rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type as AutomationRule['type'],
        config: r.config,
        isActive: r.isActive,
        createdAt: r.createdAt,
      })),
      alerts,
      liabilityOverview,
      sharpBettors,
      todayStats: {
        totalBetsToday,
        totalStakeToday: parseFloat(totalStakeToday.toFixed(2)),
        totalUsersToday,
        settledPLToday: parseFloat(settledPLToday.toFixed(2)),
      },
    };
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────

  /**
   * Pre-warm the user win rate cache from recent settled bets.
   */
  private async _warmUserWinRateCache(): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        where: { role: 'CLIENT' },
        select: { id: true },
      });

      for (const user of users) {
        const settledCount = await prisma.bet.count({
          where: { userId: user.id, settledAt: { not: null }, betStatus: 'MATCHED' },
        });

        if (settledCount < 20) continue; // Not enough data to cache

        const wonCount = await prisma.bet.count({
          where: {
            userId: user.id,
            settledAt: { not: null },
            betStatus: 'MATCHED',
            profitLoss: { gt: 0 },
          },
        });

        this.userWinRates.set(user.id, {
          wins: wonCount,
          total: settledCount,
          lastUpdated: Date.now(),
        });
      }
    } catch (err: any) {
      console.error('Failed to warm user win rate cache:', err.message);
    }
  }
}

export const automationEngine = new AutomationEngine();
