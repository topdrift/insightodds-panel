import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'AGENT'));

// ─── POST /api/admin/account-log ────────────────────────────
router.post('/account-log', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      userName: z.string().optional(),
      type: z.string().optional(),
      pageNumber: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    });
    const { startDate, endDate, userName, type, pageNumber, pageSize } = schema.parse(req.body);
    const skip = (pageNumber - 1) * pageSize;

    const where: any = {};

    if (userName) {
      const user = await prisma.user.findUnique({ where: { username: userName } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      where.userId = user.id;
    }

    if (type) where.type = type;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { user: { select: { id: true, username: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ transactions, total, pageNumber, pageSize });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to fetch account log' });
  }
});

// ─── POST /api/admin/activity-log ───────────────────────────
router.post('/activity-log', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      userName: z.string().optional(),
      activityLogType: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      pageSize: z.number().int().min(1).max(100).default(20),
    });
    const { userName, activityLogType, from, to, pageSize } = schema.parse(req.body);

    const where: any = {};

    if (userName) {
      const user = await prisma.user.findUnique({ where: { username: userName } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      where.userId = user.id;
    }

    if (activityLogType) where.activityType = activityLogType;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const logs = await prisma.activityLog.findMany({
      where,
      include: { user: { select: { id: true, username: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
    });

    res.json({ logs });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// ─── POST /api/admin/bet-history ────────────────────────────
router.post('/bet-history', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      userName: z.string().optional(),
      from: z.string(),
      to: z.string(),
      sport: z.string().optional(),
      matched: z.boolean().optional(),
      page: z.number().int().min(1).default(1),
      size: z.number().int().min(1).max(100).default(20),
    });
    const { userName, from, to, sport, matched, page, size } = schema.parse(req.body);
    const skip = (page - 1) * size;

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const betWhere: any = {
      createdAt: { gte: fromDate, lte: toDate },
    };

    if (userName) {
      const user = await prisma.user.findUnique({ where: { username: userName } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      betWhere.userId = user.id;
    }

    if (sport) betWhere.sport = sport;
    if (matched === true) betWhere.betStatus = 'MATCHED';
    if (matched === false) betWhere.betStatus = { not: 'MATCHED' };

    const fancyWhere: any = {
      createdAt: { gte: fromDate, lte: toDate },
    };
    if (betWhere.userId) fancyWhere.userId = betWhere.userId;
    if (matched === true) fancyWhere.betStatus = 'MATCHED';
    if (matched === false) fancyWhere.betStatus = { not: 'MATCHED' };

    const [bets, betsTotal, fancyBets, fancyTotal] = await Promise.all([
      prisma.bet.findMany({
        where: betWhere,
        include: {
          user: { select: { id: true, username: true, name: true } },
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
          user: { select: { id: true, username: true, name: true } },
          cricketEvent: { select: { eventName: true, team1: true, team2: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      prisma.fancyBet.count({ where: fancyWhere }),
    ]);

    res.json({ bets, betsTotal, fancyBets, fancyTotal, page, size });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to fetch bet history' });
  }
});

// ─── POST /api/admin/unsettled-bets ─────────────────────────
router.post('/unsettled-bets', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().optional(),
      gameType: z.string().optional(),
      search: z.string().optional(),
      pageNumber: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    });
    const { userId, gameType, search, pageNumber, pageSize } = schema.parse(req.body);
    const skip = (pageNumber - 1) * pageSize;

    const betWhere: any = { settledAt: null };
    const fancyWhere: any = { settledAt: null };

    if (userId) {
      betWhere.userId = userId;
      fancyWhere.userId = userId;
    }

    if (gameType) fancyWhere.gameType = gameType;

    if (search) {
      betWhere.OR = [
        { runnerName: { contains: search, mode: 'insensitive' } },
        { marketName: { contains: search, mode: 'insensitive' } },
        { cricketEvent: { eventName: { contains: search, mode: 'insensitive' } } },
      ];
      fancyWhere.OR = [
        { marketName: { contains: search, mode: 'insensitive' } },
        { runnerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [bets, betsTotal, fancyBets, fancyTotal] = await Promise.all([
      prisma.bet.findMany({
        where: betWhere,
        include: {
          user: { select: { id: true, username: true, name: true } },
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
          user: { select: { id: true, username: true, name: true } },
          cricketEvent: { select: { eventName: true, team1: true, team2: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.fancyBet.count({ where: fancyWhere }),
    ]);

    res.json({ bets, betsTotal, fancyBets, fancyTotal, pageNumber, pageSize });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to fetch unsettled bets' });
  }
});

// ─── POST /api/admin/profit-loss-report ─────────────────────
router.post('/profit-loss-report', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      userName: z.string().optional(),
      from: z.string(),
      to: z.string(),
    });
    const { userName, from, to } = schema.parse(req.body);

    const fromDate = new Date(from);
    const toDate = new Date(to);

    let targetUserId: string | undefined;
    if (userName) {
      const user = await prisma.user.findUnique({ where: { username: userName } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      targetUserId = user.id;
    }

    const betWhere: any = {
      settledAt: { gte: fromDate, lte: toDate },
      profitLoss: { not: null },
    };
    if (targetUserId) betWhere.userId = targetUserId;

    const fancyWhere: any = {
      settledAt: { gte: fromDate, lte: toDate },
      profitLoss: { not: null },
    };
    if (targetUserId) fancyWhere.userId = targetUserId;

    const [bets, fancyBets] = await Promise.all([
      prisma.bet.findMany({
        where: betWhere,
        include: { cricketEvent: { select: { id: true, eventName: true, team1: true, team2: true } } },
      }),
      prisma.fancyBet.findMany({
        where: fancyWhere,
        include: { cricketEvent: { select: { id: true, eventName: true, team1: true, team2: true } } },
      }),
    ]);

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

// ─── POST /api/admin/data-report ────────────────────────────
router.post('/data-report', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      dataReportType: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      userType: z.string().optional(),
      page: z.number().int().min(1).default(1),
      size: z.number().int().min(1).max(100).default(20),
    });
    const { dataReportType, startTime, endTime, userType, page, size } = schema.parse(req.body);
    const skip = (page - 1) * size;

    const fromDate = new Date(startTime);
    const toDate = new Date(endTime);

    switch (dataReportType) {
      case 'NEW_USERS': {
        const where: any = {
          createdAt: { gte: fromDate, lte: toDate },
        };
        if (userType) where.role = userType;

        const [users, total] = await Promise.all([
          prisma.user.findMany({
            where,
            select: {
              id: true, username: true, name: true, role: true,
              createdAt: true, isActive: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: size,
          }),
          prisma.user.count({ where }),
        ]);
        return res.json({ data: users, total, page, size });
      }

      case 'DEPOSITS': {
        const where: any = {
          type: 'DEPOSIT',
          createdAt: { gte: fromDate, lte: toDate },
        };
        if (userType) where.user = { role: userType };

        const [transactions, total] = await Promise.all([
          prisma.transaction.findMany({
            where,
            include: { user: { select: { id: true, username: true, name: true, role: true } } },
            orderBy: { createdAt: 'desc' },
            skip,
            take: size,
          }),
          prisma.transaction.count({ where }),
        ]);
        return res.json({ data: transactions, total, page, size });
      }

      case 'WITHDRAWALS': {
        const where: any = {
          type: 'WITHDRAW',
          createdAt: { gte: fromDate, lte: toDate },
        };
        if (userType) where.user = { role: userType };

        const [transactions, total] = await Promise.all([
          prisma.transaction.findMany({
            where,
            include: { user: { select: { id: true, username: true, name: true, role: true } } },
            orderBy: { createdAt: 'desc' },
            skip,
            take: size,
          }),
          prisma.transaction.count({ where }),
        ]);
        return res.json({ data: transactions, total, page, size });
      }

      case 'BETS': {
        const where: any = {
          createdAt: { gte: fromDate, lte: toDate },
        };

        const [bets, total] = await Promise.all([
          prisma.bet.findMany({
            where,
            include: {
              user: { select: { id: true, username: true, name: true } },
              cricketEvent: { select: { eventName: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: size,
          }),
          prisma.bet.count({ where }),
        ]);
        return res.json({ data: bets, total, page, size });
      }

      case 'LOGINS': {
        const where: any = {
          activityType: 'LOGIN',
          createdAt: { gte: fromDate, lte: toDate },
        };

        const [logs, total] = await Promise.all([
          prisma.activityLog.findMany({
            where,
            include: { user: { select: { id: true, username: true, name: true, role: true } } },
            orderBy: { createdAt: 'desc' },
            skip,
            take: size,
          }),
          prisma.activityLog.count({ where }),
        ]);
        return res.json({ data: logs, total, page, size });
      }

      default:
        return res.status(400).json({ error: `Unknown data report type: ${dataReportType}` });
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to generate data report' });
  }
});

// ─── POST /api/admin/earning-report ─────────────────────────
router.post('/earning-report', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      from: z.string(),
      to: z.string(),
      sports: z.array(z.string()).default([]),
      page: z.number().int().min(1).default(1),
      size: z.number().int().min(1).max(100).default(20),
    });
    const { from, to, sports, page, size } = schema.parse(req.body);
    const skip = (page - 1) * size;

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const results: any[] = [];

    // Cricket earnings
    if (sports.length === 0 || sports.includes('CRICKET')) {
      const cricketBets = await prisma.bet.findMany({
        where: {
          settledAt: { gte: fromDate, lte: toDate },
          profitLoss: { not: null },
        },
        select: { profitLoss: true, amount: true },
      });

      const cricketFancy = await prisma.fancyBet.findMany({
        where: {
          settledAt: { gte: fromDate, lte: toDate },
          profitLoss: { not: null },
        },
        select: { profitLoss: true, amount: true },
      });

      const cricketPL = [
        ...cricketBets.map((b) => parseFloat(b.profitLoss!.toString())),
        ...cricketFancy.map((b) => parseFloat(b.profitLoss!.toString())),
      ];
      const cricketVolume = [
        ...cricketBets.map((b) => parseFloat(b.amount.toString())),
        ...cricketFancy.map((b) => parseFloat(b.amount.toString())),
      ];

      results.push({
        sport: 'CRICKET',
        totalBets: cricketPL.length,
        totalVolume: cricketVolume.reduce((s, v) => s + v, 0),
        totalPL: cricketPL.reduce((s, v) => s + v, 0),
        // Platform earning = negative of player PL
        platformEarning: -cricketPL.reduce((s, v) => s + v, 0),
      });
    }

    // Matka earnings
    if (sports.length === 0 || sports.includes('MATKA')) {
      const matkaBets = await prisma.matkaBet.findMany({
        where: {
          createdAt: { gte: fromDate, lte: toDate },
          profitLoss: { not: null },
        },
        select: { profitLoss: true, totalAmount: true },
      });

      const matkaPL = matkaBets.map((b) => parseFloat(b.profitLoss!.toString()));
      const matkaVolume = matkaBets.map((b) => parseFloat(b.totalAmount.toString()));

      results.push({
        sport: 'MATKA',
        totalBets: matkaPL.length,
        totalVolume: matkaVolume.reduce((s, v) => s + v, 0),
        totalPL: matkaPL.reduce((s, v) => s + v, 0),
        platformEarning: -matkaPL.reduce((s, v) => s + v, 0),
      });
    }

    // Commission earnings
    const commissions = await prisma.commissionRecord.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: { amount: true, sport: true },
    });

    const commissionTotal = commissions.reduce((s, c) => s + parseFloat(c.amount.toString()), 0);

    res.json({
      earnings: results,
      commissionTotal,
      page,
      size,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to generate earning report' });
  }
});

// ─── GET /api/admin/collection-report ───────────────────────
router.get('/collection-report', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, userName, userType } = req.query as {
      startDate?: string; endDate?: string; userName?: string; userType?: string;
    };

    const userWhere: any = {};
    if (userName) {
      userWhere.username = { contains: userName, mode: 'insensitive' };
    }
    if (userType) userWhere.role = userType;

    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        balance: true,
        exposure: true,
        creditReference: true,
      },
    });

    // For each user, calculate total deposits and withdrawals in period
    const collectionData = await Promise.all(
      users.map(async (user) => {
        const txWhere: any = { userId: user.id };
        if (startDate || endDate) {
          txWhere.createdAt = {};
          if (startDate) txWhere.createdAt.gte = new Date(startDate);
          if (endDate) txWhere.createdAt.lte = new Date(endDate);
        }

        const deposits = await prisma.transaction.aggregate({
          where: { ...txWhere, type: 'DEPOSIT' },
          _sum: { amount: true },
        });

        const withdrawals = await prisma.transaction.aggregate({
          where: { ...txWhere, type: 'WITHDRAW' },
          _sum: { amount: true },
        });

        return {
          userId: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          balance: user.balance,
          exposure: user.exposure,
          creditReference: user.creditReference,
          totalDeposits: deposits._sum.amount || 0,
          totalWithdrawals: withdrawals._sum.amount || 0,
        };
      })
    );

    res.json({ data: collectionData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch collection report' });
  }
});

// ─── GET /api/admin/commission-report ───────────────────────
router.get('/commission-report', async (req: AuthRequest, res: Response) => {
  try {
    const { userName } = req.query as { userName?: string };

    const where: any = {};
    if (userName) {
      const user = await prisma.user.findUnique({ where: { username: userName } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      where.userId = user.id;
    }

    // Aggregate commissions by user
    const commissions = await prisma.commissionRecord.groupBy({
      by: ['userId', 'sport'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    // Enrich with user data
    const userIds = [...new Set(commissions.map((c) => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, name: true, role: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const data = commissions.map((c) => ({
      user: userMap[c.userId],
      sport: c.sport,
      totalCommission: c._sum.amount,
      totalRecords: c._count.id,
    }));

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch commission report' });
  }
});

// ─── GET /api/admin/commission-report/:userId ───────────────
router.get('/commission-report/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, page = '1', size = '20' } = req.query as {
      startDate?: string; endDate?: string; page?: string; size?: string;
    };
    const skip = (parseInt(page) - 1) * parseInt(size);

    const where: any = { userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [records, total] = await Promise.all([
      prisma.commissionRecord.findMany({
        where,
        include: { user: { select: { username: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(size),
      }),
      prisma.commissionRecord.count({ where }),
    ]);

    res.json({ records, total, page: parseInt(page), size: parseInt(size) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch commission details' });
  }
});

// ─── GET /api/admin/commission-history/:userId ──────────────
router.get('/commission-history/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, page = '1' } = req.query as {
      startDate?: string; endDate?: string; page?: string;
    };
    const pageSize = 20;
    const skip = (parseInt(page) - 1) * pageSize;

    const where: any = {
      userId,
      type: 'COMMISSION',
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [records, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ records, total, page: parseInt(page), pageSize });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch commission history' });
  }
});

// ─── GET /api/admin/general-report ──────────────────────────
router.get('/general-report', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query as { type?: string };

    if (type === 'USERS') {
      const [totalUsers, superAdmins, admins, agents, clients, activeUsers, lockedUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
        prisma.user.count({ where: { role: 'ADMIN' } }),
        prisma.user.count({ where: { role: 'AGENT' } }),
        prisma.user.count({ where: { role: 'CLIENT' } }),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isBetLocked: true } }),
      ]);
      return res.json({ totalUsers, superAdmins, admins, agents, clients, activeUsers, lockedUsers });
    }

    if (type === 'BETS') {
      const [totalBets, matchedBets, deletedBets, settledBets, unsettledBets] = await Promise.all([
        prisma.bet.count(),
        prisma.bet.count({ where: { betStatus: 'MATCHED' } }),
        prisma.bet.count({ where: { betStatus: 'DELETED' } }),
        prisma.bet.count({ where: { settledAt: { not: null } } }),
        prisma.bet.count({ where: { settledAt: null } }),
      ]);

      const totalFancy = await prisma.fancyBet.count();
      const totalMatka = await prisma.matkaBet.count();

      return res.json({ totalBets, matchedBets, deletedBets, settledBets, unsettledBets, totalFancy, totalMatka });
    }

    if (type === 'EVENTS') {
      const [totalEvents, activeEvents, settledEvents, liveEvents] = await Promise.all([
        prisma.cricketEvent.count(),
        prisma.cricketEvent.count({ where: { isActive: true } }),
        prisma.cricketEvent.count({ where: { isSettled: true } }),
        prisma.cricketEvent.count({ where: { inPlay: true } }),
      ]);
      return res.json({ totalEvents, activeEvents, settledEvents, liveEvents });
    }

    // Default: overview of everything
    const [totalUsers, totalBets, totalEvents, totalTransactions] = await Promise.all([
      prisma.user.count(),
      prisma.bet.count(),
      prisma.cricketEvent.count(),
      prisma.transaction.count(),
    ]);

    res.json({ totalUsers, totalBets, totalEvents, totalTransactions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch general report' });
  }
});

// ─── GET /api/admin/market-analysis-report ──────────────────
router.get('/market-analysis-report', async (_req: AuthRequest, res: Response) => {
  try {
    // Event-level analysis: each active/recent event with bet stats
    const events = await prisma.cricketEvent.findMany({
      where: {
        OR: [{ isActive: true }, { isSettled: true }],
      },
      select: {
        id: true,
        cricketId: true,
        eventName: true,
        team1: true,
        team2: true,
        matchType: true,
        inPlay: true,
        isSettled: true,
        winner: true,
        startTime: true,
      },
      orderBy: { startTime: 'desc' },
      take: 50,
    });

    const analysis = await Promise.all(
      events.map(async (event) => {
        const [betCount, fancyCount, betVolume, fancyVolume] = await Promise.all([
          prisma.bet.count({ where: { cricketEventId: event.id } }),
          prisma.fancyBet.count({ where: { cricketEventId: event.id } }),
          prisma.bet.aggregate({
            where: { cricketEventId: event.id },
            _sum: { amount: true },
          }),
          prisma.fancyBet.aggregate({
            where: { cricketEventId: event.id },
            _sum: { amount: true },
          }),
        ]);

        return {
          ...event,
          totalBets: betCount + fancyCount,
          matchBets: betCount,
          fancyBets: fancyCount,
          matchVolume: betVolume._sum.amount || 0,
          fancyVolume: fancyVolume._sum.amount || 0,
        };
      })
    );

    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch market analysis report' });
  }
});

// ─── GET /api/admin/partnership-details ─────────────────────
router.get('/partnership-details', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.query as { userId?: string };

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Build the partnership chain from this user up to SUPER_ADMIN
    const chain: Array<{
      id: string;
      username: string;
      name: string;
      role: string;
      myPartnership: number;
      myCasinoPartnership: number;
      myMatkaPartnership: number;
      matchCommission: number;
      sessionCommission: number;
    }> = [];

    let currentId: string | null = userId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const found: { id: string; username: string; name: string; role: string; parentId: string | null; myPartnership: any; myCasinoPartnership: any; myMatkaPartnership: any; matchCommission: any; sessionCommission: any } | null = await prisma.user.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          parentId: true,
          myPartnership: true,
          myCasinoPartnership: true,
          myMatkaPartnership: true,
          matchCommission: true,
          sessionCommission: true,
        },
      });
      if (!found) break;

      chain.push({
        id: found.id,
        username: found.username,
        name: found.name,
        role: found.role,
        myPartnership: parseFloat(found.myPartnership.toString()),
        myCasinoPartnership: parseFloat(found.myCasinoPartnership.toString()),
        myMatkaPartnership: parseFloat(found.myMatkaPartnership.toString()),
        matchCommission: parseFloat(found.matchCommission.toString()),
        sessionCommission: parseFloat(found.sessionCommission.toString()),
      });

      currentId = found.parentId;
    }

    res.json({ chain });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch partnership details' });
  }
});

// ─── GET /api/admin/bookmaker-position ──────────────────────
router.get('/bookmaker-position', async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, sport, userId } = req.query as {
      eventId?: string; sport?: string; userId?: string;
    };

    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const betWhere: any = {
      cricketEventId: eventId,
      betStatus: 'MATCHED',
      settledAt: null,
    };
    if (userId) betWhere.userId = userId;

    const bets = await prisma.bet.findMany({
      where: betWhere,
      include: {
        user: { select: { id: true, username: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by selection to compute bookmaker position
    const selectionMap: Record<number, {
      selectionId: number;
      runnerName: string;
      backTotal: number;
      layTotal: number;
      netExposure: number;
    }> = {};

    for (const bet of bets) {
      if (!selectionMap[bet.selectionId]) {
        selectionMap[bet.selectionId] = {
          selectionId: bet.selectionId,
          runnerName: bet.runnerName,
          backTotal: 0,
          layTotal: 0,
          netExposure: 0,
        };
      }
      const amount = parseFloat(bet.amount.toString());
      const profit = parseFloat(bet.profit.toString());
      const loss = parseFloat(bet.loss.toString());

      if (bet.betType === 'BACK') {
        selectionMap[bet.selectionId].backTotal += amount;
        selectionMap[bet.selectionId].netExposure += profit; // if this wins
      } else {
        selectionMap[bet.selectionId].layTotal += amount;
        selectionMap[bet.selectionId].netExposure -= loss; // if this wins
      }
    }

    res.json({
      eventId,
      sport: sport || 'CRICKET',
      positions: Object.values(selectionMap),
      totalBets: bets.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookmaker position' });
  }
});

// ─── GET /api/admin/children-by-event ───────────────────────
router.get('/children-by-event', async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, forClient, sport } = req.query as {
      eventId?: string; forClient?: string; sport?: string;
    };

    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const isForClient = forClient === 'true';

    // Find all users who have bets on this event
    const betUsers = await prisma.bet.findMany({
      where: { cricketEventId: eventId },
      select: { userId: true },
      distinct: ['userId'],
    });
    const fancyUsers = await prisma.fancyBet.findMany({
      where: { cricketEventId: eventId },
      select: { userId: true },
      distinct: ['userId'],
    });

    const userIds = [...new Set([
      ...betUsers.map((b) => b.userId),
      ...fancyUsers.map((b) => b.userId),
    ])];

    // Get users with their bets summary
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        ...(isForClient ? { role: 'CLIENT' } : {}),
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        parentId: true,
      },
    });

    const userData = await Promise.all(
      users.map(async (user) => {
        const [betAgg, fancyAgg] = await Promise.all([
          prisma.bet.aggregate({
            where: { userId: user.id, cricketEventId: eventId },
            _sum: { profitLoss: true, amount: true },
            _count: { id: true },
          }),
          prisma.fancyBet.aggregate({
            where: { userId: user.id, cricketEventId: eventId },
            _sum: { profitLoss: true, amount: true },
            _count: { id: true },
          }),
        ]);

        return {
          ...user,
          totalBets: (betAgg._count.id || 0) + (fancyAgg._count.id || 0),
          totalVolume:
            parseFloat((betAgg._sum.amount || 0).toString()) +
            parseFloat((fancyAgg._sum.amount || 0).toString()),
          totalPL:
            parseFloat((betAgg._sum.profitLoss || 0).toString()) +
            parseFloat((fancyAgg._sum.profitLoss || 0).toString()),
        };
      })
    );

    res.json({ users: userData, eventId, sport: sport || 'CRICKET' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch children by event' });
  }
});

// ─── GET /api/admin/:eventId/company-report ─────────────────
router.get('/:eventId/company-report', async (req: AuthRequest, res: Response) => {
  try {
    const { eventId } = req.params;

    const event = await prisma.cricketEvent.findUnique({
      where: { id: eventId },
      select: { id: true, eventName: true, team1: true, team2: true, isSettled: true, winner: true },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Aggregate all bets for this event
    const [betAgg, fancyAgg] = await Promise.all([
      prisma.bet.aggregate({
        where: { cricketEventId: eventId },
        _sum: { amount: true, profitLoss: true, profit: true, loss: true },
        _count: { id: true },
      }),
      prisma.fancyBet.aggregate({
        where: { cricketEventId: eventId },
        _sum: { amount: true, profitLoss: true, profit: true, loss: true },
        _count: { id: true },
      }),
    ]);

    // Commission paid for this event
    const eventBetIds = await prisma.bet.findMany({
      where: { cricketEventId: eventId },
      select: { id: true },
    });
    const commissions = await prisma.commissionRecord.aggregate({
      where: { betId: { in: eventBetIds.map((b) => b.id) } },
      _sum: { amount: true },
    });

    const playerPL =
      parseFloat((betAgg._sum.profitLoss || 0).toString()) +
      parseFloat((fancyAgg._sum.profitLoss || 0).toString());

    res.json({
      event,
      matchBets: {
        count: betAgg._count.id,
        volume: betAgg._sum.amount || 0,
        profitLoss: betAgg._sum.profitLoss || 0,
      },
      fancyBets: {
        count: fancyAgg._count.id,
        volume: fancyAgg._sum.amount || 0,
        profitLoss: fancyAgg._sum.profitLoss || 0,
      },
      totalPlayerPL: playerPL,
      companyPL: -playerPL, // company earns what players lose
      totalCommission: commissions._sum.amount || 0,
      netCompanyPL: -playerPL - parseFloat((commissions._sum.amount || 0).toString()),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch company report' });
  }
});

// ─── POST /api/admin/:eventId/plus-minus-report ─────────────
router.post('/:eventId/plus-minus-report', async (req: AuthRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const schema = z.object({
      userName: z.string().optional(),
      userIds: z.array(z.string()).default([]),
      marketIds: z.array(z.string()).default([]),
    });
    const { userName, userIds, marketIds } = schema.parse(req.body);

    const event = await prisma.cricketEvent.findUnique({
      where: { id: eventId },
      select: { id: true, eventName: true, team1: true, team2: true },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Resolve userIds from userName if provided
    const resolvedUserIds = [...userIds];
    if (userName) {
      const user = await prisma.user.findUnique({ where: { username: userName } });
      if (user) resolvedUserIds.push(user.id);
    }

    // Build filters
    const betWhere: any = { cricketEventId: eventId };
    if (resolvedUserIds.length > 0) betWhere.userId = { in: resolvedUserIds };
    if (marketIds.length > 0) betWhere.marketId = { in: marketIds };

    const fancyWhere: any = { cricketEventId: eventId };
    if (resolvedUserIds.length > 0) fancyWhere.userId = { in: resolvedUserIds };
    if (marketIds.length > 0) fancyWhere.marketId = { in: marketIds };

    const [bets, fancyBets] = await Promise.all([
      prisma.bet.findMany({
        where: betWhere,
        include: {
          user: { select: { id: true, username: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fancyBet.findMany({
        where: fancyWhere,
        include: {
          user: { select: { id: true, username: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Group by user for plus/minus summary
    const userSummary: Record<string, {
      userId: string;
      username: string;
      name: string;
      role: string;
      matchPlus: number;
      matchMinus: number;
      fancyPlus: number;
      fancyMinus: number;
      netPL: number;
    }> = {};

    for (const bet of bets) {
      const uid = bet.userId;
      if (!userSummary[uid]) {
        userSummary[uid] = {
          userId: uid,
          username: bet.user.username,
          name: bet.user.name,
          role: bet.user.role,
          matchPlus: 0,
          matchMinus: 0,
          fancyPlus: 0,
          fancyMinus: 0,
          netPL: 0,
        };
      }
      const pl = bet.profitLoss ? parseFloat(bet.profitLoss.toString()) : 0;
      if (pl >= 0) {
        userSummary[uid].matchPlus += pl;
      } else {
        userSummary[uid].matchMinus += pl;
      }
    }

    for (const fb of fancyBets) {
      const uid = fb.userId;
      if (!userSummary[uid]) {
        userSummary[uid] = {
          userId: uid,
          username: fb.user.username,
          name: fb.user.name,
          role: fb.user.role,
          matchPlus: 0,
          matchMinus: 0,
          fancyPlus: 0,
          fancyMinus: 0,
          netPL: 0,
        };
      }
      const pl = fb.profitLoss ? parseFloat(fb.profitLoss.toString()) : 0;
      if (pl >= 0) {
        userSummary[uid].fancyPlus += pl;
      } else {
        userSummary[uid].fancyMinus += pl;
      }
    }

    const report = Object.values(userSummary).map((u) => ({
      ...u,
      netPL: u.matchPlus + u.matchMinus + u.fancyPlus + u.fancyMinus,
    }));

    res.json({
      event,
      report,
      totalBets: bets.length,
      totalFancyBets: fancyBets.length,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.errors });
    res.status(500).json({ error: 'Failed to generate plus/minus report' });
  }
});

export default router;
