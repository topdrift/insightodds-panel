import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { distributeCommission } from '../commission';
import { distributePartnership } from '../partnership';

// ─── CARD & DECK ──────────────────────────────────────────

interface Card {
  rank: string;
  suit: string;
  value: number;
}

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANKS = [
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 10 },
  { rank: 'Q', value: 10 },
  { rank: 'K', value: 10 },
  { rank: 'A', value: 11 },
];

let shoe: Card[] = [];
const NUM_DECKS = 6;

function createShoe(): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < NUM_DECKS; d++) {
    for (const suit of SUITS) {
      for (const { rank, value } of RANKS) {
        deck.push({ rank, suit, value });
      }
    }
  }
  return deck;
}

function shuffleShoe(): void {
  shoe = createShoe();
  // Fisher-Yates with crypto.randomInt
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
}

function drawCard(): Card {
  // Reshuffle if below 25% remaining
  if (shoe.length < (NUM_DECKS * 52 * 0.25)) {
    shuffleShoe();
  }
  return shoe.pop()!;
}

function calculateScore(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += card.value;
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && calculateScore(cards) === 21;
}

// Hide dealer's second card
function hideDealer(cards: Card[]): Card[] {
  if (cards.length < 2) return cards;
  return [cards[0], { rank: '?', suit: '?', value: 0 }];
}

// ─── HAND RESULT ──────────────────────────────────────────

interface HandResult {
  success: boolean;
  hand?: {
    playerCards: Card[];
    dealerCards: Card[];
    playerScore: number;
    dealerScore: number;
    result?: 'WIN' | 'LOSE' | 'PUSH' | 'BLACKJACK' | 'BUST';
    isComplete: boolean;
    payout?: number;
  };
  error?: string;
}

// Initialize shoe on first import
shuffleShoe();

// ─── GAME FUNCTIONS ───────────────────────────────────────

let gameId: string = '';
let minBet: number = 100;
let maxBet: number = 50000;

export async function initBlackjack(): Promise<void> {
  const game = await prisma.casinoGame.findUnique({
    where: { gameType: 'BLACKJACK' },
  });
  if (game) {
    gameId = game.id;
    minBet = parseFloat(game.minBet.toString());
    maxBet = parseFloat(game.maxBet.toString());
  }
  console.log('Blackjack engine initialized');
}

export async function startHand(userId: string, amount: number): Promise<HandResult> {
  if (!gameId) {
    return { success: false, error: 'Blackjack game not configured' };
  }
  if (amount < minBet) return { success: false, error: `Minimum bet is ${minBet}` };
  if (amount > maxBet) return { success: false, error: `Maximum bet is ${maxBet}` };

  // Check user balance and lock
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, isCasinoLocked: true, exposure: true, exposureLimit: true },
  });
  if (!user) return { success: false, error: 'User not found' };
  if (user.isCasinoLocked) return { success: false, error: 'Casino locked for your account' };

  const balance = parseFloat(user.balance.toString());
  if (balance < amount) return { success: false, error: 'Insufficient balance' };

  const exposure = parseFloat(user.exposure.toString());
  const exposureLimit = parseFloat(user.exposureLimit.toString());
  if (exposureLimit > 0 && exposure + amount > exposureLimit) {
    return { success: false, error: 'Exposure limit exceeded' };
  }

  // Deal cards
  const playerCards = [drawCard(), drawCard()];
  const dealerCards = [drawCard(), drawCard()];
  const playerScore = calculateScore(playerCards);
  const dealerScore = calculateScore(dealerCards);

  // Get next round number
  const lastRound = await prisma.casinoRound.findFirst({
    where: { gameId },
    orderBy: { roundNumber: 'desc' },
    select: { roundNumber: true },
  });
  const roundNumber = (lastRound?.roundNumber || 0) + 1;

  // Create round + bet + deduct balance in transaction
  const [_, round] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        balance: { decrement: amount },
        exposure: { increment: amount },
      },
    }),
    prisma.casinoRound.create({
      data: {
        gameId,
        roundNumber,
        status: 'ACTIVE',
        dealerCards: dealerCards as any,
        dealerScore,
      },
    }),
  ]);

  const bet = await prisma.casinoBet.create({
    data: {
      userId,
      roundId: round.id,
      amount,
      playerCards: playerCards as any,
      playerScore,
      actions: ['DEAL'] as any,
      status: 'PENDING',
    },
  });

  await prisma.transaction.create({
    data: {
      userId,
      type: 'BET_PLACED',
      amount: -amount,
      balance: 0,
      remarks: `Blackjack deal - hand #${roundNumber}`,
    },
  });

  // Check for player blackjack
  if (isBlackjack(playerCards)) {
    // Dealer also blackjack = push
    if (isBlackjack(dealerCards)) {
      return await settleHand(bet.id, userId, round.id, amount, playerCards, dealerCards, 'PUSH');
    }
    // Player blackjack pays 3:2
    return await settleHand(bet.id, userId, round.id, amount, playerCards, dealerCards, 'BLACKJACK');
  }

  // Check for dealer blackjack
  if (isBlackjack(dealerCards)) {
    return await settleHand(bet.id, userId, round.id, amount, playerCards, dealerCards, 'LOSE');
  }

  return {
    success: true,
    betId: bet.id,
    hand: {
      playerCards,
      dealerCards: hideDealer(dealerCards),
      playerScore,
      dealerScore: dealerCards[0].value, // only show first card value
      isComplete: false,
    },
  };
}

export async function hit(betId: string, userId: string): Promise<HandResult> {
  const bet = await prisma.casinoBet.findUnique({
    where: { id: betId },
    include: { round: true },
  });
  if (!bet) return { success: false, error: 'Bet not found' };
  if (bet.userId !== userId) return { success: false, error: 'Not your bet' };
  if (bet.status !== 'PENDING') return { success: false, error: 'Hand already completed' };

  const playerCards = bet.playerCards as unknown as Card[];
  const dealerCards = bet.round.dealerCards as unknown as Card[];
  const amount = parseFloat(bet.amount.toString());

  // Draw a card
  const newCard = drawCard();
  playerCards.push(newCard);
  const playerScore = calculateScore(playerCards);
  const actions = [...(bet.actions as any[]), 'HIT'];

  await prisma.casinoBet.update({
    where: { id: betId },
    data: { playerCards: playerCards as any, playerScore, actions: actions as any },
  });

  // Bust check
  if (playerScore > 21) {
    return await settleHand(betId, userId, bet.roundId, amount, playerCards, dealerCards, 'BUST');
  }

  return {
    success: true,
    hand: {
      playerCards,
      dealerCards: hideDealer(dealerCards),
      playerScore,
      dealerScore: dealerCards[0].value,
      isComplete: false,
    },
  };
}

export async function stand(betId: string, userId: string): Promise<HandResult> {
  const bet = await prisma.casinoBet.findUnique({
    where: { id: betId },
    include: { round: true },
  });
  if (!bet) return { success: false, error: 'Bet not found' };
  if (bet.userId !== userId) return { success: false, error: 'Not your bet' };
  if (bet.status !== 'PENDING') return { success: false, error: 'Hand already completed' };

  const playerCards = bet.playerCards as unknown as Card[];
  const dealerCards = bet.round.dealerCards as unknown as Card[];
  const amount = parseFloat(bet.amount.toString());
  const playerScore = calculateScore(playerCards);

  // Dealer plays: hit until >= 17
  while (calculateScore(dealerCards) < 17) {
    dealerCards.push(drawCard());
  }
  const dealerScore = calculateScore(dealerCards);

  // Update dealer cards in round
  await prisma.casinoRound.update({
    where: { id: bet.roundId },
    data: { dealerCards: dealerCards as any, dealerScore },
  });

  // Determine winner
  let result: 'WIN' | 'LOSE' | 'PUSH';
  if (dealerScore > 21) {
    result = 'WIN';
  } else if (playerScore > dealerScore) {
    result = 'WIN';
  } else if (playerScore < dealerScore) {
    result = 'LOSE';
  } else {
    result = 'PUSH';
  }

  return await settleHand(betId, userId, bet.roundId, amount, playerCards, dealerCards, result);
}

export async function doubleDown(betId: string, userId: string): Promise<HandResult> {
  const bet = await prisma.casinoBet.findUnique({
    where: { id: betId },
    include: { round: true },
  });
  if (!bet) return { success: false, error: 'Bet not found' };
  if (bet.userId !== userId) return { success: false, error: 'Not your bet' };
  if (bet.status !== 'PENDING') return { success: false, error: 'Hand already completed' };

  const playerCards = bet.playerCards as unknown as Card[];
  if (playerCards.length !== 2) {
    return { success: false, error: 'Can only double down on initial two cards' };
  }

  const amount = parseFloat(bet.amount.toString());
  const dealerCards = bet.round.dealerCards as unknown as Card[];

  // Check balance for additional amount
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, exposure: true, exposureLimit: true },
  });
  if (!user) return { success: false, error: 'User not found' };

  const balance = parseFloat(user.balance.toString());
  if (balance < amount) return { success: false, error: 'Insufficient balance to double down' };

  // Deduct additional bet
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        balance: { decrement: amount },
        exposure: { increment: amount },
      },
    }),
    prisma.casinoBet.update({
      where: { id: betId },
      data: { amount: amount * 2 },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'BET_PLACED',
        amount: -amount,
        balance: 0,
        remarks: `Blackjack double down`,
      },
    }),
  ]);

  // Draw exactly one card
  const newCard = drawCard();
  playerCards.push(newCard);
  const playerScore = calculateScore(playerCards);
  const totalAmount = amount * 2;

  await prisma.casinoBet.update({
    where: { id: betId },
    data: {
      playerCards: playerCards as any,
      playerScore,
      actions: [...(bet.actions as any[]), 'DOUBLE'] as any,
    },
  });

  // Bust check
  if (playerScore > 21) {
    return await settleHand(betId, userId, bet.roundId, totalAmount, playerCards, dealerCards, 'BUST');
  }

  // Auto-stand: dealer plays
  while (calculateScore(dealerCards) < 17) {
    dealerCards.push(drawCard());
  }
  const dealerScore = calculateScore(dealerCards);

  await prisma.casinoRound.update({
    where: { id: bet.roundId },
    data: { dealerCards: dealerCards as any, dealerScore },
  });

  let result: 'WIN' | 'LOSE' | 'PUSH';
  if (dealerScore > 21) {
    result = 'WIN';
  } else if (playerScore > dealerScore) {
    result = 'WIN';
  } else if (playerScore < dealerScore) {
    result = 'LOSE';
  } else {
    result = 'PUSH';
  }

  return await settleHand(betId, userId, bet.roundId, totalAmount, playerCards, dealerCards, result);
}

// ─── SETTLE ───────────────────────────────────────────────

async function settleHand(
  betId: string,
  userId: string,
  roundId: string,
  amount: number,
  playerCards: Card[],
  dealerCards: Card[],
  result: 'WIN' | 'LOSE' | 'PUSH' | 'BLACKJACK' | 'BUST'
): Promise<HandResult> {
  const playerScore = calculateScore(playerCards);
  const dealerScore = calculateScore(dealerCards);

  let payout = 0;
  let profitLoss = 0;
  let betStatus: 'WON' | 'LOST' | 'CANCELLED';

  switch (result) {
    case 'BLACKJACK':
      payout = amount + amount * 1.5; // 3:2 pays
      profitLoss = amount * 1.5;
      betStatus = 'WON';
      break;
    case 'WIN':
      payout = amount * 2;
      profitLoss = amount;
      betStatus = 'WON';
      break;
    case 'PUSH':
      payout = amount; // refund
      profitLoss = 0;
      betStatus = 'CANCELLED';
      break;
    case 'LOSE':
    case 'BUST':
      payout = 0;
      profitLoss = -amount;
      betStatus = 'LOST';
      break;
  }

  // Settle in transaction
  const txns: any[] = [
    prisma.casinoBet.update({
      where: { id: betId },
      data: {
        status: betStatus,
        profitLoss,
        playerCards: playerCards as any,
        playerScore,
        settledAt: new Date(),
      },
    }),
    prisma.casinoRound.update({
      where: { id: roundId },
      data: {
        status: 'COMPLETED',
        dealerCards: dealerCards as any,
        dealerScore,
        endedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        exposure: { decrement: amount },
        ...(payout > 0 ? { balance: { increment: payout } } : {}),
      },
    }),
  ];

  if (payout > 0) {
    txns.push(
      prisma.transaction.create({
        data: {
          userId,
          type: profitLoss > 0 ? 'BET_WON' : 'BET_VOID',
          amount: payout,
          balance: 0,
          remarks: `Blackjack ${result} - payout ${payout}`,
        },
      })
    );
  }

  await prisma.$transaction(txns);

  // Commission & partnership
  if (profitLoss !== 0) {
    // profitLoss negative = player lost = platform profit (positive for commission)
    distributeCommission(betId, userId, Math.abs(profitLoss), 'CASINO', 'match').catch(console.error);
    // Partnership: positive = platform profit (player lost), negative = platform loss (player won)
    distributePartnership(userId, -profitLoss, 'casino').catch(console.error);
  }

  return {
    success: true,
    hand: {
      playerCards,
      dealerCards,
      playerScore,
      dealerScore,
      result,
      isComplete: true,
      payout,
    },
  };
}
