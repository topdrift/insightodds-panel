import { prisma } from '../utils/prisma';
import { distributeCommission } from './commission';
import { distributePartnership } from './partnership';

/**
 * Settle a match market (MATCH_ODDS / BOOKMAKER)
 * Winner-based: the winning selectionId determines outcomes.
 */
export async function settleMatchMarket(params: {
  eventId: number;
  marketId: string;
  winnerSelectionId: number;
  winnerName: string;
  abandoned?: boolean;
  tie?: boolean;
}) {
  const { eventId, marketId, winnerSelectionId, winnerName, abandoned, tie } = params;

  const event = await prisma.cricketEvent.findUnique({ where: { cricketId: eventId } });
  if (!event) throw new Error('Event not found');

  const bets = await prisma.bet.findMany({
    where: {
      cricketEventId: event.id,
      marketId,
      betStatus: 'MATCHED',
      settledAt: null,
    },
  });

  for (const bet of bets) {
    let pnl = 0;

    if (abandoned) {
      // Void all bets — refund
      pnl = 0;
    } else if (tie) {
      // Tie — half profit
      pnl = parseFloat(bet.profit.toString()) / 2;
    } else {
      const isWinner = bet.selectionId === winnerSelectionId;
      if (bet.betType === 'BACK') {
        pnl = isWinner ? parseFloat(bet.profit.toString()) : -parseFloat(bet.loss.toString());
      } else {
        // LAY: wins when selection loses
        pnl = isWinner ? -parseFloat(bet.loss.toString()) : parseFloat(bet.profit.toString());
      }
    }

    await prisma.$transaction(async (tx) => {
      // Update bet
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          profitLoss: pnl,
          result: abandoned ? 'ABANDONED' : (tie ? 'TIE' : winnerName),
          betStatus: abandoned ? 'DELETED' : 'MATCHED',
          settledAt: new Date(),
        },
      });

      // Update user balance: refund exposure + add profit/loss
      // During placement, `amount` was deducted from balance and added to exposure
      const exposure = parseFloat(bet.amount.toString());

      await tx.user.update({
        where: { id: bet.userId },
        data: {
          balance: { increment: exposure + pnl },
          exposure: { decrement: exposure },
        },
      });

      // Transaction record
      await tx.transaction.create({
        data: {
          userId: bet.userId,
          type: pnl >= 0 ? 'BET_WON' : 'BET_LOST',
          amount: pnl,
          balance: 0,
          remarks: `Settlement: ${event.eventName} - ${winnerName}`,
          reference: bet.id,
        },
      });
    });

    // Distribute commission and partnership
    if (!abandoned && pnl !== 0) {
      await distributeCommission(bet.id, bet.userId, pnl, 'CRICKET', 'match');
      await distributePartnership(bet.userId, -pnl, 'cricket'); // platform's perspective
    }
  }

  // Mark event settled
  await prisma.cricketEvent.update({
    where: { cricketId: eventId },
    data: {
      winner: abandoned ? 'ABANDONED' : winnerName,
      isSettled: true,
    },
  });
}

/**
 * Settle a fancy market based on final score
 */
export async function settleFancyMarket(params: {
  eventId: number;
  marketId: string;
  finalScore: number;
  abandoned?: boolean;
}) {
  const { eventId, marketId, finalScore, abandoned } = params;

  const event = await prisma.cricketEvent.findUnique({ where: { cricketId: eventId } });
  if (!event) throw new Error('Event not found');

  const bets = await prisma.fancyBet.findMany({
    where: {
      cricketEventId: event.id,
      marketId,
      betStatus: 'MATCHED',
      settledAt: null,
    },
  });

  for (const bet of bets) {
    let pnl = 0;

    if (abandoned) {
      pnl = 0;
    } else {
      // Fancy: if oddsBack is set, it's a YES bet (back side)
      // YES wins if finalScore >= oddsBack (the runs line)
      // NO wins if finalScore < oddsLay (the runs line)
      const oddsBack = parseFloat(bet.oddsBack?.toString() || '0');
      const oddsLay = parseFloat(bet.oddsLay?.toString() || '0');

      if (oddsBack > 0) {
        // YES bet — wins if score >= oddsBack
        pnl = finalScore >= oddsBack
          ? parseFloat(bet.profit.toString())
          : -parseFloat(bet.loss.toString());
      } else if (oddsLay > 0) {
        // NO bet — wins if score < oddsLay
        pnl = finalScore < oddsLay
          ? parseFloat(bet.profit.toString())
          : -parseFloat(bet.loss.toString());
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.fancyBet.update({
        where: { id: bet.id },
        data: {
          profitLoss: pnl,
          result: abandoned ? 'ABANDONED' : String(finalScore),
          betStatus: abandoned ? 'DELETED' : 'MATCHED',
          settledAt: new Date(),
        },
      });

      // During placement, `amount` was deducted from balance and added to exposure
      const betAmount = parseFloat(bet.amount.toString());
      await tx.user.update({
        where: { id: bet.userId },
        data: {
          balance: { increment: betAmount + pnl },
          exposure: { decrement: betAmount },
        },
      });

      await tx.transaction.create({
        data: {
          userId: bet.userId,
          type: pnl >= 0 ? 'BET_WON' : 'BET_LOST',
          amount: pnl,
          balance: 0,
          remarks: `Fancy settlement: ${bet.marketName} = ${finalScore}`,
          reference: bet.id,
        },
      });
    });

    if (!abandoned && pnl !== 0) {
      await distributeCommission(bet.id, bet.userId, pnl, 'CRICKET', 'session');
      await distributePartnership(bet.userId, -pnl, 'cricket');
    }
  }

  // Update market in Market table if exists
  await prisma.market.updateMany({
    where: { cricketEventId: event.id, externalMarketId: marketId },
    data: { isSettled: true, finalScore, result: String(finalScore) },
  });
}

/**
 * Settle a matka market
 */
export async function settleMatkaMarket(params: {
  marketId: string;
  result: number;
  isRollback?: boolean;
}) {
  const { marketId, result, isRollback } = params;

  const market = await prisma.matkaMarket.findUnique({
    where: { id: marketId },
    include: { matka: true },
  });
  if (!market) throw new Error('Matka market not found');

  if (isRollback) {
    // Rollback: reverse all settled bets
    const settledBets = await prisma.matkaBet.findMany({
      where: { matkaMarketId: marketId, betStatus: 'MATCHED' },
    });

    for (const bet of settledBets) {
      if (bet.profitLoss !== null) {
        const pnl = parseFloat(bet.profitLoss.toString());
        await prisma.$transaction([
          prisma.user.update({
            where: { id: bet.userId },
            data: { balance: { decrement: pnl } },
          }),
          prisma.matkaBet.update({
            where: { id: bet.id },
            data: { profitLoss: null, isWinning: false, result: null },
          }),
          prisma.transaction.create({
            data: {
              userId: bet.userId,
              type: 'ROLL_BACK',
              amount: -pnl,
              balance: 0,
              remarks: `Matka rollback: ${market.matka.name}`,
            },
          }),
        ]);
      }
    }

    await prisma.matkaMarket.update({
      where: { id: marketId },
      data: { isMarketSettled: false, result: null },
    });
    return;
  }

  // Normal settlement
  const bets = await prisma.matkaBet.findMany({
    where: { matkaMarketId: marketId, betStatus: 'MATCHED' },
  });

  for (const bet of bets) {
    const numbers = bet.numbers as Array<{ number: number; amount: number }>;
    let pnl = 0;
    let isWinning = false;

    // Check each number in the bet
    for (const entry of numbers) {
      if (bet.betType === 'JODI') {
        if (entry.number === result) {
          pnl += entry.amount * 90; // JODI pays 90x
          isWinning = true;
        } else {
          pnl -= entry.amount;
        }
      } else {
        // ANDAR_DHAI / BAHAR_HARUF — single digit match
        const resultDigits = [Math.floor(result / 10), result % 10];
        if (resultDigits.includes(entry.number)) {
          pnl += entry.amount * 9; // Single digit pays 9x
          isWinning = true;
        } else {
          pnl -= entry.amount;
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.matkaBet.update({
        where: { id: bet.id },
        data: { profitLoss: pnl, isWinning, result },
      });

      await tx.user.update({
        where: { id: bet.userId },
        data: {
          balance: { increment: parseFloat(bet.totalAmount.toString()) + pnl },
          exposure: { decrement: parseFloat(bet.totalAmount.toString()) },
        },
      });

      await tx.transaction.create({
        data: {
          userId: bet.userId,
          type: pnl >= 0 ? 'BET_WON' : 'BET_LOST',
          amount: pnl,
          balance: 0,
          remarks: `Matka: ${market.matka.name} result=${result}`,
        },
      });
    });

    if (pnl !== 0) {
      await distributePartnership(bet.userId, -pnl, 'matka');
    }
  }

  await prisma.matkaMarket.update({
    where: { id: marketId },
    data: { isMarketSettled: true, result },
  });
}
