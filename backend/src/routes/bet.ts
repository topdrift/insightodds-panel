import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { settleMatchMarket, settleFancyMarket } from '../services/settlement';
import { automationEngine } from '../services/automation';

const router = Router();
router.use(authenticate);

// ─── VALIDATION SCHEMAS ───────────────────────────────────────

const BetLockDTO = z.object({
  amount: z.number().positive(),
  eventId: z.number().int(),
  marketId: z.string(),
  selectionId: z.number().int(),
  runnerName: z.string(),
  marketName: z.string(),
  back: z.number().optional(),
  backRate: z.number().optional(),
  lay: z.number().optional(),
  layRate: z.number().optional(),
  profit: z.number(),
  loss: z.number(),
});

const FancyBetLockDTO = z.object({
  amount: z.number().positive(),
  eventId: z.number().int(),
  marketId: z.string(),
  marketName: z.string(),
  runnerName: z.string(),
  gameType: z.string().optional(),
  oddsBack: z.number().optional(),
  oddsLay: z.number().optional(),
  backRate: z.number().optional(),
  layRate: z.number().optional(),
  profit: z.number(),
  loss: z.number(),
});

const BetSettleDto = z.object({
  eventId: z.number().int(),
  marketId: z.string(),
  winnerSelectionId: z.number().int(),
  winnerName: z.string(),
  abandoned: z.boolean().optional(),
  tie: z.boolean().optional(),
});

const FancyBetSettleDto = z.object({
  eventId: z.number().int(),
  marketId: z.string(),
  finalScore: z.number(),
  abandoned: z.boolean().optional(),
});

// ─── USER ENDPOINTS ───────────────────────────────────────────

// POST /api/bet/place — Place regular bet
router.post('/place', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const body = BetLockDTO.parse(req.body);

    // Check bet delay from automation engine
    const delay = automationEngine.getBetDelay(userId, body.amount);
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Validate user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.isActive) return res.status(403).json({ error: 'Account is inactive' });
    if (user.isBetLocked) return res.status(403).json({ error: 'Betting is locked for your account' });

    // Validate event
    const event = await prisma.cricketEvent.findUnique({ where: { cricketId: body.eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!event.isActive) return res.status(400).json({ error: 'Event is not active' });
    if (event.isBetLocked) return res.status(400).json({ error: 'Betting is locked for this event' });

    // Check per-user bet lock
    if (event.betLockedUsers.includes(userId)) {
      return res.status(403).json({ error: 'Betting is locked for you on this event' });
    }

    // Check auto-lock from automation engine
    const shouldLock = await automationEngine.shouldAutoLock(event.id, body.marketId);
    if (shouldLock) {
      return res.status(400).json({ error: 'Market is temporarily locked due to high exposure' });
    }

    // Validate bet amount against event limits
    if (body.amount < parseFloat(event.minBet.toString())) {
      return res.status(400).json({ error: `Minimum bet is ${event.minBet}` });
    }
    if (body.amount > parseFloat(event.maxBet.toString())) {
      return res.status(400).json({ error: `Maximum bet is ${event.maxBet}` });
    }

    // Check balance
    const balance = parseFloat(user.balance.toString());
    const exposure = parseFloat(user.exposure.toString());
    const available = balance - exposure;

    if (available < body.amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Determine bet type
    const betType = (body.back && body.back > 0) ? 'BACK' : 'LAY';
    const rate = betType === 'BACK'
      ? (body.backRate || body.back || 0)
      : (body.layRate || body.lay || 0);

    // Create bet in transaction
    const result = await prisma.$transaction(async (tx) => {
      const bet = await tx.bet.create({
        data: {
          userId,
          cricketEventId: event.id,
          marketId: body.marketId,
          selectionId: body.selectionId,
          runnerName: body.runnerName,
          marketName: body.marketName,
          betType,
          amount: body.amount,
          rate,
          back: body.back,
          backRate: body.backRate,
          lay: body.lay,
          layRate: body.layRate,
          profit: body.profit,
          loss: body.loss,
          betStatus: 'MATCHED',
          isMatched: true,
          ip: req.ip || undefined,
        },
      });

      // Deduct from balance, add to exposure
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: body.amount },
          exposure: { increment: body.amount },
        },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'BET_PLACED',
          amount: -body.amount,
          balance: parseFloat(updatedUser.balance.toString()),
          reference: bet.id,
          remarks: `${betType} ${body.runnerName} @ ${rate} - ${event.eventName}`,
          createdBy: userId,
        },
      });

      return { bet, balance: updatedUser.balance, exposure: updatedUser.exposure };
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit(`bet:update:${userId}`, {
        bet: result.bet,
        balance: result.balance,
        exposure: result.exposure,
      });
      io.to(`user:${userId}`).emit('balance:updated', {
        balance: result.balance,
        exposure: result.exposure,
      });
    }

    res.status(201).json({ status: 'success', data: result.bet });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('place bet error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to place bet' });
  }
});

// POST /api/bet/fancy-place — Place fancy bet
router.post('/fancy-place', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const body = FancyBetLockDTO.parse(req.body);

    // Check bet delay from automation engine
    const fancyDelay = automationEngine.getBetDelay(userId, body.amount);
    if (fancyDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, fancyDelay));
    }

    // Validate user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.isActive) return res.status(403).json({ error: 'Account is inactive' });
    if (user.isBetLocked) return res.status(403).json({ error: 'Betting is locked for your account' });

    // Validate event
    const event = await prisma.cricketEvent.findUnique({ where: { cricketId: body.eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!event.isActive) return res.status(400).json({ error: 'Event is not active' });
    if (event.isFancyLocked) return res.status(400).json({ error: 'Fancy betting is locked for this event' });

    // Check per-user fancy lock
    if (event.fancyLockedUsers.includes(userId)) {
      return res.status(403).json({ error: 'Fancy betting is locked for you on this event' });
    }

    // Check balance
    const balance = parseFloat(user.balance.toString());
    const exposure = parseFloat(user.exposure.toString());
    const available = balance - exposure;

    if (available < body.amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Create fancy bet in transaction
    const result = await prisma.$transaction(async (tx) => {
      const fancyBet = await tx.fancyBet.create({
        data: {
          userId,
          cricketEventId: event.id,
          marketId: body.marketId,
          marketName: body.marketName,
          runnerName: body.runnerName,
          gameType: body.gameType,
          amount: body.amount,
          oddsBack: body.oddsBack,
          oddsLay: body.oddsLay,
          backRate: body.backRate,
          layRate: body.layRate,
          profit: body.profit,
          loss: body.loss,
          betStatus: 'MATCHED',
          ip: req.ip || undefined,
        },
      });

      // Deduct from balance, add to exposure
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: body.amount },
          exposure: { increment: body.amount },
        },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'BET_PLACED',
          amount: -body.amount,
          balance: parseFloat(updatedUser.balance.toString()),
          reference: fancyBet.id,
          remarks: `Fancy: ${body.runnerName} - ${body.marketName} - ${event.eventName}`,
          createdBy: userId,
        },
      });

      return { fancyBet, balance: updatedUser.balance, exposure: updatedUser.exposure };
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit(`bet:update:${userId}`, {
        fancyBet: result.fancyBet,
        balance: result.balance,
        exposure: result.exposure,
      });
      io.to(`user:${userId}`).emit('balance:updated', {
        balance: result.balance,
        exposure: result.exposure,
      });
    }

    res.status(201).json({ status: 'success', data: result.fancyBet });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('fancy-place error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to place fancy bet' });
  }
});

// GET /api/bet/my-bet/:eventId — Get user's bets for an event (eventId = cricketId)
router.get('/my-bet/:eventId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const cricketId = parseInt(req.params.eventId);

    if (isNaN(cricketId)) {
      return res.status(400).json({ error: 'Invalid eventId' });
    }

    const event = await prisma.cricketEvent.findUnique({ where: { cricketId } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const [bets, fancyBets] = await Promise.all([
      prisma.bet.findMany({
        where: { userId, cricketEventId: event.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fancyBet.findMany({
        where: { userId, cricketEventId: event.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({ status: 'success', data: { bets, fancyBets } });
  } catch (err: any) {
    console.error('my-bet error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user bets' });
  }
});

// GET /api/bet/bet-count — Return count of user's unmatched/matched bets
router.get('/bet-count', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;

    const [matched, unmatched] = await Promise.all([
      prisma.bet.count({ where: { userId, betStatus: 'MATCHED', settledAt: null } }),
      prisma.bet.count({ where: { userId, betStatus: 'UNMATCHED' } }),
    ]);

    res.json({ status: 'success', data: { matched, unmatched } });
  } catch (err: any) {
    console.error('bet-count error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bet count' });
  }
});

// ─── ADMIN: SETTLEMENT ENDPOINTS ──────────────────────────────

// PUT /api/bet/settleMarket — Settle a match market
router.put(
  '/settleMarket',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const body = BetSettleDto.parse(req.body);

      await settleMatchMarket({
        eventId: body.eventId,
        marketId: body.marketId,
        winnerSelectionId: body.winnerSelectionId,
        winnerName: body.winnerName,
        abandoned: body.abandoned,
        tie: body.tie,
      });

      res.json({ status: 'success', message: 'Market settled successfully' });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      console.error('settleMarket error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to settle market' });
    }
  }
);

// POST /api/bet/settleMarketFancy — Settle a fancy market
router.post(
  '/settleMarketFancy',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const body = FancyBetSettleDto.parse(req.body);

      await settleFancyMarket({
        eventId: body.eventId,
        marketId: body.marketId,
        finalScore: body.finalScore,
        abandoned: body.abandoned,
      });

      res.json({ status: 'success', message: 'Fancy market settled successfully' });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      console.error('settleMarketFancy error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to settle fancy market' });
    }
  }
);

// ─── ADMIN: BET MANAGEMENT ENDPOINTS ──────────────────────────

// GET /api/bet/admin/client-bets/:eventId — Get all bets for an event
router.get(
  '/admin/client-bets/:eventId',
  authorize('SUPER_ADMIN', 'ADMIN', 'AGENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketId = parseInt(req.params.eventId);
      if (isNaN(cricketId)) {
        return res.status(400).json({ error: 'Invalid eventId' });
      }

      const { betStatus, isFancy } = req.query;

      const event = await prisma.cricketEvent.findUnique({ where: { cricketId } });
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const isFancyBool = isFancy === 'true';

      if (isFancyBool) {
        const where: any = { cricketEventId: event.id };
        if (betStatus) where.betStatus = betStatus as string;

        const fancyBets = await prisma.fancyBet.findMany({
          where,
          include: {
            user: { select: { id: true, username: true, name: true, role: true, parentId: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        return res.json({ status: 'success', data: fancyBets });
      }

      const where: any = { cricketEventId: event.id };
      if (betStatus) where.betStatus = betStatus as string;

      const bets = await prisma.bet.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, name: true, role: true, parentId: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ status: 'success', data: bets });
    } catch (err: any) {
      console.error('admin/client-bets error:', err.message);
      res.status(500).json({ error: 'Failed to fetch client bets' });
    }
  }
);

// PUT /api/bet/admin/client-bets/:betId/status — Update bet status
router.put(
  '/admin/client-bets/:betId/status',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { betId } = req.params;
      const betStatus = req.query.betStatus as string;

      const statusSchema = z.enum(['MATCHED', 'UNMATCHED', 'DELETED']);
      const validatedStatus = statusSchema.parse(betStatus);

      const bet = await prisma.bet.update({
        where: { id: betId },
        data: { betStatus: validatedStatus },
      });

      res.json({ status: 'success', data: bet });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid betStatus. Must be MATCHED, UNMATCHED, or DELETED' });
      }
      console.error('admin/client-bets status error:', err.message);
      res.status(500).json({ error: 'Failed to update bet status' });
    }
  }
);

// PUT /api/bet/admin/client-bets/:betIds/group-delete — Delete multiple bets by comma-separated IDs
router.put(
  '/admin/client-bets/:betIds/group-delete',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { betIds } = req.params;
      const ids = betIds.split(',').map((id) => id.trim()).filter(Boolean);

      if (ids.length === 0) {
        return res.status(400).json({ error: 'No bet IDs provided' });
      }

      const result = await prisma.bet.updateMany({
        where: { id: { in: ids } },
        data: { betStatus: 'DELETED' },
      });

      res.json({ status: 'success', data: { deletedCount: result.count } });
    } catch (err: any) {
      console.error('admin/group-delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete bets' });
    }
  }
);

// GET /api/bet/admin/settled-fancy/:eventId — Return settled fancy bets for event
router.get(
  '/admin/settled-fancy/:eventId',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketId = parseInt(req.params.eventId);
      if (isNaN(cricketId)) {
        return res.status(400).json({ error: 'Invalid eventId' });
      }

      const event = await prisma.cricketEvent.findUnique({ where: { cricketId } });
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const settledFancy = await prisma.fancyBet.findMany({
        where: {
          cricketEventId: event.id,
          settledAt: { not: null },
        },
        include: {
          user: { select: { id: true, username: true, name: true } },
        },
        orderBy: { settledAt: 'desc' },
      });

      res.json({ status: 'success', data: settledFancy });
    } catch (err: any) {
      console.error('admin/settled-fancy error:', err.message);
      res.status(500).json({ error: 'Failed to fetch settled fancy bets' });
    }
  }
);

// GET /api/bet/admin/admin-pl?cricketId=xxx — Return aggregated P&L
router.get(
  '/admin/admin-pl',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketId = parseInt(req.query.cricketId as string);
      if (isNaN(cricketId)) {
        return res.status(400).json({ error: 'Invalid cricketId' });
      }

      const event = await prisma.cricketEvent.findUnique({ where: { cricketId } });
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Aggregate P&L from regular bets
      const bets = await prisma.bet.findMany({
        where: { cricketEventId: event.id, settledAt: { not: null } },
        select: { profitLoss: true, marketId: true, marketName: true, betType: true },
      });

      // Aggregate P&L from fancy bets
      const fancyBets = await prisma.fancyBet.findMany({
        where: { cricketEventId: event.id, settledAt: { not: null } },
        select: { profitLoss: true, marketId: true, marketName: true },
      });

      // Summarize by market
      const marketPL: Record<string, { marketId: string; marketName: string; totalPL: number; betCount: number }> = {};

      for (const bet of bets) {
        const key = bet.marketId;
        if (!marketPL[key]) {
          marketPL[key] = { marketId: bet.marketId, marketName: bet.marketName || '', totalPL: 0, betCount: 0 };
        }
        // Admin P&L is negative of user P&L (platform perspective)
        marketPL[key].totalPL += -(parseFloat(bet.profitLoss?.toString() || '0'));
        marketPL[key].betCount += 1;
      }

      const fancyPL: Record<string, { marketId: string; marketName: string; totalPL: number; betCount: number }> = {};

      for (const bet of fancyBets) {
        const key = bet.marketId;
        if (!fancyPL[key]) {
          fancyPL[key] = { marketId: bet.marketId, marketName: bet.marketName || '', totalPL: 0, betCount: 0 };
        }
        fancyPL[key].totalPL += -(parseFloat(bet.profitLoss?.toString() || '0'));
        fancyPL[key].betCount += 1;
      }

      const totalBetsPL = bets.reduce((sum, b) => sum - parseFloat(b.profitLoss?.toString() || '0'), 0);
      const totalFancyPL = fancyBets.reduce((sum, b) => sum - parseFloat(b.profitLoss?.toString() || '0'), 0);

      res.json({
        status: 'success',
        data: {
          marketPL: Object.values(marketPL),
          fancyPL: Object.values(fancyPL),
          totalBetsPL,
          totalFancyPL,
          totalPL: totalBetsPL + totalFancyPL,
        },
      });
    } catch (err: any) {
      console.error('admin/admin-pl error:', err.message);
      res.status(500).json({ error: 'Failed to fetch admin P&L' });
    }
  }
);

// GET /api/bet/admin/user-book?cricketId=xxx — Return user-level book (aggregated by user)
router.get(
  '/admin/user-book',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketId = parseInt(req.query.cricketId as string);
      if (isNaN(cricketId)) {
        return res.status(400).json({ error: 'Invalid cricketId' });
      }

      const event = await prisma.cricketEvent.findUnique({ where: { cricketId } });
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Get all bets with user info
      const bets = await prisma.bet.findMany({
        where: { cricketEventId: event.id, betStatus: 'MATCHED' },
        include: {
          user: { select: { id: true, username: true, name: true, parentId: true } },
        },
      });

      const fancyBets = await prisma.fancyBet.findMany({
        where: { cricketEventId: event.id, betStatus: 'MATCHED' },
        include: {
          user: { select: { id: true, username: true, name: true, parentId: true } },
        },
      });

      // Aggregate by user
      const userBook: Record<string, {
        userId: string;
        username: string;
        name: string;
        parentId: string | null;
        totalBets: number;
        totalFancyBets: number;
        totalStake: number;
        totalExposure: number;
        potentialPL: number;
      }> = {};

      for (const bet of bets) {
        const uid = bet.userId;
        if (!userBook[uid]) {
          userBook[uid] = {
            userId: uid,
            username: bet.user.username,
            name: bet.user.name,
            parentId: bet.user.parentId,
            totalBets: 0,
            totalFancyBets: 0,
            totalStake: 0,
            totalExposure: 0,
            potentialPL: 0,
          };
        }
        userBook[uid].totalBets += 1;
        userBook[uid].totalStake += parseFloat(bet.amount.toString());
        userBook[uid].totalExposure += parseFloat(bet.loss.toString());
        // If settled, use actual P&L; otherwise estimate potential
        if (bet.profitLoss !== null) {
          userBook[uid].potentialPL += parseFloat(bet.profitLoss.toString());
        }
      }

      for (const bet of fancyBets) {
        const uid = bet.userId;
        if (!userBook[uid]) {
          userBook[uid] = {
            userId: uid,
            username: bet.user.username,
            name: bet.user.name,
            parentId: bet.user.parentId,
            totalBets: 0,
            totalFancyBets: 0,
            totalStake: 0,
            totalExposure: 0,
            potentialPL: 0,
          };
        }
        userBook[uid].totalFancyBets += 1;
        userBook[uid].totalStake += parseFloat(bet.amount.toString());
        userBook[uid].totalExposure += parseFloat(bet.loss.toString());
        if (bet.profitLoss !== null) {
          userBook[uid].potentialPL += parseFloat(bet.profitLoss.toString());
        }
      }

      res.json({ status: 'success', data: Object.values(userBook) });
    } catch (err: any) {
      console.error('admin/user-book error:', err.message);
      res.status(500).json({ error: 'Failed to fetch user book' });
    }
  }
);

// GET /api/bet/admin/bookmaker-book?cricketId=xxx — Return bookmaker position
router.get(
  '/admin/bookmaker-book',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketId = parseInt(req.query.cricketId as string);
      if (isNaN(cricketId)) {
        return res.status(400).json({ error: 'Invalid cricketId' });
      }

      const event = await prisma.cricketEvent.findUnique({
        where: { cricketId },
        include: { markets: { where: { marketType: 'BOOKMAKER' } } },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Get bookmaker market IDs
      const bookmakerMarketIds = event.markets.map((m) => m.externalMarketId);

      // Get all bets on bookmaker markets
      const bets = await prisma.bet.findMany({
        where: {
          cricketEventId: event.id,
          marketId: { in: bookmakerMarketIds },
          betStatus: 'MATCHED',
        },
        include: {
          user: { select: { id: true, username: true, name: true } },
        },
      });

      // Calculate position per runner (selection)
      const runnerPosition: Record<number, {
        selectionId: number;
        runnerName: string;
        backTotal: number;
        layTotal: number;
        netPosition: number;
        betCount: number;
      }> = {};

      for (const bet of bets) {
        const sid = bet.selectionId;
        if (!runnerPosition[sid]) {
          runnerPosition[sid] = {
            selectionId: sid,
            runnerName: bet.runnerName,
            backTotal: 0,
            layTotal: 0,
            netPosition: 0,
            betCount: 0,
          };
        }

        const profit = parseFloat(bet.profit.toString());
        const loss = parseFloat(bet.loss.toString());

        if (bet.betType === 'BACK') {
          // If this runner wins, user gets +profit; platform gets -profit
          // If this runner loses, user gets -loss; platform gets +loss
          runnerPosition[sid].backTotal += profit;
        } else {
          // LAY: if this runner wins, user gets -loss; platform gets +loss
          // If this runner loses, user gets +profit; platform gets -profit
          runnerPosition[sid].layTotal += profit;
        }

        runnerPosition[sid].betCount += 1;
      }

      // Calculate net position for each runner
      // Net position = what the platform wins/loses if that runner wins
      for (const sid of Object.keys(runnerPosition)) {
        const pos = runnerPosition[Number(sid)];
        // Platform perspective: back bets are platform liability, lay bets are platform income
        pos.netPosition = pos.layTotal - pos.backTotal;
      }

      res.json({
        status: 'success',
        data: {
          eventId: event.cricketId,
          eventName: event.eventName,
          markets: event.markets,
          runnerPositions: Object.values(runnerPosition),
          totalBets: bets.length,
        },
      });
    } catch (err: any) {
      console.error('admin/bookmaker-book error:', err.message);
      res.status(500).json({ error: 'Failed to fetch bookmaker book' });
    }
  }
);

export default router;
