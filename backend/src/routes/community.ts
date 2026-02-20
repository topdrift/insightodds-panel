import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── LEADERBOARD: TOP 10 AGENTS ─────────────────────────

router.get(
  '/leaderboard',
  authorize('SUPER_ADMIN', 'ADMIN', 'AGENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      // Get all agents
      const agents = await prisma.user.findMany({
        where: { role: 'AGENT', isActive: true },
        select: {
          id: true,
          username: true,
          name: true,
          _count: { select: { children: true } },
        },
      });

      if (agents.length === 0) {
        return res.json({ data: [] });
      }

      const agentIds = agents.map((a) => a.id);

      // Get commission earnings per agent
      const commissions = await prisma.commissionRecord.groupBy({
        by: ['userId'],
        where: { userId: { in: agentIds } },
        _sum: { amount: true },
      });

      // Get total bet volume (bets placed by each agent's clients)
      const agentClientMap = await prisma.user.findMany({
        where: { parentId: { in: agentIds }, role: 'CLIENT' },
        select: { id: true, parentId: true },
      });

      // Group clients by agent
      const clientsByAgent: Record<string, string[]> = {};
      for (const client of agentClientMap) {
        if (client.parentId) {
          if (!clientsByAgent[client.parentId]) clientsByAgent[client.parentId] = [];
          clientsByAgent[client.parentId].push(client.id);
        }
      }

      // Get bet volumes per client
      const allClientIds = agentClientMap.map((c) => c.id);
      const [betVolumes, fancyVolumes] = await Promise.all([
        prisma.bet.groupBy({
          by: ['userId'],
          where: { userId: { in: allClientIds } },
          _sum: { amount: true },
        }),
        prisma.fancyBet.groupBy({
          by: ['userId'],
          where: { userId: { in: allClientIds } },
          _sum: { amount: true },
        }),
      ]);

      // Build volume maps
      const betVolumeMap: Record<string, number> = {};
      for (const bv of betVolumes) {
        betVolumeMap[bv.userId] = parseFloat((bv._sum.amount || 0).toString());
      }
      const fancyVolumeMap: Record<string, number> = {};
      for (const fv of fancyVolumes) {
        fancyVolumeMap[fv.userId] = parseFloat((fv._sum.amount || 0).toString());
      }

      // Build commission map
      const commissionMap: Record<string, number> = {};
      for (const c of commissions) {
        commissionMap[c.userId] = parseFloat((c._sum.amount || 0).toString());
      }

      // Build leaderboard
      const leaderboard = agents.map((agent) => {
        const clients = clientsByAgent[agent.id] || [];
        let totalBetVolume = 0;
        for (const clientId of clients) {
          totalBetVolume += (betVolumeMap[clientId] || 0) + (fancyVolumeMap[clientId] || 0);
        }

        return {
          id: agent.id,
          username: agent.username,
          name: agent.name,
          totalEarnings: commissionMap[agent.id] || 0,
          totalBetVolume,
          clientCount: agent._count.children,
        };
      });

      // Sort by totalEarnings desc, take top 10
      leaderboard.sort((a, b) => b.totalEarnings - a.totalEarnings);
      const top10 = leaderboard.slice(0, 10).map((entry, idx) => ({
        rank: idx + 1,
        ...entry,
      }));

      res.json({ data: top10 });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch leaderboard' });
    }
  }
);

// ─── FEEDBACK: LIST ──────────────────────────────────────

router.get(
  '/feedback',
  authorize('SUPER_ADMIN', 'ADMIN', 'AGENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const size = Math.min(50, Math.max(1, parseInt(req.query.size as string) || 20));

      const [total, feedbacks] = await Promise.all([
        prisma.agentFeedback.count(),
        prisma.agentFeedback.findMany({
          include: {
            user: { select: { id: true, username: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * size,
          take: size,
        }),
      ]);

      res.json({
        data: feedbacks,
        pagination: { page, size, total, totalPages: Math.ceil(total / size) },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch feedback' });
    }
  }
);

// ─── FEEDBACK: POST ──────────────────────────────────────

router.post(
  '/feedback',
  authorize('SUPER_ADMIN', 'ADMIN', 'AGENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({ message: z.string().min(1).max(500) });
      const { message } = schema.parse(req.body);

      const feedback = await prisma.agentFeedback.create({
        data: {
          userId: req.user!.userId,
          message,
        },
        include: {
          user: { select: { id: true, username: true, name: true } },
        },
      });

      res.status(201).json({ message: 'Feedback posted', data: feedback });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(500).json({ error: err.message || 'Failed to post feedback' });
    }
  }
);

// ─── FEEDBACK: DELETE ────────────────────────────────────

router.delete(
  '/feedback/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'AGENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      const feedback = await prisma.agentFeedback.findUnique({
        where: { id: req.params.id },
      });

      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      // Only owner or admin can delete
      const isOwner = feedback.userId === req.user!.userId;
      const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role);
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      await prisma.agentFeedback.delete({ where: { id: req.params.id } });

      res.json({ message: 'Feedback deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete feedback' });
    }
  }
);

export default router;
