import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { automationEngine } from '../services/automation';
import {
  calculateCashOut,
  calculateFancyCashOut,
  executeCashOut,
  executeFancyCashOut,
} from '../services/cash-out';

const router = Router();

// Authentication required for all endpoints
router.use(authenticate);

// ─── PLAYER-ACCESSIBLE CASH-OUT ENDPOINTS ─────────────────────
// These must be defined BEFORE the admin-only middleware

// POST /api/automation/cash-out/calculate — any authenticated user can calculate
router.post('/cash-out/calculate/my', async (req: AuthRequest, res: Response) => {
  try {
    const body = CashOutCalcDTO.parse(req.body);

    // Verify the bet belongs to this user
    const bet = body.isFancy
      ? await prisma.fancyBet.findUnique({ where: { id: body.betId }, select: { userId: true } })
      : await prisma.bet.findUnique({ where: { id: body.betId }, select: { userId: true } });

    if (!bet) return res.status(404).json({ error: 'Bet not found' });
    if (bet.userId !== req.user!.userId) return res.status(403).json({ error: 'Not your bet' });

    let result;
    if (body.isFancy) {
      if (body.currentScore === undefined) {
        return res.status(400).json({ error: 'currentScore is required for fancy bet cash-out' });
      }
      result = await calculateFancyCashOut(body.betId, body.currentScore, body.marginPercent);
    } else {
      result = await calculateCashOut(body.betId, body.currentOdds, body.marginPercent);
    }

    res.json({ status: 'success', data: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to calculate cash-out' });
  }
});

// POST /api/automation/cash-out/execute/my — player executes their own cash-out
router.post('/cash-out/execute/my', async (req: AuthRequest, res: Response) => {
  try {
    const body = CashOutExecDTO.parse(req.body);

    const bet = body.isFancy
      ? await prisma.fancyBet.findUnique({ where: { id: body.betId }, select: { userId: true } })
      : await prisma.bet.findUnique({ where: { id: body.betId }, select: { userId: true } });

    if (!bet) return res.status(404).json({ error: 'Bet not found' });
    if (bet.userId !== req.user!.userId) return res.status(403).json({ error: 'Not your bet' });

    let result;
    if (body.isFancy) {
      result = await executeFancyCashOut(body.betId, req.user!.userId, body.cashOutAmount);
    } else {
      result = await executeCashOut(body.betId, req.user!.userId, body.cashOutAmount);
    }

    res.json({ status: 'success', data: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to execute cash-out' });
  }
});

// All remaining endpoints require admin role
router.use(authorize('SUPER_ADMIN', 'ADMIN'));

// ─── VALIDATION SCHEMAS ─────────────────────────────────────

const CreateRuleDTO = z.object({
  name: z.string().min(1).max(200),
  type: z.enum([
    'ODDS_MANIPULATION',
    'LIABILITY_THRESHOLD',
    'BET_DELAY',
    'SHARP_DETECTION',
    'AUTO_LOCK',
    'MARGIN_CONTROL',
  ]),
  config: z.record(z.any()),
  isActive: z.boolean().optional().default(true),
});

const UpdateRuleDTO = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum([
    'ODDS_MANIPULATION',
    'LIABILITY_THRESHOLD',
    'BET_DELAY',
    'SHARP_DETECTION',
    'AUTO_LOCK',
    'MARGIN_CONTROL',
  ]).optional(),
  config: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

const BetDelayDTO = z.object({
  delayMs: z.number().int().min(0).max(30000),
});

const CashOutCalcDTO = z.object({
  betId: z.string().min(1),
  currentOdds: z.number().positive(),
  isFancy: z.boolean().optional().default(false),
  currentScore: z.number().optional(),
  marginPercent: z.number().min(0).max(50).optional(),
});

const CashOutExecDTO = z.object({
  betId: z.string().min(1),
  cashOutAmount: z.number().min(0),
  isFancy: z.boolean().optional().default(false),
});

const BulkMessageDTO = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  type: z.string().optional().default('SYSTEM'),
  targetRole: z.enum(['ALL', 'CLIENT', 'AGENT', 'ADMIN']).optional().default('ALL'),
});

const BulkAdjustLimitsDTO = z.object({
  userIds: z.array(z.string().min(1)).min(1),
  limitType: z.enum(['CREDIT_REFERENCE', 'EXPOSURE_LIMIT']),
  adjustmentType: z.enum(['SET', 'INCREMENT', 'DECREMENT', 'MULTIPLY']),
  value: z.number().min(0),
});

// ─── RULE MANAGEMENT ────────────────────────────────────────

// GET /api/automation/rules — list all rules
router.get('/rules', async (_req: AuthRequest, res: Response) => {
  try {
    const rules = await prisma.automationRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: rules });
  } catch (err: any) {
    console.error('List rules error:', err.message);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

// POST /api/automation/rules — create rule
router.post('/rules', async (req: AuthRequest, res: Response) => {
  try {
    const body = CreateRuleDTO.parse(req.body);

    const rule = await prisma.automationRule.create({
      data: {
        name: body.name,
        type: body.type,
        config: body.config,
        isActive: body.isActive,
      },
    });

    // Reload rules in engine
    await automationEngine.reloadRules();

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE_AUTOMATION_RULE',
        entity: 'AutomationRule',
        entityId: rule.id,
        newData: { name: body.name, type: body.type, isActive: body.isActive },
      },
    });

    res.status(201).json({ status: 'success', data: rule });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Create rule error:', err.message);
    res.status(500).json({ error: 'Failed to create automation rule' });
  }
});

// PUT /api/automation/rules/:id — update rule
router.put('/rules/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = UpdateRuleDTO.parse(req.body);

    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.config !== undefined) updateData.config = body.config;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const rule = await prisma.automationRule.update({
      where: { id },
      data: updateData,
    });

    await automationEngine.reloadRules();

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE_AUTOMATION_RULE',
        entity: 'AutomationRule',
        entityId: id,
        oldData: { name: existing.name, type: existing.type, isActive: existing.isActive },
        newData: updateData,
      },
    });

    res.json({ status: 'success', data: rule });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Update rule error:', err.message);
    res.status(500).json({ error: 'Failed to update automation rule' });
  }
});

// DELETE /api/automation/rules/:id — delete rule
router.delete('/rules/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    await prisma.automationRule.delete({ where: { id } });
    await automationEngine.reloadRules();

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE_AUTOMATION_RULE',
        entity: 'AutomationRule',
        entityId: id,
        oldData: { name: existing.name, type: existing.type },
      },
    });

    res.json({ status: 'success', message: 'Rule deleted' });
  } catch (err: any) {
    console.error('Delete rule error:', err.message);
    res.status(500).json({ error: 'Failed to delete automation rule' });
  }
});

// POST /api/automation/rules/:id/toggle — enable/disable rule
router.post('/rules/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const rule = await prisma.automationRule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await automationEngine.reloadRules();

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'TOGGLE_AUTOMATION_RULE',
        entity: 'AutomationRule',
        entityId: id,
        oldData: { isActive: existing.isActive },
        newData: { isActive: rule.isActive },
      },
    });

    res.json({ status: 'success', data: rule, message: `Rule ${rule.isActive ? 'enabled' : 'disabled'}` });
  } catch (err: any) {
    console.error('Toggle rule error:', err.message);
    res.status(500).json({ error: 'Failed to toggle automation rule' });
  }
});

// ─── LIABILITY ──────────────────────────────────────────────

// GET /api/automation/liability/:eventId — real-time liability for event (cricketId)
router.get('/liability/:eventId', async (req: AuthRequest, res: Response) => {
  try {
    const cricketId = parseInt(req.params.eventId);
    if (isNaN(cricketId)) {
      return res.status(400).json({ error: 'Invalid eventId' });
    }

    const event = await prisma.cricketEvent.findUnique({ where: { cricketId } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const liability = await automationEngine.calculateLiability(event.id);

    // Also get fancy exposure for this event
    const fancyExposure = await prisma.fancyBet.aggregate({
      where: { cricketEventId: event.id, betStatus: 'MATCHED', settledAt: null },
      _sum: { loss: true, profit: true, amount: true },
      _count: true,
    });

    res.json({
      status: 'success',
      data: {
        event: {
          id: event.id,
          cricketId: event.cricketId,
          eventName: event.eventName,
          team1: event.team1,
          team2: event.team2,
        },
        matchLiability: liability,
        fancySummary: {
          totalFancyBets: fancyExposure._count || 0,
          totalFancyStake: parseFloat(fancyExposure._sum.amount?.toString() || '0'),
          totalFancyExposure: parseFloat(fancyExposure._sum.loss?.toString() || '0'),
          totalFancyProfit: parseFloat(fancyExposure._sum.profit?.toString() || '0'),
        },
      },
    });
  } catch (err: any) {
    console.error('Liability error:', err.message);
    res.status(500).json({ error: 'Failed to calculate liability' });
  }
});

// GET /api/automation/liability/overview — liability overview for all active events
router.get('/liability/overview', async (_req: AuthRequest, res: Response) => {
  try {
    const overview = await automationEngine.getLiabilityOverview();
    res.json({ status: 'success', data: overview });
  } catch (err: any) {
    console.error('Liability overview error:', err.message);
    res.status(500).json({ error: 'Failed to fetch liability overview' });
  }
});

// ─── RISK & SHARP BETTORS ───────────────────────────────────

// GET /api/automation/risk-alerts — current risk alerts
router.get('/risk-alerts', async (_req: AuthRequest, res: Response) => {
  try {
    const alerts = await automationEngine.getRiskAlerts();
    res.json({ status: 'success', data: alerts, total: alerts.length });
  } catch (err: any) {
    console.error('Risk alerts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch risk alerts' });
  }
});

// GET /api/automation/sharp-bettors — sharp bettor report
router.get('/sharp-bettors', async (_req: AuthRequest, res: Response) => {
  try {
    const sharpBettors = await automationEngine.detectSharpBettors();
    res.json({ status: 'success', data: sharpBettors, total: sharpBettors.length });
  } catch (err: any) {
    console.error('Sharp bettors error:', err.message);
    res.status(500).json({ error: 'Failed to detect sharp bettors' });
  }
});

// ─── BULK OPERATIONS ────────────────────────────────────────

// POST /api/automation/bulk/lock-all — lock all markets
router.post('/bulk/lock-all', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.cricketEvent.updateMany({
      where: { isActive: true, isSettled: false },
      data: { isBetLocked: true, isFancyLocked: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'BULK_LOCK_ALL_MARKETS',
        entity: 'CricketEvent',
        newData: { lockedCount: result.count },
      },
    });

    // Notify all connected clients via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('markets:locked', { message: 'All markets have been locked', timestamp: new Date() });
    }

    res.json({ status: 'success', message: `${result.count} events locked`, count: result.count });
  } catch (err: any) {
    console.error('Bulk lock error:', err.message);
    res.status(500).json({ error: 'Failed to lock all markets' });
  }
});

// POST /api/automation/bulk/unlock-all — unlock all markets
router.post('/bulk/unlock-all', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.cricketEvent.updateMany({
      where: { isActive: true, isSettled: false },
      data: { isBetLocked: false, isFancyLocked: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'BULK_UNLOCK_ALL_MARKETS',
        entity: 'CricketEvent',
        newData: { unlockedCount: result.count },
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('markets:unlocked', { message: 'All markets have been unlocked', timestamp: new Date() });
    }

    res.json({ status: 'success', message: `${result.count} events unlocked`, count: result.count });
  } catch (err: any) {
    console.error('Bulk unlock error:', err.message);
    res.status(500).json({ error: 'Failed to unlock all markets' });
  }
});

// POST /api/automation/bulk/message — send message to all users
router.post('/bulk/message', async (req: AuthRequest, res: Response) => {
  try {
    const body = BulkMessageDTO.parse(req.body);

    // Get target users
    const where: any = { isActive: true };
    if (body.targetRole !== 'ALL') {
      where.role = body.targetRole;
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    });

    if (users.length === 0) {
      return res.json({ status: 'success', message: 'No users found matching criteria', count: 0 });
    }

    // Create notifications in bulk
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title: body.title,
        message: body.message,
        type: body.type,
        data: { sentBy: req.user!.userId, bulkMessage: true },
      })),
    });

    // Emit socket notification to all targeted users
    const io = req.app.get('io');
    if (io) {
      for (const user of users) {
        io.to(`user:${user.id}`).emit('notification:new', {
          title: body.title,
          message: body.message,
          type: body.type,
          timestamp: new Date(),
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'BULK_MESSAGE',
        entity: 'Notification',
        newData: { title: body.title, targetRole: body.targetRole, recipientCount: users.length },
      },
    });

    res.json({ status: 'success', message: `Message sent to ${users.length} users`, count: users.length });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Bulk message error:', err.message);
    res.status(500).json({ error: 'Failed to send bulk message' });
  }
});

// POST /api/automation/bulk/adjust-limits — adjust limits for multiple users
router.post('/bulk/adjust-limits', async (req: AuthRequest, res: Response) => {
  try {
    const body = BulkAdjustLimitsDTO.parse(req.body);

    const field = body.limitType === 'CREDIT_REFERENCE' ? 'creditReference' : 'exposureLimit';
    let updatedCount = 0;

    for (const userId of body.userIds) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, creditReference: true, exposureLimit: true },
      });

      if (!user) continue;

      let newValue: number;
      const currentValue = parseFloat(
        (body.limitType === 'CREDIT_REFERENCE' ? user.creditReference : user.exposureLimit).toString()
      );

      switch (body.adjustmentType) {
        case 'SET':
          newValue = body.value;
          break;
        case 'INCREMENT':
          newValue = currentValue + body.value;
          break;
        case 'DECREMENT':
          newValue = Math.max(0, currentValue - body.value);
          break;
        case 'MULTIPLY':
          newValue = currentValue * body.value;
          break;
        default:
          newValue = currentValue;
      }

      await prisma.user.update({
        where: { id: userId },
        data: { [field]: newValue },
      });

      updatedCount++;
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'BULK_ADJUST_LIMITS',
        entity: 'User',
        newData: {
          limitType: body.limitType,
          adjustmentType: body.adjustmentType,
          value: body.value,
          userCount: updatedCount,
        },
      },
    });

    res.json({
      status: 'success',
      message: `Limits adjusted for ${updatedCount} users`,
      count: updatedCount,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Bulk adjust limits error:', err.message);
    res.status(500).json({ error: 'Failed to adjust limits' });
  }
});

// ─── DASHBOARD ──────────────────────────────────────────────

// GET /api/automation/dashboard — full automation dashboard data
router.get('/dashboard', async (_req: AuthRequest, res: Response) => {
  try {
    const data = await automationEngine.getDashboardData();
    res.json({ status: 'success', data });
  } catch (err: any) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to fetch automation dashboard' });
  }
});

// ─── BET DELAY ──────────────────────────────────────────────

// GET /api/automation/bet-delay — get current global bet delay
router.get('/bet-delay', async (_req: AuthRequest, res: Response) => {
  try {
    const delayMs = automationEngine.getGlobalBetDelay();
    res.json({ status: 'success', data: { delayMs } });
  } catch (err: any) {
    console.error('Get bet delay error:', err.message);
    res.status(500).json({ error: 'Failed to get bet delay' });
  }
});

// PUT /api/automation/bet-delay — set global bet delay
router.put('/bet-delay', async (req: AuthRequest, res: Response) => {
  try {
    const body = BetDelayDTO.parse(req.body);

    await automationEngine.setGlobalBetDelay(body.delayMs);

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'SET_BET_DELAY',
        entity: 'SystemSettings',
        newData: { delayMs: body.delayMs },
      },
    });

    res.json({ status: 'success', data: { delayMs: body.delayMs }, message: `Bet delay set to ${body.delayMs}ms` });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Set bet delay error:', err.message);
    res.status(500).json({ error: 'Failed to set bet delay' });
  }
});

// ─── CASH OUT ───────────────────────────────────────────────

// POST /api/automation/cash-out/calculate — calculate cash out value
router.post('/cash-out/calculate', async (req: AuthRequest, res: Response) => {
  try {
    const body = CashOutCalcDTO.parse(req.body);

    let result;
    if (body.isFancy) {
      if (body.currentScore === undefined) {
        return res.status(400).json({ error: 'currentScore is required for fancy bet cash-out calculation' });
      }
      result = await calculateFancyCashOut(body.betId, body.currentScore, body.marginPercent);
    } else {
      result = await calculateCashOut(body.betId, body.currentOdds, body.marginPercent);
    }

    res.json({ status: 'success', data: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Cash-out calculate error:', err.message);
    res.status(500).json({ error: 'Failed to calculate cash-out' });
  }
});

// POST /api/automation/cash-out/execute — execute cash out
router.post('/cash-out/execute', async (req: AuthRequest, res: Response) => {
  try {
    const body = CashOutExecDTO.parse(req.body);

    // For admin-initiated cash-outs, we need to determine the bet owner
    let betUserId: string;

    if (body.isFancy) {
      const bet = await prisma.fancyBet.findUnique({
        where: { id: body.betId },
        select: { userId: true },
      });
      if (!bet) return res.status(404).json({ error: 'Fancy bet not found' });
      betUserId = bet.userId;

      const result = await executeFancyCashOut(body.betId, betUserId, body.cashOutAmount);
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      // Emit balance update
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${betUserId}`).emit('balance:updated', { balance: result.newBalance });
        io.to(`user:${betUserId}`).emit('bet:cashed-out', { betId: body.betId, cashOutAmount: body.cashOutAmount });
      }

      return res.json({ status: 'success', data: result });
    } else {
      const bet = await prisma.bet.findUnique({
        where: { id: body.betId },
        select: { userId: true },
      });
      if (!bet) return res.status(404).json({ error: 'Bet not found' });
      betUserId = bet.userId;

      const result = await executeCashOut(body.betId, betUserId, body.cashOutAmount);
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      // Emit balance update
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${betUserId}`).emit('balance:updated', { balance: result.newBalance });
        io.to(`user:${betUserId}`).emit('bet:cashed-out', { betId: body.betId, cashOutAmount: body.cashOutAmount });
      }

      return res.json({ status: 'success', data: result });
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Cash-out execute error:', err.message);
    res.status(500).json({ error: 'Failed to execute cash-out' });
  }
});

export default router;
