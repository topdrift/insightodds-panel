import { Router, Response } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { PromoCodeType, Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { scheduleMarketingBets } from '../services/marketing-bets';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── HELPERS ──────────────────────────────────────────────

function toNumber(val: Decimal | number | string): number {
  return parseFloat(val.toString());
}

const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  AGENT: 2,
  CLIENT: 1,
};

// ─── VALIDATION SCHEMAS ───────────────────────────────────

const createPromoSchema = z.object({
  code: z.string().min(3).max(30).transform((v) => v.toUpperCase().trim()),
  type: z.nativeEnum(PromoCodeType),
  description: z.string().optional(),
  amount: z.number().min(0).default(0),
  agentId: z.string().optional(),
  agentBonus: z.number().min(0).default(0),
  clientBonus: z.number().min(0).default(0),
  maxUses: z.number().int().min(0).default(0),
  minRole: z.nativeEnum(Role).default('CLIENT'),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
  // Marketing fields
  marketingTarget: z.enum(['CASINO', 'CRICKET', 'BOTH']).optional(),
  marketingWinAmount: z.number().positive().optional(),
  marketingSpreadHrs: z.number().int().min(1).max(48).optional(),
}).refine(
  (data) => {
    if (data.type === 'MARKETING') {
      return !!data.marketingTarget && !!data.marketingWinAmount && !!data.marketingSpreadHrs && data.amount > 0;
    }
    return true;
  },
  { message: 'Marketing promos require marketingTarget, marketingWinAmount, marketingSpreadHrs, and amount > 0' },
);

const updatePromoSchema = z.object({
  description: z.string().optional(),
  maxUses: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

const redeemSchema = z.object({
  code: z.string().min(1).transform((v) => v.toUpperCase().trim()),
});

// ─── ADMIN: CREATE PROMO ──────────────────────────────────

router.post(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createPromoSchema.parse(req.body);

      // Validate REFERRAL_BONUS requires agentId
      if (data.type === 'REFERRAL_BONUS' && !data.agentId) {
        return res.status(400).json({ error: 'Agent ID required for referral bonus codes' });
      }

      // Validate agent exists if provided
      if (data.agentId) {
        const agent = await prisma.user.findUnique({
          where: { id: data.agentId },
          select: { id: true, role: true },
        });
        if (!agent || agent.role !== 'AGENT') {
          return res.status(400).json({ error: 'Invalid agent ID' });
        }
      }

      // Check code uniqueness
      const existing = await prisma.promoCode.findUnique({ where: { code: data.code } });
      if (existing) {
        return res.status(400).json({ error: 'Promo code already exists' });
      }

      const promo = await prisma.promoCode.create({
        data: {
          code: data.code,
          type: data.type,
          description: data.description,
          amount: data.amount,
          agentId: data.agentId,
          agentBonus: data.agentBonus,
          clientBonus: data.clientBonus,
          maxUses: data.maxUses,
          minRole: data.minRole,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          isActive: data.isActive,
          createdBy: req.user!.userId,
          marketingTarget: data.marketingTarget,
          marketingWinAmount: data.marketingWinAmount,
          marketingSpreadHrs: data.marketingSpreadHrs,
        },
      });

      res.status(201).json({ message: 'Promo code created', data: promo });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(500).json({ error: err.message || 'Failed to create promo code' });
    }
  }
);

// ─── ADMIN: LIST PROMOS ───────────────────────────────────

router.get(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const size = Math.min(50, Math.max(1, parseInt(req.query.size as string) || 20));
      const type = req.query.type as string;
      const active = req.query.active as string;
      const search = req.query.search as string;

      const where: any = {};
      if (type && Object.values(PromoCodeType).includes(type as PromoCodeType)) {
        where.type = type;
      }
      if (active === 'true') where.isActive = true;
      if (active === 'false') where.isActive = false;
      if (search) {
        where.code = { contains: search.toUpperCase(), mode: 'insensitive' };
      }

      const [total, promos] = await Promise.all([
        prisma.promoCode.count({ where }),
        prisma.promoCode.findMany({
          where,
          include: {
            agent: { select: { id: true, username: true, name: true } },
            _count: { select: { redemptions: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * size,
          take: size,
        }),
      ]);

      res.json({
        data: promos,
        pagination: {
          page,
          size,
          total,
          totalPages: Math.ceil(total / size),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list promo codes' });
    }
  }
);

// ─── USER: MY REDEMPTIONS ─────────────────────────────────

router.get('/my-redemptions', async (req: AuthRequest, res: Response) => {
  try {
    const redemptions = await prisma.promoRedemption.findMany({
      where: { userId: req.user!.userId },
      include: {
        promoCode: { select: { code: true, type: true, description: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: redemptions });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch redemptions' });
  }
});

// ─── USER: REDEEM CODE ────────────────────────────────────

router.post('/redeem', async (req: AuthRequest, res: Response) => {
  try {
    const { code } = redeemSchema.parse(req.body);
    const { userId, role } = req.user!;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find promo code
      const promo = await tx.promoCode.findUnique({
        where: { code },
        include: { agent: { select: { id: true, balance: true } } },
      });

      if (!promo) {
        throw new Error('Invalid promo code');
      }

      // 2. Validate: active
      if (!promo.isActive) {
        throw new Error('This promo code is no longer active');
      }

      // 3. Validate: not expired
      if (promo.expiresAt && new Date() > promo.expiresAt) {
        throw new Error('This promo code has expired');
      }

      // 4. Validate: max uses
      if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
        throw new Error('This promo code has reached its maximum redemptions');
      }

      // 5. Validate: role eligibility
      if (ROLE_HIERARCHY[role] > ROLE_HIERARCHY[promo.minRole]) {
        throw new Error('You are not eligible to redeem this code');
      }

      // 6. Check no prior redemption
      const existingRedemption = await tx.promoRedemption.findUnique({
        where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
      });
      if (existingRedemption) {
        throw new Error('You have already redeemed this code');
      }

      // 7. For REFERRAL_BONUS: verify user is CLIENT and parentId matches agentId
      if (promo.type === 'REFERRAL_BONUS') {
        if (role !== 'CLIENT') {
          throw new Error('Only clients can redeem referral bonus codes');
        }
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { parentId: true },
        });
        if (!user || user.parentId !== promo.agentId) {
          throw new Error('This referral code is not valid for your account');
        }
      }

      // Determine credit amount
      const creditAmount = promo.type === 'REFERRAL_BONUS'
        ? new Decimal(promo.clientBonus.toString())
        : new Decimal(promo.amount.toString()); // BALANCE_CREDIT and MARKETING use amount

      // 8. Credit user balance + create Transaction
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: creditAmount.toNumber() } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'FREE_CHIPS',
          amount: creditAmount.toNumber(),
          balance: toNumber(updatedUser.balance),
          remarks: `Promo code redeemed: ${promo.code}`,
          createdBy: userId,
        },
      });

      // 9. For REFERRAL_BONUS: credit agent
      let agentNewBalance: number | undefined;
      if (promo.type === 'REFERRAL_BONUS' && promo.agentId) {
        const agentBonus = new Decimal(promo.agentBonus.toString());
        if (agentBonus.gt(0)) {
          const updatedAgent = await tx.user.update({
            where: { id: promo.agentId },
            data: { balance: { increment: agentBonus.toNumber() } },
          });

          await tx.transaction.create({
            data: {
              userId: promo.agentId,
              type: 'FREE_CHIPS',
              amount: agentBonus.toNumber(),
              balance: toNumber(updatedAgent.balance),
              remarks: `Referral bonus from promo: ${promo.code}`,
              createdBy: userId,
            },
          });

          agentNewBalance = toNumber(updatedAgent.balance);
        }
      }

      // 10. Create redemption record + increment usedCount
      await tx.promoRedemption.create({
        data: {
          promoCodeId: promo.id,
          userId,
          amount: creditAmount.toNumber(),
          ip,
        },
      });

      await tx.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      });

      return {
        userBalance: toNumber(updatedUser.balance),
        creditedAmount: creditAmount.toNumber(),
        agentId: promo.agentId,
        agentNewBalance,
        promoType: promo.type,
        promoId: promo.id,
        marketingTarget: promo.marketingTarget,
        marketingWinAmount: promo.marketingWinAmount ? toNumber(promo.marketingWinAmount) : null,
        marketingSpreadHrs: promo.marketingSpreadHrs,
      };
    });

    // Schedule marketing bets after transaction commits
    if (
      result.promoType === 'MARKETING' &&
      result.marketingTarget &&
      result.marketingWinAmount &&
      result.marketingSpreadHrs
    ) {
      scheduleMarketingBets(
        userId,
        result.promoId,
        result.marketingTarget,
        result.marketingWinAmount,
        result.marketingSpreadHrs,
      ).catch((err) => {
        console.error('Failed to schedule marketing bets:', err.message);
      });
    }

    // 11. Socket emit balance updates
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('balance:updated', { balance: result.userBalance });
      if (result.agentId && result.agentNewBalance !== undefined) {
        io.to(`user:${result.agentId}`).emit('balance:updated', { balance: result.agentNewBalance });
      }
    }

    res.json({
      message: 'Promo code redeemed successfully',
      amount: result.creditedAmount,
      balance: result.userBalance,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(400).json({ error: err.message || 'Failed to redeem promo code' });
  }
});

// ─── ADMIN: PROMO DETAIL ─────────────────────────────────

router.get(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const promo = await prisma.promoCode.findUnique({
        where: { id: req.params.id },
        include: {
          agent: { select: { id: true, username: true, name: true } },
          redemptions: {
            include: {
              user: { select: { id: true, username: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          marketingJobs: {
            orderBy: { scheduledAt: 'asc' },
            select: {
              id: true,
              userId: true,
              target: true,
              amount: true,
              scheduledAt: true,
              executedAt: true,
              betId: true,
              betType: true,
              status: true,
              error: true,
              createdAt: true,
            },
          },
        },
      });

      if (!promo) {
        return res.status(404).json({ error: 'Promo code not found' });
      }

      res.json({ data: promo });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch promo code' });
    }
  }
);

// ─── ADMIN: UPDATE PROMO ──────────────────────────────────

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updatePromoSchema.parse(req.body);

      const existing = await prisma.promoCode.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return res.status(404).json({ error: 'Promo code not found' });
      }

      const promo = await prisma.promoCode.update({
        where: { id: req.params.id },
        data: {
          description: data.description,
          maxUses: data.maxUses,
          isActive: data.isActive,
          expiresAt: data.expiresAt !== undefined
            ? (data.expiresAt ? new Date(data.expiresAt) : null)
            : undefined,
        },
      });

      res.json({ message: 'Promo code updated', data: promo });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(500).json({ error: err.message || 'Failed to update promo code' });
    }
  }
);

// ─── ADMIN: DELETE PROMO ──────────────────────────────────

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const promo = await prisma.promoCode.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { redemptions: true } } },
      });

      if (!promo) {
        return res.status(404).json({ error: 'Promo code not found' });
      }

      if (promo._count.redemptions > 0) {
        // Soft delete: just deactivate
        await prisma.promoCode.update({
          where: { id: req.params.id },
          data: { isActive: false },
        });
        res.json({ message: 'Promo code deactivated (has existing redemptions)' });
      } else {
        // Hard delete
        await prisma.promoCode.delete({ where: { id: req.params.id } });
        res.json({ message: 'Promo code deleted' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete promo code' });
    }
  }
);

export default router;
