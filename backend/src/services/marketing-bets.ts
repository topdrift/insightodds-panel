import { Decimal } from 'decimal.js';
import { prisma } from '../utils/prisma';
import { io } from '../index';

// ─── HELPERS ──────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function toNumber(val: Decimal | number | string): number {
  return parseFloat(val.toString());
}

// ─── SCHEDULE MARKETING BETS ─────────────────────────────

export async function scheduleMarketingBets(
  userId: string,
  promoCodeId: string,
  target: string,        // "CASINO" | "CRICKET" | "BOTH"
  totalWinAmount: number,
  spreadHrs: number,
) {
  // Apply +/-10% variance
  const variance = randomBetween(-0.10, 0.10);
  const adjustedTotal = totalWinAmount * (1 + variance);

  // Split into 4-8 bets
  const numBets = randomInt(4, 8);

  // Generate random proportions that sum to 1
  const rawWeights = Array.from({ length: numBets }, () => Math.random());
  const weightSum = rawWeights.reduce((a, b) => a + b, 0);
  const amounts = rawWeights.map((w) =>
    Math.round((w / weightSum) * adjustedTotal * 100) / 100,
  );

  // Fix rounding by adjusting last amount
  const currentSum = amounts.reduce((a, b) => a + b, 0);
  amounts[amounts.length - 1] += Math.round((adjustedTotal - currentSum) * 100) / 100;

  // Assign targets for each bet
  const targets: string[] = [];
  if (target === 'BOTH') {
    for (let i = 0; i < numBets; i++) {
      targets.push(i % 2 === 0 ? 'CRICKET' : 'CASINO');
    }
    // Shuffle for randomness
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }
  } else {
    for (let i = 0; i < numBets; i++) {
      targets.push(target);
    }
  }

  // Spread scheduledAt timestamps over spreadHrs with random jitter
  const now = Date.now();
  const spreadMs = spreadHrs * 60 * 60 * 1000;
  const interval = spreadMs / numBets;

  const jobs = amounts.map((amount, i) => {
    const baseTime = now + interval * (i + 0.5);
    const jitter = randomBetween(-interval * 0.3, interval * 0.3);
    const scheduledAt = new Date(baseTime + jitter);

    return {
      promoCodeId,
      userId,
      target: targets[i],
      amount,
      scheduledAt,
      status: 'PENDING',
    };
  });

  // Sort by scheduledAt
  jobs.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  await prisma.marketingBetJob.createMany({ data: jobs });
}

// ─── BET PROCESSOR ───────────────────────────────────────

let processorInterval: ReturnType<typeof setInterval> | null = null;

export function startMarketingBetProcessor() {
  if (processorInterval) return;

  console.log('Marketing bet processor started');

  processorInterval = setInterval(async () => {
    try {
      const pendingJobs = await prisma.marketingBetJob.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      });

      for (const job of pendingJobs) {
        try {
          await createFakeWinningBet(job);
          await prisma.marketingBetJob.update({
            where: { id: job.id },
            data: {
              status: 'EXECUTED',
              executedAt: new Date(),
            },
          });
        } catch (err: any) {
          console.error(`Marketing bet job ${job.id} failed:`, err.message);
          await prisma.marketingBetJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              error: err.message || 'Unknown error',
            },
          });
        }
      }
    } catch (err: any) {
      console.error('Marketing bet processor error:', err.message);
    }
  }, 60_000); // every 60 seconds
}

export function stopMarketingBetProcessor() {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
  }
}

// ─── CREATE FAKE WINNING BET ─────────────────────────────

async function createFakeWinningBet(job: {
  id: string;
  userId: string;
  target: string;
  amount: Decimal | number;
}) {
  const profit = toNumber(job.amount);

  if (job.target === 'CRICKET') {
    await createCricketWinningBet(job.id, job.userId, profit);
  } else {
    // Alternate between Aviator and Blackjack
    const useAviator = Math.random() > 0.5;
    if (useAviator) {
      await createAviatorWinningBet(job.id, job.userId, profit);
    } else {
      await createBlackjackWinningBet(job.id, job.userId, profit);
    }
  }
}

// ─── CRICKET WINNING BET ─────────────────────────────────

async function createCricketWinningBet(jobId: string, userId: string, profit: number) {
  // Find an active cricket event, preferably in-play
  let event = await prisma.cricketEvent.findFirst({
    where: { isActive: true, isSettled: false, inPlay: true, isBetLocked: false },
    include: { markets: { where: { isActive: true, isSettled: false, marketType: 'MATCH_ODDS' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
  });

  if (!event) {
    event = await prisma.cricketEvent.findFirst({
      where: { isActive: true, isSettled: false, isBetLocked: false },
      include: { markets: { where: { isActive: true, isSettled: false, marketType: 'MATCH_ODDS' }, take: 1 } },
      orderBy: { startTime: 'desc' },
    });
  }

  if (!event) {
    throw new Error('No active cricket event found');
  }

  const market = event.markets[0];
  const marketId = market?.externalMarketId || event.marketId || 'mkt_auto';
  const marketName = market?.marketName || 'Match Odds';

  // Pick a team randomly
  const isTeam1 = Math.random() > 0.5;
  const runnerName = isTeam1 ? event.team1 : event.team2;
  const selectionId = isTeam1 ? 1 : 2;

  // Generate realistic odds (1.30 - 3.50)
  const odds = Math.round(randomBetween(1.30, 3.50) * 100) / 100;
  const stake = Math.round((profit / (odds - 1)) * 100) / 100;

  // Backdate createdAt slightly before scheduledAt
  const createdAt = new Date(Date.now() - randomInt(30_000, 300_000));

  const result = await prisma.$transaction(async (tx) => {
    const bet = await tx.bet.create({
      data: {
        userId,
        cricketEventId: event!.id,
        marketId,
        selectionId,
        runnerName,
        marketName,
        betType: 'BACK',
        sport: 'CRICKET',
        amount: stake,
        rate: odds,
        back: odds,
        backRate: stake,
        profit,
        loss: stake,
        profitLoss: profit,
        result: 'WON',
        betStatus: 'MATCHED',
        isMatched: true,
        settledAt: new Date(),
        createdAt,
      },
    });

    // Credit user balance
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: profit } },
    });

    // Create transaction
    await tx.transaction.create({
      data: {
        userId,
        type: 'BET_WON',
        amount: profit,
        balance: toNumber(updatedUser.balance),
        remarks: `Won bet on ${runnerName} - ${event!.eventName}`,
        createdBy: userId,
      },
    });

    // Update job with bet reference
    await tx.marketingBetJob.update({
      where: { id: jobId },
      data: { betId: bet.id, betType: 'BET' },
    });

    return { balance: toNumber(updatedUser.balance) };
  });

  // Emit balance update
  if (io) {
    io.to(`user:${userId}`).emit('balance:updated', { balance: result.balance });
  }
}

// ─── AVIATOR WINNING BET ─────────────────────────────────

async function createAviatorWinningBet(jobId: string, userId: string, profit: number) {
  // Find the Aviator game
  const game = await prisma.casinoGame.findUnique({
    where: { gameType: 'AVIATOR' },
  });

  if (!game) throw new Error('Aviator game not found');

  // Find a recent completed round
  let round = await prisma.casinoRound.findFirst({
    where: { gameId: game.id, status: 'COMPLETED' },
    orderBy: { endedAt: 'desc' },
  });

  if (!round) {
    // Create a round if none exist
    const lastRound = await prisma.casinoRound.findFirst({
      where: { gameId: game.id },
      orderBy: { roundNumber: 'desc' },
    });

    const crashPoint = Math.round(randomBetween(1.5, 8.0) * 100) / 100;
    round = await prisma.casinoRound.create({
      data: {
        gameId: game.id,
        roundNumber: (lastRound?.roundNumber || 0) + 1,
        status: 'COMPLETED',
        crashPoint,
        startedAt: new Date(Date.now() - 120_000),
        endedAt: new Date(Date.now() - 60_000),
      },
    });
  }

  // Random cashout multiplier (1.5 - 4.0), must be <= crashPoint
  const maxMult = Math.min(4.0, toNumber(round.crashPoint || 4.0));
  const cashOutMultiplier = Math.round(randomBetween(1.5, Math.max(1.6, maxMult)) * 100) / 100;
  const stake = Math.round((profit / (cashOutMultiplier - 1)) * 100) / 100;

  const createdAt = new Date(Date.now() - randomInt(30_000, 300_000));

  const result = await prisma.$transaction(async (tx) => {
    const casinoBet = await tx.casinoBet.create({
      data: {
        userId,
        roundId: round!.id,
        amount: stake,
        cashOutMultiplier,
        profitLoss: profit,
        status: 'CASHED_OUT',
        settledAt: new Date(),
        createdAt,
      },
    });

    // Credit user balance
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: profit } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'BET_WON',
        amount: profit,
        balance: toNumber(updatedUser.balance),
        remarks: `Aviator cash out at ${cashOutMultiplier}x`,
        createdBy: userId,
      },
    });

    await tx.marketingBetJob.update({
      where: { id: jobId },
      data: { betId: casinoBet.id, betType: 'CASINO_BET' },
    });

    return { balance: toNumber(updatedUser.balance) };
  });

  if (io) {
    io.to(`user:${userId}`).emit('balance:updated', { balance: result.balance });
  }
}

// ─── BLACKJACK WINNING BET ───────────────────────────────

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function cardValue(rank: string): number {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
}

function randomCard(): { rank: string; suit: string; value: number } {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  return { rank, suit, value: cardValue(rank) };
}

function handScore(cards: { rank: string; suit: string; value: number }[]): number {
  let total = cards.reduce((s, c) => s + c.value, 0);
  let aces = cards.filter((c) => c.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function generateWinningBlackjackHands(): {
  playerCards: { rank: string; suit: string; value: number }[];
  playerScore: number;
  dealerCards: { rank: string; suit: string; value: number }[];
  dealerScore: number;
} {
  // Generate a winning player hand (18-21)
  let playerCards: { rank: string; suit: string; value: number }[];
  let playerScore: number;

  do {
    playerCards = [randomCard(), randomCard()];
    playerScore = handScore(playerCards);
    // If too low, hit once
    if (playerScore < 17) {
      playerCards.push(randomCard());
      playerScore = handScore(playerCards);
    }
  } while (playerScore < 18 || playerScore > 21);

  // Generate a losing dealer hand (bust or lower score)
  let dealerCards: { rank: string; suit: string; value: number }[];
  let dealerScore: number;

  const dealerBusts = Math.random() > 0.5;

  if (dealerBusts) {
    // Force a bust: dealer gets 22+
    do {
      dealerCards = [randomCard(), randomCard()];
      dealerScore = handScore(dealerCards);
      while (dealerScore < 17) {
        dealerCards.push(randomCard());
        dealerScore = handScore(dealerCards);
      }
    } while (dealerScore <= 21);
  } else {
    // Dealer gets a lower valid score
    do {
      dealerCards = [randomCard(), randomCard()];
      dealerScore = handScore(dealerCards);
      while (dealerScore < 17) {
        dealerCards.push(randomCard());
        dealerScore = handScore(dealerCards);
      }
    } while (dealerScore > 21 || dealerScore >= playerScore);
  }

  return { playerCards, playerScore, dealerCards, dealerScore };
}

async function createBlackjackWinningBet(jobId: string, userId: string, profit: number) {
  const game = await prisma.casinoGame.findUnique({
    where: { gameType: 'BLACKJACK' },
  });

  if (!game) throw new Error('Blackjack game not found');

  const { playerCards, playerScore, dealerCards, dealerScore } = generateWinningBlackjackHands();

  const stake = profit; // Blackjack pays 1:1

  // Get next round number
  const lastRound = await prisma.casinoRound.findFirst({
    where: { gameId: game.id },
    orderBy: { roundNumber: 'desc' },
  });

  const createdAt = new Date(Date.now() - randomInt(30_000, 300_000));

  const result = await prisma.$transaction(async (tx) => {
    const round = await tx.casinoRound.create({
      data: {
        gameId: game!.id,
        roundNumber: (lastRound?.roundNumber || 0) + 1,
        status: 'COMPLETED',
        dealerCards,
        dealerScore,
        startedAt: createdAt,
        endedAt: new Date(createdAt.getTime() + randomInt(15_000, 60_000)),
      },
    });

    const casinoBet = await tx.casinoBet.create({
      data: {
        userId,
        roundId: round.id,
        amount: stake,
        playerCards,
        playerScore,
        actions: ['DEAL', 'STAND'],
        profitLoss: profit,
        status: 'WON',
        settledAt: new Date(),
        createdAt,
      },
    });

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: profit } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'BET_WON',
        amount: profit,
        balance: toNumber(updatedUser.balance),
        remarks: `Blackjack win - Player ${playerScore} vs Dealer ${dealerScore}`,
        createdBy: userId,
      },
    });

    await tx.marketingBetJob.update({
      where: { id: jobId },
      data: { betId: casinoBet.id, betType: 'CASINO_BET' },
    });

    return { balance: toNumber(updatedUser.balance) };
  });

  if (io) {
    io.to(`user:${userId}`).emit('balance:updated', { balance: result.balance });
  }
}
