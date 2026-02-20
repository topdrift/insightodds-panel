import { prisma } from '../utils/prisma';

// ─── TYPES ─────────────────────────────────────────────────

export interface CashOutResult {
  cashOutAmount: number;
  originalStake: number;
  profit: number;
  isAvailable: boolean;
  reason?: string;
}

// ─── CASH OUT CALCULATION ──────────────────────────────────

/**
 * Calculate cash-out value for a bet at current odds.
 *
 * Cash-out logic:
 * For a BACK bet:
 *   cashOutValue = originalStake * (placedOdds / currentOdds)
 *   This gives the bettor a guaranteed return based on how odds have moved.
 *   If currentOdds < placedOdds, the bet is doing well -> cashOut > stake (profit)
 *   If currentOdds > placedOdds, the bet is doing poorly -> cashOut < stake (partial loss)
 *
 * For a LAY bet:
 *   cashOutValue = originalStake * (currentOdds / placedOdds)
 *   Inverse logic: if currentOdds rose, lay bet is doing poorly.
 *
 * A margin is applied to give the house an edge on cash-outs (typically 5%).
 *
 * @param betId       - The bet ID
 * @param currentOdds - Current market odds for the selection
 * @param marginPercent - House margin on cash-out (default 5%)
 */
export async function calculateCashOut(
  betId: string,
  currentOdds: number,
  marginPercent: number = 5
): Promise<CashOutResult> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: {
      cricketEvent: { select: { isActive: true, isSettled: true, isBetLocked: true } },
    },
  });

  if (!bet) {
    return {
      cashOutAmount: 0,
      originalStake: 0,
      profit: 0,
      isAvailable: false,
      reason: 'Bet not found',
    };
  }

  // Validate bet is eligible for cash-out
  if (bet.betStatus !== 'MATCHED') {
    return {
      cashOutAmount: 0,
      originalStake: parseFloat(bet.amount.toString()),
      profit: 0,
      isAvailable: false,
      reason: 'Bet is not in MATCHED status',
    };
  }

  if (bet.settledAt) {
    return {
      cashOutAmount: 0,
      originalStake: parseFloat(bet.amount.toString()),
      profit: 0,
      isAvailable: false,
      reason: 'Bet has already been settled',
    };
  }

  if (!bet.cricketEvent.isActive || bet.cricketEvent.isSettled) {
    return {
      cashOutAmount: 0,
      originalStake: parseFloat(bet.amount.toString()),
      profit: 0,
      isAvailable: false,
      reason: 'Event is no longer active',
    };
  }

  if (currentOdds <= 0) {
    return {
      cashOutAmount: 0,
      originalStake: parseFloat(bet.amount.toString()),
      profit: 0,
      isAvailable: false,
      reason: 'Invalid current odds',
    };
  }

  const originalStake = parseFloat(bet.amount.toString());
  const placedRate = parseFloat(bet.rate.toString());

  if (placedRate <= 0) {
    return {
      cashOutAmount: 0,
      originalStake,
      profit: 0,
      isAvailable: false,
      reason: 'Invalid placed rate',
    };
  }

  let rawCashOut: number;

  if (bet.betType === 'BACK') {
    // BACK bet: user backed at placedRate, current odds are currentOdds
    // If we were to lay the bet now to lock in, the formula is:
    // cashOutValue = stake * (placedRate / currentOdds)
    // When currentOdds < placedRate, the selection is more likely to win -> cashOut > stake
    // When currentOdds > placedRate, the selection is less likely to win -> cashOut < stake
    rawCashOut = originalStake * (placedRate / currentOdds);
  } else {
    // LAY bet: user layed at placedRate, current odds are currentOdds
    // To cash out a lay bet, if currentOdds increased (selection less likely to win),
    // the lay bet is profitable: cashOut = stake * (currentOdds / placedRate)
    rawCashOut = originalStake * (currentOdds / placedRate);
  }

  // Apply house margin: reduce cash-out amount by margin percentage
  const marginMultiplier = 1 - (marginPercent / 100);
  const cashOutAmount = parseFloat((rawCashOut * marginMultiplier).toFixed(2));

  // Minimum cash-out is 0 (user can't owe money on cash-out)
  const finalCashOut = Math.max(0, cashOutAmount);
  const profit = parseFloat((finalCashOut - originalStake).toFixed(2));

  return {
    cashOutAmount: finalCashOut,
    originalStake,
    profit,
    isAvailable: finalCashOut > 0,
  };
}

/**
 * Calculate cash-out for a fancy bet.
 * Fancy bets are harder to cash out because they depend on a final score,
 * but we can offer a partial cash-out based on how the match is progressing.
 *
 * @param betId - The fancy bet ID
 * @param currentScore - Current score relevant to this fancy market
 * @param marginPercent - House margin (default 5%)
 */
export async function calculateFancyCashOut(
  betId: string,
  currentScore: number,
  marginPercent: number = 5
): Promise<CashOutResult> {
  const bet = await prisma.fancyBet.findUnique({
    where: { id: betId },
    include: {
      cricketEvent: { select: { isActive: true, isSettled: true } },
    },
  });

  if (!bet) {
    return { cashOutAmount: 0, originalStake: 0, profit: 0, isAvailable: false, reason: 'Bet not found' };
  }

  if (bet.betStatus !== 'MATCHED' || bet.settledAt) {
    return {
      cashOutAmount: 0,
      originalStake: parseFloat(bet.amount.toString()),
      profit: 0,
      isAvailable: false,
      reason: 'Bet is not eligible for cash-out',
    };
  }

  if (!bet.cricketEvent.isActive || bet.cricketEvent.isSettled) {
    return {
      cashOutAmount: 0,
      originalStake: parseFloat(bet.amount.toString()),
      profit: 0,
      isAvailable: false,
      reason: 'Event is no longer active',
    };
  }

  const originalStake = parseFloat(bet.amount.toString());
  const originalProfit = parseFloat(bet.profit.toString());
  const originalLoss = parseFloat(bet.loss.toString());
  const oddsBack = parseFloat(bet.oddsBack?.toString() || '0');
  const oddsLay = parseFloat(bet.oddsLay?.toString() || '0');

  let winProbability: number;

  if (oddsBack > 0) {
    // YES bet: wins if final score >= oddsBack
    // Estimate win probability based on current score vs target
    if (currentScore >= oddsBack) {
      winProbability = 0.90; // Already achieved target, very likely to win
    } else {
      const remaining = oddsBack - currentScore;
      const target = oddsBack;
      // Simple linear approximation - closer to target = higher probability
      winProbability = Math.max(0.05, Math.min(0.85, 1 - (remaining / target)));
    }
  } else if (oddsLay > 0) {
    // NO bet: wins if final score < oddsLay
    if (currentScore >= oddsLay) {
      winProbability = 0.05; // Already exceeded, very unlikely to win
    } else {
      const remaining = oddsLay - currentScore;
      const target = oddsLay;
      winProbability = Math.max(0.10, Math.min(0.90, remaining / target));
    }
  } else {
    return {
      cashOutAmount: 0,
      originalStake,
      profit: 0,
      isAvailable: false,
      reason: 'Cannot determine bet direction',
    };
  }

  // Expected value: (probability of winning * profit) - (probability of losing * loss)
  const expectedValue = (winProbability * originalProfit) - ((1 - winProbability) * originalLoss);

  // Cash-out = stake + expected value, with house margin
  const marginMultiplier = 1 - (marginPercent / 100);
  const rawCashOut = originalStake + expectedValue;
  const cashOutAmount = parseFloat((Math.max(0, rawCashOut) * marginMultiplier).toFixed(2));
  const profit = parseFloat((cashOutAmount - originalStake).toFixed(2));

  return {
    cashOutAmount,
    originalStake,
    profit,
    isAvailable: cashOutAmount > 0,
  };
}

// ─── CASH OUT EXECUTION ────────────────────────────────────

/**
 * Execute cash-out for a regular bet.
 * Settles the bet immediately at the cash-out amount.
 *
 * @param betId        - The bet ID
 * @param userId       - The user requesting cash-out (must own the bet)
 * @param cashOutAmount - The calculated cash-out amount
 */
export async function executeCashOut(
  betId: string,
  userId: string,
  cashOutAmount: number
): Promise<{ success: boolean; message: string; newBalance?: number }> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: {
      cricketEvent: { select: { eventName: true, isActive: true, isSettled: true } },
    },
  });

  if (!bet) {
    return { success: false, message: 'Bet not found' };
  }

  if (bet.userId !== userId) {
    return { success: false, message: 'You do not own this bet' };
  }

  if (bet.betStatus !== 'MATCHED' || bet.settledAt) {
    return { success: false, message: 'Bet is not eligible for cash-out' };
  }

  if (!bet.cricketEvent.isActive || bet.cricketEvent.isSettled) {
    return { success: false, message: 'Event is no longer active' };
  }

  if (cashOutAmount < 0) {
    return { success: false, message: 'Invalid cash-out amount' };
  }

  const originalStake = parseFloat(bet.amount.toString());
  // P&L from user perspective: cashOutAmount - originalStake
  const pnl = parseFloat((cashOutAmount - originalStake).toFixed(2));

  const result = await prisma.$transaction(async (tx) => {
    // Settle the bet
    await tx.bet.update({
      where: { id: betId },
      data: {
        profitLoss: pnl,
        result: 'CASHED_OUT',
        settledAt: new Date(),
      },
    });

    // Refund exposure and apply P&L
    // During placement: balance was decremented by amount, exposure incremented by amount
    // On cash-out: return exposure + pnl to balance
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        balance: { increment: originalStake + pnl },
        exposure: { decrement: originalStake },
      },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: pnl >= 0 ? 'BET_WON' : 'BET_LOST',
        amount: pnl,
        balance: parseFloat(updatedUser.balance.toString()),
        reference: betId,
        remarks: `Cash-out: ${bet.runnerName} - ${bet.cricketEvent.eventName} (${cashOutAmount.toFixed(2)})`,
        createdBy: userId,
      },
    });

    return { newBalance: parseFloat(updatedUser.balance.toString()) };
  });

  return {
    success: true,
    message: `Cash-out successful. ${pnl >= 0 ? 'Profit' : 'Loss'}: ${Math.abs(pnl).toFixed(2)}`,
    newBalance: result.newBalance,
  };
}

/**
 * Execute cash-out for a fancy bet.
 */
export async function executeFancyCashOut(
  betId: string,
  userId: string,
  cashOutAmount: number
): Promise<{ success: boolean; message: string; newBalance?: number }> {
  const bet = await prisma.fancyBet.findUnique({
    where: { id: betId },
    include: {
      cricketEvent: { select: { eventName: true, isActive: true, isSettled: true } },
    },
  });

  if (!bet) {
    return { success: false, message: 'Fancy bet not found' };
  }

  if (bet.userId !== userId) {
    return { success: false, message: 'You do not own this bet' };
  }

  if (bet.betStatus !== 'MATCHED' || bet.settledAt) {
    return { success: false, message: 'Bet is not eligible for cash-out' };
  }

  if (!bet.cricketEvent.isActive || bet.cricketEvent.isSettled) {
    return { success: false, message: 'Event is no longer active' };
  }

  if (cashOutAmount < 0) {
    return { success: false, message: 'Invalid cash-out amount' };
  }

  const originalStake = parseFloat(bet.amount.toString());
  const pnl = parseFloat((cashOutAmount - originalStake).toFixed(2));

  const result = await prisma.$transaction(async (tx) => {
    await tx.fancyBet.update({
      where: { id: betId },
      data: {
        profitLoss: pnl,
        result: 'CASHED_OUT',
        settledAt: new Date(),
      },
    });

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        balance: { increment: originalStake + pnl },
        exposure: { decrement: originalStake },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: pnl >= 0 ? 'BET_WON' : 'BET_LOST',
        amount: pnl,
        balance: parseFloat(updatedUser.balance.toString()),
        reference: betId,
        remarks: `Fancy cash-out: ${bet.marketName || bet.runnerName} - ${bet.cricketEvent.eventName} (${cashOutAmount.toFixed(2)})`,
        createdBy: userId,
      },
    });

    return { newBalance: parseFloat(updatedUser.balance.toString()) };
  });

  return {
    success: true,
    message: `Fancy cash-out successful. ${pnl >= 0 ? 'Profit' : 'Loss'}: ${Math.abs(pnl).toFixed(2)}`,
    newBalance: result.newBalance,
  };
}
