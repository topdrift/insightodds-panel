import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── POST /api/user/bet-history ─────────────────────────────
router.post('/bet-history', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      from: z.string(),
      to: z.string(),
      sport: z.string().optional(),
      matched: z.boolean().optional(),
      page: z.number().int().min(1).default(1),
      size: z.number().int().min(1).max(100).default(20),
    });
    const { from, to, sport, matched, page, size } = schema.parse(req.body);
    const { userId } = req.user!;

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const skip = (page - 1) * size;

    // Build bet filter
    const betWhere: any = {
      userId,
      createdAt: { gte: fromDate, lte: toDate },
    };
    if (sport) betWhere.sport = sport;
    if (matched === true) betWhere.betStatus = 'MATCHED';
    if (matched === false) betWhere.betStatus = { not: 'MATCHED' };

    // Build fancy bet filter
    const fancyWhere: any = {
      userId,
      createdAt: { gte: fromDate, lte: toDate },
    };
    if (matched === true) fancyWhere.betStatus = 'MATCHED';
    if (matched === false) fancyWhere.betStatus = { not: 'MATCHED' };

    const [bets, betsTotal, fancyBets, fancyTotal] = await Promise.all([
      prisma.bet.findMany({
        where: betWhere,
        include: {
          cricketEvent: { select: { eventName: true, team1: true, team2: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      prisma.bet.count({ where: betWhere }),
      prisma.fancyBet.findMany({
        where: fancyWhere,
        include: {
          cricketEvent: { select: { eventName: true, team1: true, team2: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      prisma.fancyBet.count({ where: fancyWhere }),
    ]);

    res.json({
      bets,
      betsTotal,
      fancyBets,
      fancyTotal,
      page,
      size,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to fetch bet history' });
  }
});

// ─── POST /api/user/current-bets ────────────────────────────
router.post('/current-bets', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      sports: z.boolean(), // true = cricket, false = matka/casino
      betStatus: z.string().optional(),
      search: z.string().optional(),
      pageNumber: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    });
    const { sports, betStatus, search, pageNumber, pageSize } = schema.parse(req.body);
    const { userId } = req.user!;
    const skip = (pageNumber - 1) * pageSize;

    if (sports) {
      // Cricket bets (including fancy)
      const betWhere: any = {
        userId,
        settledAt: null,
      };
      if (betStatus) betWhere.betStatus = betStatus;
      if (search) {
        betWhere.OR = [
          { runnerName: { contains: search, mode: 'insensitive' } },
          { marketName: { contains: search, mode: 'insensitive' } },
          { cricketEvent: { eventName: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const fancyWhere: any = {
        userId,
        settledAt: null,
      };
      if (betStatus) fancyWhere.betStatus = betStatus;
      if (search) {
        fancyWhere.OR = [
          { marketName: { contains: search, mode: 'insensitive' } },
          { runnerName: { contains: search, mode: 'insensitive' } },
          { cricketEvent: { eventName: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [bets, betsTotal, fancyBets, fancyTotal] = await Promise.all([
        prisma.bet.findMany({
          where: betWhere,
          include: {
            cricketEvent: { select: { eventName: true, team1: true, team2: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.bet.count({ where: betWhere }),
        prisma.fancyBet.findMany({
          where: fancyWhere,
          include: {
            cricketEvent: { select: { eventName: true, team1: true, team2: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.fancyBet.count({ where: fancyWhere }),
      ]);

      res.json({ bets, betsTotal, fancyBets, fancyTotal, pageNumber, pageSize });
    } else {
      // Matka / Casino bets
      const matkaWhere: any = {
        userId,
        profitLoss: null, // not settled
      };
      if (betStatus) matkaWhere.betStatus = betStatus;

      const [matkaBets, matkaTotal] = await Promise.all([
        prisma.matkaBet.findMany({
          where: matkaWhere,
          include: {
            matkaMarket: { include: { matka: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.matkaBet.count({ where: matkaWhere }),
      ]);

      res.json({ matkaBets, matkaTotal, pageNumber, pageSize });
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to fetch current bets' });
  }
});

// ─── POST /api/user/unsettled-bets ──────────────────────────
router.post('/unsettled-bets', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      gameType: z.string().optional(),
      search: z.string().optional(),
      pageNumber: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    });
    const { gameType, search, pageNumber, pageSize } = schema.parse(req.body);
    const { userId } = req.user!;
    const skip = (pageNumber - 1) * pageSize;

    // Cricket bets without settledAt
    const betWhere: any = {
      userId,
      settledAt: null,
    };
    if (search) {
      betWhere.OR = [
        { runnerName: { contains: search, mode: 'insensitive' } },
        { marketName: { contains: search, mode: 'insensitive' } },
        { cricketEvent: { eventName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Fancy bets without settledAt
    const fancyWhere: any = {
      userId,
      settledAt: null,
    };
    if (gameType) fancyWhere.gameType = gameType;
    if (search) {
      fancyWhere.OR = [
        { marketName: { contains: search, mode: 'insensitive' } },
        { runnerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Matka bets that have no profitLoss (unsettled)
    const matkaWhere: any = {
      userId,
      profitLoss: null,
    };

    const [bets, betsTotal, fancyBets, fancyTotal, matkaBets, matkaTotal] = await Promise.all([
      prisma.bet.findMany({
        where: betWhere,
        include: { cricketEvent: { select: { eventName: true, team1: true, team2: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.bet.count({ where: betWhere }),
      prisma.fancyBet.findMany({
        where: fancyWhere,
        include: { cricketEvent: { select: { eventName: true, team1: true, team2: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.fancyBet.count({ where: fancyWhere }),
      prisma.matkaBet.findMany({
        where: matkaWhere,
        include: { matkaMarket: { include: { matka: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.matkaBet.count({ where: matkaWhere }),
    ]);

    res.json({
      bets,
      betsTotal,
      fancyBets,
      fancyTotal,
      matkaBets,
      matkaTotal,
      pageNumber,
      pageSize,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to fetch unsettled bets' });
  }
});

// ─── POST /api/user/profit-loss-report ──────────────────────
router.post('/profit-loss-report', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      from: z.string(),
      to: z.string(),
    });
    const { from, to } = schema.parse(req.body);
    const { userId } = req.user!;

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Aggregate profitLoss grouped by cricketEvent for regular bets
    const bets = await prisma.bet.findMany({
      where: {
        userId,
        settledAt: { gte: fromDate, lte: toDate },
        profitLoss: { not: null },
      },
      include: {
        cricketEvent: { select: { id: true, eventName: true, team1: true, team2: true } },
      },
    });

    // Fancy bets
    const fancyBets = await prisma.fancyBet.findMany({
      where: {
        userId,
        settledAt: { gte: fromDate, lte: toDate },
        profitLoss: { not: null },
      },
      include: {
        cricketEvent: { select: { id: true, eventName: true, team1: true, team2: true } },
      },
    });

    // Group by event
    const eventMap: Record<string, {
      eventId: string;
      eventName: string;
      team1: string;
      team2: string;
      matchPL: number;
      fancyPL: number;
      totalPL: number;
    }> = {};

    for (const bet of bets) {
      const eid = bet.cricketEventId;
      if (!eventMap[eid]) {
        eventMap[eid] = {
          eventId: eid,
          eventName: bet.cricketEvent.eventName,
          team1: bet.cricketEvent.team1,
          team2: bet.cricketEvent.team2,
          matchPL: 0,
          fancyPL: 0,
          totalPL: 0,
        };
      }
      eventMap[eid].matchPL += parseFloat(bet.profitLoss!.toString());
    }

    for (const fb of fancyBets) {
      const eid = fb.cricketEventId;
      if (!eventMap[eid]) {
        eventMap[eid] = {
          eventId: eid,
          eventName: fb.cricketEvent.eventName,
          team1: fb.cricketEvent.team1,
          team2: fb.cricketEvent.team2,
          matchPL: 0,
          fancyPL: 0,
          totalPL: 0,
        };
      }
      eventMap[eid].fancyPL += parseFloat(fb.profitLoss!.toString());
    }

    const report = Object.values(eventMap).map((e) => ({
      ...e,
      totalPL: e.matchPL + e.fancyPL,
    }));

    res.json({ report });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to generate profit/loss report' });
  }
});

// ─── POST /api/user/activity-log ────────────────────────────
router.post('/activity-log', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      from: z.string(),
      to: z.string(),
      activityLogType: z.string().optional(),
      pageSize: z.number().int().min(1).max(100).default(20),
    });
    const { from, to, activityLogType, pageSize } = schema.parse(req.body);
    const { userId } = req.user!;

    const where: any = {
      userId,
      createdAt: { gte: new Date(from), lte: new Date(to) },
    };
    if (activityLogType) where.activityType = activityLogType;

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
    });

    res.json({ logs });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// ─── GET /api/user/coin-history ─────────────────────────────
router.get('/coin-history', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    const where: any = { userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        // Support epoch ms or ISO string
        const d = /^\d+$/.test(startDate) ? new Date(parseInt(startDate)) : new Date(startDate);
        where.createdAt.gte = d;
      }
      if (endDate) {
        const d = /^\d+$/.test(endDate) ? new Date(parseInt(endDate)) : new Date(endDate);
        where.createdAt.lte = d;
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coin history' });
  }
});

// ─── GET /api/user/completed-games ──────────────────────────
router.get('/completed-games', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const { sport } = req.query as { sport?: string };

    if (sport === 'MATKA') {
      // Matka markets the user bet on that are settled
      const matkaBets = await prisma.matkaBet.findMany({
        where: { userId },
        select: { matkaMarketId: true },
        distinct: ['matkaMarketId'],
      });
      const marketIds = matkaBets.map((b) => b.matkaMarketId);

      const markets = await prisma.matkaMarket.findMany({
        where: {
          id: { in: marketIds },
          isMarketSettled: true,
        },
        include: { matka: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      res.json({ markets });
    } else {
      // Cricket events the user bet on that are settled
      const betEventIds = await prisma.bet.findMany({
        where: { userId },
        select: { cricketEventId: true },
        distinct: ['cricketEventId'],
      });
      const fancyEventIds = await prisma.fancyBet.findMany({
        where: { userId },
        select: { cricketEventId: true },
        distinct: ['cricketEventId'],
      });
      const eventIds = [
        ...new Set([
          ...betEventIds.map((b) => b.cricketEventId),
          ...fancyEventIds.map((b) => b.cricketEventId),
        ]),
      ];

      const events = await prisma.cricketEvent.findMany({
        where: {
          id: { in: eventIds },
          isSettled: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      res.json({ events });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch completed games' });
  }
});

// ─── GET /api/user/exposure-table ───────────────────────────
router.get('/exposure-table', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;

    // All open bets grouped by event showing exposure
    const openBets = await prisma.bet.findMany({
      where: { userId, settledAt: null, betStatus: 'MATCHED' },
      include: {
        cricketEvent: { select: { id: true, eventName: true, team1: true, team2: true } },
      },
    });

    const openFancyBets = await prisma.fancyBet.findMany({
      where: { userId, settledAt: null, betStatus: 'MATCHED' },
      include: {
        cricketEvent: { select: { id: true, eventName: true, team1: true, team2: true } },
      },
    });

    const openMatkaBets = await prisma.matkaBet.findMany({
      where: { userId, profitLoss: null, betStatus: 'MATCHED' },
      include: {
        matkaMarket: { include: { matka: { select: { name: true } } } },
      },
    });

    // Group cricket bets by event
    const eventExposure: Record<string, {
      eventId: string;
      eventName: string;
      team1: string;
      team2: string;
      matchExposure: number;
      fancyExposure: number;
      totalExposure: number;
      bets: number;
    }> = {};

    for (const bet of openBets) {
      const eid = bet.cricketEventId;
      if (!eventExposure[eid]) {
        eventExposure[eid] = {
          eventId: eid,
          eventName: bet.cricketEvent.eventName,
          team1: bet.cricketEvent.team1,
          team2: bet.cricketEvent.team2,
          matchExposure: 0,
          fancyExposure: 0,
          totalExposure: 0,
          bets: 0,
        };
      }
      const loss = parseFloat(bet.loss.toString());
      eventExposure[eid].matchExposure += bet.betType === 'BACK'
        ? parseFloat(bet.amount.toString())
        : loss;
      eventExposure[eid].bets++;
    }

    for (const fb of openFancyBets) {
      const eid = fb.cricketEventId;
      if (!eventExposure[eid]) {
        eventExposure[eid] = {
          eventId: eid,
          eventName: fb.cricketEvent.eventName,
          team1: fb.cricketEvent.team1,
          team2: fb.cricketEvent.team2,
          matchExposure: 0,
          fancyExposure: 0,
          totalExposure: 0,
          bets: 0,
        };
      }
      eventExposure[eid].fancyExposure += parseFloat(fb.loss.toString());
      eventExposure[eid].bets++;
    }

    const cricketExposure = Object.values(eventExposure).map((e) => ({
      ...e,
      totalExposure: e.matchExposure + e.fancyExposure,
    }));

    // Matka exposure
    const matkaExposure = openMatkaBets.map((bet) => ({
      betId: bet.id,
      matkaName: bet.matkaMarket.matka.name,
      marketId: bet.matkaMarketId,
      betType: bet.betType,
      totalAmount: parseFloat(bet.totalAmount.toString()),
    }));

    res.json({ cricketExposure, matkaExposure });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exposure table' });
  }
});

// ─── GET /api/user/bets-from-log ────────────────────────────
router.get('/bets-from-log', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const { accountLogId } = req.query as { accountLogId?: string };

    if (!accountLogId) {
      return res.status(400).json({ error: 'accountLogId is required' });
    }

    // Find the transaction to get the bet reference
    const transaction = await prisma.transaction.findUnique({
      where: { id: accountLogId },
    });

    if (!transaction || transaction.userId !== userId) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const reference = transaction.reference;
    if (!reference) {
      return res.json({ bets: [], fancyBets: [] });
    }

    // Look up bets by the reference (betId stored in transaction.reference)
    const [bets, fancyBets] = await Promise.all([
      prisma.bet.findMany({
        where: { id: reference, userId },
        include: { cricketEvent: { select: { eventName: true, team1: true, team2: true } } },
      }),
      prisma.fancyBet.findMany({
        where: { id: reference, userId },
        include: { cricketEvent: { select: { eventName: true, team1: true, team2: true } } },
      }),
    ]);

    res.json({ bets, fancyBets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bets from log' });
  }
});

// ─── GET /api/user/home-page ─────────────────────────────────
router.get('/home-page', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const [
      activeMatches,
      inPlayMatches,
      unsettledBets,
      recentTransactions,
      announcements,
    ] = await Promise.all([
      prisma.cricketEvent.count({ where: { isActive: true } }),
      prisma.cricketEvent.count({ where: { isActive: true, inPlay: true } }),
      prisma.bet.count({ where: { userId, betStatus: 'MATCHED' } }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, type: true, amount: true, balance: true, createdAt: true, remarks: true },
      }),
      prisma.announcement.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
        take: 5,
      }),
    ]);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, exposure: true, creditReference: true, exposureLimit: true },
    });

    res.json({
      balance: user?.balance || 0,
      exposure: user?.exposure || 0,
      creditReference: user?.creditReference || 0,
      exposureLimit: user?.exposureLimit || 0,
      activeMatches,
      inPlayMatches,
      unsettledBets,
      recentTransactions,
      announcements,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch home page data' });
  }
});

// ─── GET /api/user/home-page/search ─────────────────────────
router.get('/home-page/search', async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query as { search?: string };

    if (!search || search.trim().length === 0) {
      return res.json({ events: [] });
    }

    const events = await prisma.cricketEvent.findMany({
      where: {
        isActive: true,
        eventName: { contains: search, mode: 'insensitive' },
      },
      select: {
        id: true,
        cricketId: true,
        eventName: true,
        team1: true,
        team2: true,
        matchType: true,
        competition: true,
        startTime: true,
        inPlay: true,
      },
      orderBy: { startTime: 'asc' },
      take: 20,
    });

    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search events' });
  }
});

export default router;
