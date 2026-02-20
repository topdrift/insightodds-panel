import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { oddsApiScraper } from '../services/odds-api-scraper';

const router = Router();

// ─── PUBLIC PROXY ENDPOINTS (no auth) ─────────────────────────

// GET /api/cricket/all-matches
router.get('/all-matches', async (_req, res: Response) => {
  try {
    const matches = await oddsApiScraper.getAllMatches();
    res.json({ status: 'success', data: matches });
  } catch (err: any) {
    console.error('all-matches error:', err.message);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// GET /api/cricket/all-matches-dashboard
router.get('/all-matches-dashboard', async (_req, res: Response) => {
  try {
    const matches = await oddsApiScraper.getMatchesWithOdds();
    res.json({ status: 'success', data: matches });
  } catch (err: any) {
    console.error('all-matches-dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard matches' });
  }
});

// GET /api/cricket/odds/:cricketId
router.get('/odds/:cricketId', async (req, res: Response) => {
  try {
    const cricketId = parseInt(req.params.cricketId);
    if (isNaN(cricketId)) {
      return res.status(400).json({ error: 'Invalid cricketId' });
    }
    const odds = await oddsApiScraper.getDetailedOdds(cricketId);
    if (!odds) {
      return res.status(404).json({ error: 'Odds not found' });
    }
    res.json({ status: 'success', data: odds });
  } catch (err: any) {
    console.error('odds error:', err.message);
    res.status(500).json({ error: 'Failed to fetch odds' });
  }
});

// GET /api/cricket/event-data/:cricketId
router.get('/event-data/:cricketId', async (req, res: Response) => {
  try {
    const cricketId = parseInt(req.params.cricketId);
    if (isNaN(cricketId)) {
      return res.status(400).json({ error: 'Invalid cricketId' });
    }
    const event = await prisma.cricketEvent.findUnique({
      where: { cricketId },
      include: { markets: true },
    });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ status: 'success', data: event });
  } catch (err: any) {
    console.error('event-data error:', err.message);
    res.status(500).json({ error: 'Failed to fetch event data' });
  }
});

// GET /api/cricket/match-details?eventId=xxx
router.get('/match-details', async (req, res: Response) => {
  try {
    const { eventId } = req.query;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId query parameter is required' });
    }

    const event = await prisma.cricketEvent.findUnique({
      where: { id: eventId as string },
      include: {
        markets: true,
        bets: true,
        fancyBets: true,
      },
    });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ status: 'success', data: event });
  } catch (err: any) {
    console.error('match-details error:', err.message);
    res.status(500).json({ error: 'Failed to fetch match details' });
  }
});

// ─── ADMIN ENDPOINTS ──────────────────────────────────────────

// PUT /api/cricket/match-enable-disable — Body: { cricketId, isActive }
router.put(
  '/match-enable-disable',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketId = parseInt(req.body.cricketId ?? req.query.eventId);
      const isActive = req.body.isActive ?? (req.query.flag === 'true');

      if (isNaN(cricketId)) {
        return res.status(400).json({ error: 'Invalid cricketId' });
      }

      const event = await prisma.cricketEvent.update({
        where: { cricketId },
        data: { isActive },
      });

      res.json({ status: 'success', data: event });
    } catch (err: any) {
      console.error('match-enable-disable error:', err.message);
      res.status(500).json({ error: 'Failed to toggle match active status' });
    }
  }
);

// PUT /api/cricket/match-bet-lock — Body: { cricketId, isBetLocked }
router.put(
  '/match-bet-lock',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketId = parseInt(req.body.cricketId ?? req.query.matchId);
      const isBetLocked = req.body.isBetLocked ?? (req.query.flag === 'true');
      const isFancyLocked = req.body.isFancyLocked;

      if (isNaN(cricketId)) {
        return res.status(400).json({ error: 'Invalid cricketId' });
      }

      const data: any = {};
      if (isBetLocked !== undefined) data.isBetLocked = isBetLocked;
      if (isFancyLocked !== undefined) data.isFancyLocked = isFancyLocked;

      const event = await prisma.cricketEvent.update({
        where: { cricketId },
        data,
      });

      res.json({ status: 'success', data: event });
    } catch (err: any) {
      console.error('match-bet-lock error:', err.message);
      res.status(500).json({ error: 'Failed to toggle bet lock' });
    }
  }
);

// PUT /api/cricket/match-max-min-bet — Body: { cricketId, minBet, maxBet }
router.put(
  '/match-max-min-bet',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketId = parseInt(req.body.cricketId ?? req.query.matchId);
      const minBet = parseFloat(req.body.minBet ?? req.query.minBet);
      const maxBet = parseFloat(req.body.maxBet ?? req.query.maxBet);

      if (isNaN(cricketId)) {
        return res.status(400).json({ error: 'Invalid cricketId' });
      }
      if (isNaN(minBet) || isNaN(maxBet)) {
        return res.status(400).json({ error: 'Invalid minBet or maxBet' });
      }
      if (minBet > maxBet) {
        return res.status(400).json({ error: 'minBet cannot be greater than maxBet' });
      }

      const event = await prisma.cricketEvent.update({
        where: { cricketId },
        data: { minBet, maxBet },
      });

      res.json({ status: 'success', data: event });
    } catch (err: any) {
      console.error('match-max-min-bet error:', err.message);
      res.status(500).json({ error: 'Failed to update bet limits' });
    }
  }
);

// PUT /api/cricket/match-type — Body: { cricketId, matchType }
router.put(
  '/match-type',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketId = parseInt(req.body.cricketId ?? req.query.eventId);
      const matchType = (req.body.matchType ?? req.query.matchType) as string;

      if (isNaN(cricketId)) {
        return res.status(400).json({ error: 'Invalid cricketId' });
      }

      const matchTypeSchema = z.enum(['ODI', 'T20', 'TEST']);
      const validatedType = matchTypeSchema.parse(matchType);

      const event = await prisma.cricketEvent.update({
        where: { cricketId },
        data: { matchType: validatedType },
      });

      res.json({ status: 'success', data: event });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid matchType. Must be ODI, T20, or TEST' });
      }
      console.error('match-type error:', err.message);
      res.status(500).json({ error: 'Failed to update match type' });
    }
  }
);

// PUT /api/cricket/market-enable-disable?marketId=xxx&flag=true
router.put(
  '/market-enable-disable',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { marketId, flag } = req.query;

      if (!marketId) {
        return res.status(400).json({ error: 'marketId is required' });
      }

      const market = await prisma.market.update({
        where: { id: marketId as string },
        data: { isActive: flag === 'true' },
      });

      res.json({ status: 'success', data: market });
    } catch (err: any) {
      console.error('market-enable-disable error:', err.message);
      res.status(500).json({ error: 'Failed to toggle market active status' });
    }
  }
);

// PUT /api/cricket/market-bet-lock?marketId=xxx&flag=true
router.put(
  '/market-bet-lock',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { marketId, flag } = req.query;

      if (!marketId) {
        return res.status(400).json({ error: 'marketId is required' });
      }

      const market = await prisma.market.update({
        where: { id: marketId as string },
        data: { isBetLocked: flag === 'true' },
      });

      res.json({ status: 'success', data: market });
    } catch (err: any) {
      console.error('market-bet-lock error:', err.message);
      res.status(500).json({ error: 'Failed to toggle market bet lock' });
    }
  }
);

// PUT /api/cricket/market-max-min-bet?marketId=xxx&minBet=100&maxBet=500000
router.put(
  '/market-max-min-bet',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { marketId } = req.query;
      const minBet = parseFloat(req.query.minBet as string);
      const maxBet = parseFloat(req.query.maxBet as string);

      if (!marketId) {
        return res.status(400).json({ error: 'marketId is required' });
      }
      if (isNaN(minBet) || isNaN(maxBet)) {
        return res.status(400).json({ error: 'Invalid minBet or maxBet' });
      }
      if (minBet > maxBet) {
        return res.status(400).json({ error: 'minBet cannot be greater than maxBet' });
      }

      const market = await prisma.market.update({
        where: { id: marketId as string },
        data: { minBet, maxBet },
      });

      res.json({ status: 'success', data: market });
    } catch (err: any) {
      console.error('market-max-min-bet error:', err.message);
      res.status(500).json({ error: 'Failed to update market bet limits' });
    }
  }
);

// PUT /api/cricket/odds-difference — Body: { cricketId, oddsDifference }
router.put(
  '/odds-difference',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketEventId = parseInt(req.body.cricketId ?? req.query.cricketEventId);
      const difference = parseFloat(req.body.oddsDifference ?? req.query.difference);

      if (isNaN(cricketEventId)) {
        return res.status(400).json({ error: 'Invalid cricketEventId' });
      }
      if (isNaN(difference)) {
        return res.status(400).json({ error: 'Invalid difference value' });
      }

      const event = await prisma.cricketEvent.update({
        where: { cricketId: cricketEventId },
        data: { oddsDifference: difference },
      });

      res.json({ status: 'success', data: event });
    } catch (err: any) {
      console.error('odds-difference error:', err.message);
      res.status(500).json({ error: 'Failed to update odds difference' });
    }
  }
);

// GET /api/cricket/odds-difference/:cricketEventId
router.get(
  '/odds-difference/:cricketEventId',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const cricketEventId = parseInt(req.params.cricketEventId);
      if (isNaN(cricketEventId)) {
        return res.status(400).json({ error: 'Invalid cricketEventId' });
      }

      const event = await prisma.cricketEvent.findUnique({
        where: { cricketId: cricketEventId },
        select: { cricketId: true, oddsDifference: true },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({ status: 'success', data: { cricketId: event.cricketId, oddsDifference: event.oddsDifference } });
    } catch (err: any) {
      console.error('get odds-difference error:', err.message);
      res.status(500).json({ error: 'Failed to fetch odds difference' });
    }
  }
);

// PUT /api/cricket/admin/update-status
const GameStatusUpdateDTO = z.object({
  cricketId: z.number().int(),
  isActive: z.boolean().optional(),
  isBetLockedAll: z.boolean().optional(),
  isFancyLockedAll: z.boolean().optional(),
  betLockedUsers: z.array(z.string()).optional(),
  fancyLockedUsers: z.array(z.string()).optional(),
});

router.put(
  '/admin/update-status',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const body = GameStatusUpdateDTO.parse(req.body);

      const updateData: any = {};

      if (body.isActive !== undefined) {
        updateData.isActive = body.isActive;
      }
      if (body.isBetLockedAll !== undefined) {
        updateData.isBetLocked = body.isBetLockedAll;
      }
      if (body.isFancyLockedAll !== undefined) {
        updateData.isFancyLocked = body.isFancyLockedAll;
      }
      if (body.betLockedUsers !== undefined) {
        updateData.betLockedUsers = body.betLockedUsers;
      }
      if (body.fancyLockedUsers !== undefined) {
        updateData.fancyLockedUsers = body.fancyLockedUsers;
      }

      const event = await prisma.cricketEvent.update({
        where: { cricketId: body.cricketId },
        data: updateData,
      });

      res.json({ status: 'success', data: event });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      console.error('admin/update-status error:', err.message);
      res.status(500).json({ error: 'Failed to update game status' });
    }
  }
);

export default router;
