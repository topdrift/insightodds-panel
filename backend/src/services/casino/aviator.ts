import crypto from 'crypto';
import { Server as SocketServer } from 'socket.io';
import { prisma } from '../../utils/prisma';
import { distributeCommission } from '../commission';
import { distributePartnership } from '../partnership';

interface AviatorBet {
  betId: string;
  userId: string;
  amount: number;
  cashedOut: boolean;
}

type RoundPhase = 'WAITING' | 'BETTING' | 'FLYING' | 'CRASHED';

class AviatorEngine {
  private io: SocketServer | null = null;
  private gameId: string = '';
  private roundNumber: number = 0;
  private currentRoundId: string = '';
  private phase: RoundPhase = 'WAITING';
  private crashPoint: number = 0;
  private serverSeed: string = '';
  private hashChain: string = '';
  private currentMultiplier: number = 1.0;
  private bets: Map<string, AviatorBet> = new Map(); // keyed by `${userId}`
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private startedFlying: number = 0;
  private minBet: number = 10;
  private maxBet: number = 100000;
  private shuttingDown: boolean = false;

  /**
   * Generate a provably fair crash point.
   * ~3% chance of instant 1.00x crash (house edge).
   * Otherwise exponential distribution.
   */
  private generateCrashPoint(): { crashPoint: number; serverSeed: string; hashChain: string } {
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const hashChain = crypto.createHash('sha256').update(serverSeed).digest('hex');

    // Use first 8 hex chars (32 bits) for crash point
    const hashInt = parseInt(hashChain.substring(0, 8), 16);
    const maxVal = 0xFFFFFFFF;

    // 1 in 33 chance of instant crash (~3% house edge)
    if (hashInt % 33 === 0) {
      return { crashPoint: 1.0, serverSeed, hashChain };
    }

    // Standard crash game formula: (2^32 / (hash + 1)) * (1 - houseEdge)
    // Produces values like 1.01x .. 100x with exponential distribution
    const e = (maxVal + 1) / (hashInt + 1);
    const crashPoint = Math.max(1.01, Math.floor(e * 97) / 100); // 3% house edge

    // Cap at 100x
    return {
      crashPoint: Math.min(crashPoint, 100),
      serverSeed,
      hashChain,
    };
  }

  async initialize(io: SocketServer): Promise<void> {
    this.io = io;

    // Load or create game from DB
    const game = await prisma.casinoGame.findUnique({
      where: { gameType: 'AVIATOR' },
    });

    if (!game) {
      console.error('Aviator game not found in database. Run seed first.');
      return;
    }

    this.gameId = game.id;
    this.minBet = parseFloat(game.minBet.toString());
    this.maxBet = parseFloat(game.maxBet.toString());

    // Get last round number
    const lastRound = await prisma.casinoRound.findFirst({
      where: { gameId: this.gameId },
      orderBy: { roundNumber: 'desc' },
      select: { roundNumber: true },
    });
    this.roundNumber = lastRound?.roundNumber || 0;

    console.log('Aviator engine initialized, starting first round...');
    this.startNewRound();
  }

  private async startNewRound(): Promise<void> {
    if (this.shuttingDown) return;

    this.roundNumber++;
    this.bets.clear();
    this.currentMultiplier = 1.0;

    const { crashPoint, serverSeed, hashChain } = this.generateCrashPoint();
    this.crashPoint = crashPoint;
    this.serverSeed = serverSeed;
    this.hashChain = hashChain;

    // Create round in DB
    const round = await prisma.casinoRound.create({
      data: {
        gameId: this.gameId,
        roundNumber: this.roundNumber,
        status: 'BETTING',
        crashPoint: this.crashPoint,
        serverSeed: this.serverSeed,
        hashChain: this.hashChain,
      },
    });
    this.currentRoundId = round.id;
    this.phase = 'BETTING';

    // Broadcast round start
    this.emit('aviator:round-start', {
      roundId: this.currentRoundId,
      roundNumber: this.roundNumber,
      hashChain: this.hashChain,
      phase: 'BETTING',
      countdown: 10,
    });

    // Wait 10s for bets, then fly
    this.phaseTimer = setTimeout(() => {
      this.startFlying();
    }, 10000);
  }

  private async startFlying(): Promise<void> {
    if (this.shuttingDown) return;

    this.phase = 'FLYING';
    this.currentMultiplier = 1.0;
    this.startedFlying = Date.now();

    await prisma.casinoRound.update({
      where: { id: this.currentRoundId },
      data: { status: 'ACTIVE' },
    });

    this.emit('aviator:flying', {
      roundId: this.currentRoundId,
      roundNumber: this.roundNumber,
    });

    // Tick every 100ms — increment multiplier
    this.tickTimer = setInterval(() => {
      this.currentMultiplier += 0.06;
      this.currentMultiplier = Math.round(this.currentMultiplier * 100) / 100;

      if (this.currentMultiplier >= this.crashPoint) {
        this.crash();
      } else {
        this.emit('aviator:tick', {
          multiplier: this.currentMultiplier,
          roundId: this.currentRoundId,
        });
      }
    }, 100);
  }

  private async crash(): Promise<void> {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    this.phase = 'CRASHED';

    await prisma.casinoRound.update({
      where: { id: this.currentRoundId },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });

    // Settle all uncashed bets as LOST
    const unsettledBets = Array.from(this.bets.values()).filter((b) => !b.cashedOut);

    for (const bet of unsettledBets) {
      try {
        await prisma.$transaction([
          prisma.casinoBet.update({
            where: { id: bet.betId },
            data: {
              status: 'LOST',
              profitLoss: -bet.amount,
              settledAt: new Date(),
            },
          }),
          prisma.transaction.create({
            data: {
              userId: bet.userId,
              type: 'BET_LOST',
              amount: -bet.amount,
              balance: 0,
              remarks: `Aviator round #${this.roundNumber} - crashed at ${this.crashPoint}x`,
            },
          }),
        ]);

        // Platform profit — distribute commission and partnership
        // profitLoss positive = platform profit (player lost)
        distributeCommission(bet.betId, bet.userId, bet.amount, 'CASINO', 'match').catch(console.error);
        distributePartnership(bet.userId, bet.amount, 'casino').catch(console.error);
      } catch (e) {
        console.error('Aviator settle error:', e);
      }
    }

    // Broadcast crash — reveal serverSeed
    this.emit('aviator:crashed', {
      roundId: this.currentRoundId,
      roundNumber: this.roundNumber,
      crashPoint: this.crashPoint,
      serverSeed: this.serverSeed,
      hashChain: this.hashChain,
    });

    // Wait 5s then start new round
    this.phaseTimer = setTimeout(() => {
      this.startNewRound();
    }, 5000);
  }

  async placeBet(
    userId: string,
    amount: number
  ): Promise<{ success: boolean; betId?: string; error?: string }> {
    if (this.phase !== 'BETTING') {
      return { success: false, error: 'Betting phase is over' };
    }

    if (this.bets.has(userId)) {
      return { success: false, error: 'Already placed a bet this round' };
    }

    if (amount < this.minBet) {
      return { success: false, error: `Minimum bet is ${this.minBet}` };
    }
    if (amount > this.maxBet) {
      return { success: false, error: `Maximum bet is ${this.maxBet}` };
    }

    // Check user balance and casino lock
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, isCasinoLocked: true, exposure: true, exposureLimit: true },
    });

    if (!user) return { success: false, error: 'User not found' };
    if (user.isCasinoLocked) return { success: false, error: 'Casino is locked for your account' };

    const balance = parseFloat(user.balance.toString());
    if (balance < amount) {
      return { success: false, error: 'Insufficient balance' };
    }

    const exposure = parseFloat(user.exposure.toString());
    const exposureLimit = parseFloat(user.exposureLimit.toString());
    if (exposureLimit > 0 && exposure + amount > exposureLimit) {
      return { success: false, error: 'Exposure limit exceeded' };
    }

    // Deduct balance, add exposure
    const [_, casinoBet] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
          exposure: { increment: amount },
        },
      }),
      prisma.casinoBet.create({
        data: {
          userId,
          roundId: this.currentRoundId,
          amount,
          status: 'PENDING',
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'BET_PLACED',
          amount: -amount,
          balance: 0,
          remarks: `Aviator bet - round #${this.roundNumber}`,
        },
      }),
    ]);

    this.bets.set(userId, {
      betId: casinoBet.id,
      userId,
      amount,
      cashedOut: false,
    });

    // Emit balance update
    this.emitToUser(userId, 'balance-update', {
      balance: balance - amount,
      exposure: exposure + amount,
    });

    return { success: true, betId: casinoBet.id };
  }

  async cashOut(
    userId: string,
    betId: string
  ): Promise<{ success: boolean; multiplier?: number; payout?: number; error?: string }> {
    if (this.phase !== 'FLYING') {
      return { success: false, error: 'Can only cash out during flight' };
    }

    const bet = this.bets.get(userId);
    if (!bet || bet.betId !== betId) {
      return { success: false, error: 'Bet not found' };
    }
    if (bet.cashedOut) {
      return { success: false, error: 'Already cashed out' };
    }

    const multiplier = this.currentMultiplier;
    const payout = Math.round(bet.amount * multiplier * 100) / 100;
    const profitLoss = payout - bet.amount;
    bet.cashedOut = true;

    // Credit user balance, remove exposure
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, exposure: true },
    });

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: payout },
          exposure: { decrement: bet.amount },
        },
      }),
      prisma.casinoBet.update({
        where: { id: betId },
        data: {
          status: 'CASHED_OUT',
          cashOutMultiplier: multiplier,
          profitLoss,
          settledAt: new Date(),
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'BET_WON',
          amount: payout,
          balance: 0,
          remarks: `Aviator cash out at ${multiplier}x - round #${this.roundNumber}`,
        },
      }),
    ]);

    // Player won → platform loss → negative PL for partnership
    if (profitLoss > 0) {
      distributeCommission(betId, userId, profitLoss, 'CASINO', 'match').catch(console.error);
      distributePartnership(userId, -profitLoss, 'casino').catch(console.error);
    }

    // Emit balance update
    if (user) {
      const newBalance = parseFloat(user.balance.toString()) + payout;
      const newExposure = parseFloat(user.exposure.toString()) - bet.amount;
      this.emitToUser(userId, 'balance-update', {
        balance: newBalance,
        exposure: newExposure,
      });
    }

    // Broadcast cashout to room
    this.emit('aviator:cashout', {
      userId,
      multiplier,
      payout,
      roundId: this.currentRoundId,
    });

    return { success: true, multiplier, payout };
  }

  getCurrentState(): {
    roundId: string;
    roundNumber: number;
    phase: RoundPhase;
    currentMultiplier?: number;
    hashChain?: string;
    bettingEndsIn?: number;
  } {
    const state: any = {
      roundId: this.currentRoundId,
      roundNumber: this.roundNumber,
      phase: this.phase,
      hashChain: this.hashChain,
    };

    if (this.phase === 'FLYING') {
      state.currentMultiplier = this.currentMultiplier;
    }

    return state;
  }

  shutdown(): void {
    this.shuttingDown = true;
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    console.log('Aviator engine shut down');
  }

  private emit(event: string, data: any): void {
    if (this.io) {
      this.io.to('casino:aviator').emit(event, data);
    }
  }

  private emitToUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }
}

export const aviatorEngine = new AviatorEngine();
