import { Router, Response } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { settleMatkaMarket } from '../services/settlement';

const router = Router();

// ═══════════════════════════════════════════════════════════════
//  ADMIN ENDPOINTS (SUPER_ADMIN, ADMIN)
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/matka/admin/matka ─────────────────────────────
router.get(
  '/admin/matka',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const matkas = await prisma.matka.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { markets: true } } },
      });
      res.json({ matkas });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch matka games' });
    }
  }
);

// ─── POST /api/matka/admin/matka ────────────────────────────
router.post(
  '/admin/matka',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        openTime: z.string(), // HH:mm
        closeTime: z.string(),
        resultTime: z.string(),
        minStack: z.number().min(0),
        maxStack: z.number().min(0),
        isEnabled: z.boolean().default(true),
      });
      const data = schema.parse(req.body);

      const matka = await prisma.matka.create({
        data: {
          name: data.name,
          openTime: data.openTime,
          closeTime: data.closeTime,
          resultTime: data.resultTime,
          minStack: data.minStack,
          maxStack: data.maxStack,
          isEnabled: data.isEnabled,
        },
      });

      res.status(201).json(matka);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
      res.status(500).json({ error: 'Failed to create matka' });
    }
  }
);

// ─── GET /api/matka/admin/matka/:id ─────────────────────────
router.get(
  '/admin/matka/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const matka = await prisma.matka.findUnique({
        where: { id: req.params.id },
        include: {
          markets: { orderBy: { createdAt: 'desc' } },
        },
      });

      if (!matka) return res.status(404).json({ error: 'Matka not found' });
      res.json(matka);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch matka' });
    }
  }
);

// ─── PUT /api/matka/admin/matka/:id ─────────────────────────
router.put(
  '/admin/matka/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        openTime: z.string().optional(),
        closeTime: z.string().optional(),
        resultTime: z.string().optional(),
        minStack: z.number().min(0).optional(),
        maxStack: z.number().min(0).optional(),
        isEnabled: z.boolean().optional(),
      });
      const data = schema.parse(req.body);

      const existing = await prisma.matka.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Matka not found' });

      const matka = await prisma.matka.update({
        where: { id: req.params.id },
        data,
      });

      res.json(matka);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
      res.status(500).json({ error: 'Failed to update matka' });
    }
  }
);

// ─── DELETE /api/matka/admin/matka/:id ──────────────────────
router.delete(
  '/admin/matka/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await prisma.matka.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Matka not found' });

      await prisma.matka.delete({ where: { id: req.params.id } });
      res.json({ message: 'Matka deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete matka' });
    }
  }
);

// ─── GET /api/matka/admin/matka-market ──────────────────────
router.get(
  '/admin/matka-market',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { isSettled } = req.query as { isSettled?: string };

      const where: any = {};
      if (isSettled === 'true') where.isMarketSettled = true;
      if (isSettled === 'false') where.isMarketSettled = false;

      const markets = await prisma.matkaMarket.findMany({
        where,
        include: { matka: true },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ markets });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch matka markets' });
    }
  }
);

// ─── PUT /api/matka/admin/matka-market/:id ──────────────────
router.put(
  '/admin/matka-market/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        isActive: z.boolean().optional(),
        isEnabled: z.boolean().optional(),
        minStack: z.number().min(0).optional(),
        maxStack: z.number().min(0).optional(),
      });
      const data = schema.parse(req.body);

      const existing = await prisma.matkaMarket.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Matka market not found' });

      const market = await prisma.matkaMarket.update({
        where: { id: req.params.id },
        data,
      });

      res.json(market);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
      res.status(500).json({ error: 'Failed to update matka market' });
    }
  }
);

// ─── GET /api/matka/admin/client-bets ───────────────────────
router.get(
  '/admin/client-bets',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { marketId, betStatus } = req.query as { marketId?: string; betStatus?: string };

      const where: any = {};
      if (marketId) where.matkaMarketId = marketId;
      if (betStatus) where.betStatus = betStatus;

      const bets = await prisma.matkaBet.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, name: true } },
          matkaMarket: { include: { matka: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ bets });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch client bets' });
    }
  }
);

// ─── PUT /api/matka/settleMarket ────────────────────────────
router.put(
  '/settleMarket',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        marketId: z.string(),
        result: z.number().int(),
        isRollback: z.boolean().default(false),
      });
      const data = schema.parse(req.body);

      await settleMatkaMarket({
        marketId: data.marketId,
        result: data.result,
        isRollback: data.isRollback,
      });

      res.json({ message: data.isRollback ? 'Market rolled back successfully' : 'Market settled successfully' });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
      res.status(400).json({ error: err.message || 'Failed to settle market' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
//  USER ENDPOINTS (authenticated)
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/matka/games ────────────────────────────────────
router.get('/games', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const matkas = await prisma.matka.findMany({
      where: { isEnabled: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { markets: true } },
        markets: {
          where: { isActive: true, isMarketSettled: false },
          select: { id: true, dateId: true, isActive: true, isMarketSettled: true, minStack: true, maxStack: true },
        },
      },
    });
    res.json({ games: matkas });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matka games' });
  }
});

// ─── GET /api/matka/markets/:gameId ─────────────────────────
router.get('/markets/:gameId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const markets = await prisma.matkaMarket.findMany({
      where: {
        matkaId: gameId,
        isActive: true,
      },
      include: { matka: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ markets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matka markets' });
  }
});

// ─── GET /api/matka/matka-market ────────────────────────────
router.get('/matka-market', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const markets = await prisma.matkaMarket.findMany({
      where: {
        isActive: true,
        isMarketSettled: false,
      },
      include: { matka: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ markets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matka markets' });
  }
});

// ─── POST /api/matka/bet-lock ───────────────────────────────
router.post('/bet-lock', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      marketId: z.string(),
      betType: z.enum(['ANDAR_DHAI', 'BAHAR_HARUF', 'JODI']),
      betLockNumberAndAmountDTOList: z.array(
        z.object({
          number: z.number().int(),
          amount: z.number().positive(),
        })
      ).min(1),
    });
    const data = schema.parse(req.body);
    const { userId } = req.user!;

    const result = await prisma.$transaction(async (tx) => {
      // Validate user
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');
      if (!user.isActive) throw new Error('Account is not active');
      if (user.isMatkaLocked) throw new Error('Matka betting is locked for your account');

      // Validate market
      const market = await tx.matkaMarket.findUnique({
        where: { id: data.marketId },
        include: { matka: true },
      });
      if (!market) throw new Error('Market not found');
      if (!market.isActive) throw new Error('Market is not active');
      if (!market.isEnabled) throw new Error('Market is not enabled');
      if (market.isMarketSettled) throw new Error('Market is already settled');

      // Calculate total amount
      const totalAmount = data.betLockNumberAndAmountDTOList.reduce((sum, item) => sum + item.amount, 0);

      // Validate individual bet amounts against market limits
      const minStack = parseFloat(market.minStack.toString());
      const maxStack = parseFloat(market.maxStack.toString());

      for (const item of data.betLockNumberAndAmountDTOList) {
        if (item.amount < minStack) {
          throw new Error(`Minimum bet amount is ${minStack}`);
        }
        if (item.amount > maxStack) {
          throw new Error(`Maximum bet amount is ${maxStack}`);
        }
      }

      // Check balance
      const balance = new Decimal(user.balance.toString());
      const exposure = new Decimal(user.exposure.toString());
      const availableBalance = balance.minus(exposure);
      const totalAmountDecimal = new Decimal(totalAmount);

      if (availableBalance.lt(totalAmountDecimal)) {
        throw new Error('Insufficient balance');
      }

      // Create bet
      const bet = await tx.matkaBet.create({
        data: {
          userId,
          matkaMarketId: data.marketId,
          betType: data.betType,
          numbers: data.betLockNumberAndAmountDTOList,
          totalAmount,
          betStatus: 'MATCHED',
          ip: req.ip || undefined,
        },
      });

      // Deduct balance, add to exposure
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: totalAmount },
          exposure: { increment: totalAmount },
        },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'BET_PLACED',
          amount: -totalAmount,
          balance: parseFloat(updatedUser.balance.toString()),
          reference: bet.id,
          remarks: `Matka ${data.betType} bet on ${market.matka.name}`,
        },
      });

      return { bet, balance: updatedUser.balance, exposure: updatedUser.exposure };
    });

    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('balance:updated', {
        balance: result.balance,
        exposure: result.exposure,
      });
    }

    res.status(201).json(result.bet);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(400).json({ error: err.message || 'Failed to place matka bet' });
  }
});

// ─── GET /api/matka/:marketId/my-bets ───────────────────────
router.get('/:marketId/my-bets', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const { marketId } = req.params;

    const bets = await prisma.matkaBet.findMany({
      where: {
        userId,
        matkaMarketId: marketId,
      },
      include: {
        matkaMarket: { include: { matka: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ bets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// ─── GET /api/matka/pl-exposure ─────────────────────────────
router.get('/pl-exposure', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const { marketId } = req.query as { marketId?: string };

    if (!marketId) {
      return res.status(400).json({ error: 'marketId is required' });
    }

    const bets = await prisma.matkaBet.findMany({
      where: {
        userId,
        matkaMarketId: marketId,
        betStatus: 'MATCHED',
      },
    });

    // Calculate exposure per bet type
    let totalInvested = 0;
    let potentialProfit = 0;
    let potentialLoss = 0;

    for (const bet of bets) {
      const numbers = bet.numbers as Array<{ number: number; amount: number }>;
      for (const entry of numbers) {
        totalInvested += entry.amount;
        if (bet.betType === 'JODI') {
          potentialProfit += entry.amount * 90;
          potentialLoss += entry.amount;
        } else {
          // ANDAR_DHAI / BAHAR_HARUF
          potentialProfit += entry.amount * 9;
          potentialLoss += entry.amount;
        }
      }
    }

    res.json({
      marketId,
      totalInvested,
      potentialProfit,
      potentialLoss,
      betsCount: bets.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch P&L exposure' });
  }
});

export default router;
