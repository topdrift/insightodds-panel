import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { aviatorEngine } from '../services/casino/aviator';
import { startHand, hit, stand, doubleDown } from '../services/casino/blackjack';
import { prisma } from '../utils/prisma';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── LIST ACTIVE GAMES ────────────────────────────────────

router.get('/games', async (_req: AuthRequest, res) => {
  try {
    const games = await prisma.casinoGame.findMany({
      where: { isActive: true },
      select: {
        id: true,
        gameType: true,
        name: true,
        minBet: true,
        maxBet: true,
        houseEdge: true,
      },
    });
    res.json(games);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── AVIATOR ──────────────────────────────────────────────

router.get('/aviator/state', (_req: AuthRequest, res) => {
  try {
    const state = aviatorEngine.getCurrentState();
    res.json(state);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/aviator/bet', async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }
    const result = await aviatorEngine.placeBet(req.user!.userId, amount);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/aviator/cashout', async (req: AuthRequest, res) => {
  try {
    const { betId } = req.body;
    if (!betId) {
      return res.status(400).json({ error: 'betId required' });
    }
    const result = await aviatorEngine.cashOut(req.user!.userId, betId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/aviator/history', async (_req: AuthRequest, res) => {
  try {
    const rounds = await prisma.casinoRound.findMany({
      where: {
        game: { gameType: 'AVIATOR' },
        status: 'COMPLETED',
      },
      orderBy: { roundNumber: 'desc' },
      take: 30,
      select: {
        id: true,
        roundNumber: true,
        crashPoint: true,
        startedAt: true,
        endedAt: true,
      },
    });
    res.json(rounds);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/aviator/my-bets', async (req: AuthRequest, res) => {
  try {
    const bets = await prisma.casinoBet.findMany({
      where: {
        userId: req.user!.userId,
        round: { game: { gameType: 'AVIATOR' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amount: true,
        cashOutMultiplier: true,
        profitLoss: true,
        status: true,
        createdAt: true,
        round: {
          select: {
            roundNumber: true,
            crashPoint: true,
          },
        },
      },
    });
    res.json(bets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── BLACKJACK ────────────────────────────────────────────

router.post('/blackjack/deal', async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }
    const result = await startHand(req.user!.userId, amount);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/blackjack/hit', async (req: AuthRequest, res) => {
  try {
    const { betId } = req.body;
    if (!betId) return res.status(400).json({ error: 'betId required' });
    const result = await hit(betId, req.user!.userId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/blackjack/stand', async (req: AuthRequest, res) => {
  try {
    const { betId } = req.body;
    if (!betId) return res.status(400).json({ error: 'betId required' });
    const result = await stand(betId, req.user!.userId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/blackjack/double', async (req: AuthRequest, res) => {
  try {
    const { betId } = req.body;
    if (!betId) return res.status(400).json({ error: 'betId required' });
    const result = await doubleDown(betId, req.user!.userId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/blackjack/history', async (req: AuthRequest, res) => {
  try {
    const bets = await prisma.casinoBet.findMany({
      where: {
        userId: req.user!.userId,
        round: { game: { gameType: 'BLACKJACK' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amount: true,
        playerCards: true,
        playerScore: true,
        profitLoss: true,
        status: true,
        actions: true,
        createdAt: true,
        round: {
          select: {
            roundNumber: true,
            dealerCards: true,
            dealerScore: true,
          },
        },
      },
    });
    res.json(bets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
