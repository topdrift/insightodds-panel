import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest, verifyTransactionPassword } from '../middleware/auth';
import { getChildRole, generateUsername, validateHierarchy } from '../services/user-hierarchy';

const router = Router();

// All admin routes require authentication + admin-level role
router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'AGENT'));

// ─── HELPERS ───────────────────────────────────────────────

function toNumber(val: Decimal | number | string): number {
  return parseFloat(val.toString());
}

// ─── 1. LIST CHILDREN ──────────────────────────────────────

/**
 * GET /api/admin/list-children
 * Query: userType, search, isBlocked, page, size
 */
router.get('/list-children', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const {
      userType,
      search,
      isBlocked,
      page = '1',
      size = '20',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || '1'));
    const sizeNum = Math.max(1, Math.min(100, parseInt(size || '20')));
    const skip = (pageNum - 1) * sizeNum;

    const where: any = {};

    // SUPER_ADMIN can see all; others see only their direct children
    if (role !== 'SUPER_ADMIN') {
      where.parentId = userId;
    }

    if (userType) {
      where.role = userType as Role;
    }

    if (isBlocked !== undefined) {
      where.isActive = isBlocked === 'true' ? false : true;
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [children, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          mobile: true,
          role: true,
          balance: true,
          exposure: true,
          creditReference: true,
          exposureLimit: true,
          myPartnership: true,
          myCasinoPartnership: true,
          myMatkaPartnership: true,
          matchCommission: true,
          sessionCommission: true,
          casinoCommission: true,
          matkaCommission: true,
          isActive: true,
          isBetLocked: true,
          isCasinoLocked: true,
          isMatkaLocked: true,
          parentId: true,
          lastLogin: true,
          createdAt: true,
          _count: { select: { children: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: sizeNum,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: children,
      total,
      page: pageNum,
      size: sizeNum,
      totalPages: Math.ceil(total / sizeNum),
    });
  } catch (err: any) {
    console.error('List children error:', err);
    res.status(500).json({ error: 'Failed to list children' });
  }
});

// ─── 2. DEPOSIT / WITHDRAW TO CHILD ───────────────────────

/**
 * PUT /api/admin/children/:childId/deposit-withdraw
 * Body: { balance, remarks, transactionPassword, transactionType: 'DEPOSIT' | 'WITHDRAW' }
 */
const depositWithdrawSchema = z.object({
  balance: z.number().positive('Amount must be positive'),
  remarks: z.string().optional(),
  transactionPassword: z.string().min(1),
  transactionType: z.enum(['DEPOSIT', 'WITHDRAW']),
});

router.put(
  '/children/:childId/deposit-withdraw',
  verifyTransactionPassword(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.user!;
      const { childId } = req.params;
      const { balance: amount, remarks, transactionType } = depositWithdrawSchema.parse(req.body);

      const result = await prisma.$transaction(async (tx) => {
        const parent = await tx.user.findUnique({ where: { id: userId } });
        const child = await tx.user.findUnique({ where: { id: childId } });

        if (!parent || !child) {
          throw new Error('User not found');
        }

        if (child.parentId !== userId && parent.role !== 'SUPER_ADMIN') {
          throw new Error('Not authorized to manage this user');
        }

        const parentBal = new Decimal(parent.balance.toString());
        const childBal = new Decimal(child.balance.toString());
        const txAmount = new Decimal(amount);

        let updatedParent;
        let updatedChild;

        if (transactionType === 'DEPOSIT') {
          // Parent gives coins to child
          if (parentBal.lt(txAmount)) {
            throw new Error('Insufficient balance');
          }

          updatedParent = await tx.user.update({
            where: { id: userId },
            data: { balance: { decrement: amount } },
          });

          updatedChild = await tx.user.update({
            where: { id: childId },
            data: { balance: { increment: amount } },
          });
        } else {
          // WITHDRAW: child returns coins to parent
          if (childBal.lt(txAmount)) {
            throw new Error('Child has insufficient balance');
          }

          updatedChild = await tx.user.update({
            where: { id: childId },
            data: { balance: { decrement: amount } },
          });

          updatedParent = await tx.user.update({
            where: { id: userId },
            data: { balance: { increment: amount } },
          });
        }

        // Create transaction records for both parties
        await tx.transaction.createMany({
          data: [
            {
              userId: parent.id,
              type: transactionType === 'DEPOSIT' ? 'WITHDRAW' : 'DEPOSIT',
              amount: transactionType === 'DEPOSIT' ? -amount : amount,
              balance: toNumber(updatedParent.balance),
              reference: child.id,
              remarks: remarks || `${transactionType} ${transactionType === 'DEPOSIT' ? 'to' : 'from'} ${child.username}`,
              createdBy: userId,
            },
            {
              userId: child.id,
              type: transactionType === 'DEPOSIT' ? 'DEPOSIT' : 'WITHDRAW',
              amount: transactionType === 'DEPOSIT' ? amount : -amount,
              balance: toNumber(updatedChild.balance),
              reference: parent.id,
              remarks: remarks || `${transactionType} ${transactionType === 'DEPOSIT' ? 'from' : 'to'} ${parent.username}`,
              createdBy: userId,
            },
          ],
        });

        return {
          parentBalance: toNumber(updatedParent.balance),
          childBalance: toNumber(updatedChild.balance),
        };
      });

      // Emit balance updates via socket
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${userId}`).emit('balance:updated', { balance: result.parentBalance });
        io.to(`user:${childId}`).emit('balance:updated', { balance: result.childBalance });
      }

      res.json({ message: `${transactionType} successful`, ...result });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(400).json({ error: err.message || 'Transaction failed' });
    }
  }
);

// ─── 3. EDIT CHILD ─────────────────────────────────────────

/**
 * PUT /api/admin/children/:childId/edit
 * Body: { name, mobile, reference, matchCommission, sessionCommission,
 *         casinoCommission, matkaCommission, myPartnership,
 *         myCasinoPartnership, myMatkaPartnership }
 */
const editChildSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  mobile: z.string().max(20).optional(),
  reference: z.string().max(100).optional(),
  matchCommission: z.number().min(0).max(100).optional(),
  sessionCommission: z.number().min(0).max(100).optional(),
  casinoCommission: z.number().min(0).max(100).optional(),
  matkaCommission: z.number().min(0).max(100).optional(),
  myPartnership: z.number().min(0).max(100).optional(),
  myCasinoPartnership: z.number().min(0).max(100).optional(),
  myMatkaPartnership: z.number().min(0).max(100).optional(),
});

router.put('/children/:childId/edit', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const { childId } = req.params;
    const data = editChildSchema.parse(req.body);

    // Validate hierarchy: actor can manage target
    const canManageChild = await validateHierarchy(userId, childId);
    if (!canManageChild) {
      return res.status(403).json({ error: 'Not authorized to edit this user' });
    }

    const child = await prisma.user.findUnique({ where: { id: childId } });
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Build update payload (only provided fields)
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.reference !== undefined) updateData.reference = data.reference;
    if (data.matchCommission !== undefined) updateData.matchCommission = data.matchCommission;
    if (data.sessionCommission !== undefined) updateData.sessionCommission = data.sessionCommission;
    if (data.casinoCommission !== undefined) updateData.casinoCommission = data.casinoCommission;
    if (data.matkaCommission !== undefined) updateData.matkaCommission = data.matkaCommission;
    if (data.myPartnership !== undefined) updateData.myPartnership = data.myPartnership;
    if (data.myCasinoPartnership !== undefined) updateData.myCasinoPartnership = data.myCasinoPartnership;
    if (data.myMatkaPartnership !== undefined) updateData.myMatkaPartnership = data.myMatkaPartnership;

    const updated = await prisma.user.update({
      where: { id: childId },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        mobile: true,
        reference: true,
        role: true,
        matchCommission: true,
        sessionCommission: true,
        casinoCommission: true,
        matkaCommission: true,
        myPartnership: true,
        myCasinoPartnership: true,
        myMatkaPartnership: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'EDIT_CHILD',
        entity: 'User',
        entityId: childId,
        oldData: {
          name: child.name,
          mobile: child.mobile,
          reference: child.reference,
          matchCommission: toNumber(child.matchCommission),
          sessionCommission: toNumber(child.sessionCommission),
          casinoCommission: toNumber(child.casinoCommission),
          matkaCommission: toNumber(child.matkaCommission),
          myPartnership: toNumber(child.myPartnership),
          myCasinoPartnership: toNumber(child.myCasinoPartnership),
          myMatkaPartnership: toNumber(child.myMatkaPartnership),
        },
        newData: data,
      },
    });

    res.json({ message: 'Child updated successfully', data: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Edit child error:', err);
    res.status(500).json({ error: err.message || 'Failed to edit child' });
  }
});

// ─── 4. UPDATE CHILD LIMIT ─────────────────────────────────

/**
 * PUT /api/admin/children/:childId/limit
 * Body: { limitType: 'CREDIT_REFERENCE' | 'EXPOSURE_LIMIT', newLimit, oldLimit, transactionPassword }
 */
const limitSchema = z.object({
  limitType: z.enum(['CREDIT_REFERENCE', 'EXPOSURE_LIMIT']),
  newLimit: z.number().min(0),
  oldLimit: z.number().min(0),
  transactionPassword: z.string().min(1),
});

router.put(
  '/children/:childId/limit',
  verifyTransactionPassword(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.user!;
      const { childId } = req.params;
      const { limitType, newLimit, oldLimit } = limitSchema.parse(req.body);

      const canManageChild = await validateHierarchy(userId, childId);
      if (!canManageChild) {
        return res.status(403).json({ error: 'Not authorized to manage this user' });
      }

      const child = await prisma.user.findUnique({ where: { id: childId } });
      if (!child) {
        return res.status(404).json({ error: 'Child not found' });
      }

      // Verify old limit matches current value for optimistic concurrency
      const currentLimit =
        limitType === 'CREDIT_REFERENCE'
          ? toNumber(child.creditReference)
          : toNumber(child.exposureLimit);

      if (Math.abs(currentLimit - oldLimit) > 0.01) {
        return res.status(409).json({
          error: 'Limit has been modified by another request. Please refresh and try again.',
          currentLimit,
        });
      }

      const updateField =
        limitType === 'CREDIT_REFERENCE' ? 'creditReference' : 'exposureLimit';

      const updated = await prisma.user.update({
        where: { id: childId },
        data: { [updateField]: newLimit },
        select: {
          id: true,
          username: true,
          creditReference: true,
          exposureLimit: true,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_LIMIT',
          entity: 'User',
          entityId: childId,
          oldData: { limitType, oldLimit: currentLimit },
          newData: { limitType, newLimit },
        },
      });

      res.json({ message: 'Limit updated successfully', data: updated });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(500).json({ error: err.message || 'Failed to update limit' });
    }
  }
);

// ─── 5. TOGGLE CHILD STATUS ───────────────────────────────

/**
 * PUT /api/admin/children/:childId/status
 * Query: isActive, isBetLocked, isCasinoLocked, isMatkaLocked (booleans)
 */
router.put('/children/:childId/status', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const { childId } = req.params;
    const { isActive, isBetLocked, isCasinoLocked, isMatkaLocked } = req.query as Record<
      string,
      string | undefined
    >;

    const canManageChild = await validateHierarchy(userId, childId);
    if (!canManageChild) {
      return res.status(403).json({ error: 'Not authorized to manage this user' });
    }

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive === 'true';
    if (isBetLocked !== undefined) updateData.isBetLocked = isBetLocked === 'true';
    if (isCasinoLocked !== undefined) updateData.isCasinoLocked = isCasinoLocked === 'true';
    if (isMatkaLocked !== undefined) updateData.isMatkaLocked = isMatkaLocked === 'true';

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No status fields provided' });
    }

    const updated = await prisma.user.update({
      where: { id: childId },
      data: updateData,
      select: {
        id: true,
        username: true,
        isActive: true,
        isBetLocked: true,
        isCasinoLocked: true,
        isMatkaLocked: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_STATUS',
        entity: 'User',
        entityId: childId,
        newData: updateData,
      },
    });

    res.json({ message: 'Status updated successfully', data: updated });
  } catch (err: any) {
    console.error('Update status error:', err);
    res.status(500).json({ error: err.message || 'Failed to update status' });
  }
});

// ─── 6. CHANGE CHILD PASSWORD ──────────────────────────────

/**
 * PUT /api/admin/children/:childId/password
 * Body: { newPassword, transactionPassword }
 */
const changePasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  transactionPassword: z.string().min(1),
});

router.put(
  '/children/:childId/password',
  verifyTransactionPassword(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.user!;
      const { childId } = req.params;
      const { newPassword } = changePasswordSchema.parse(req.body);

      const canManageChild = await validateHierarchy(userId, childId);
      if (!canManageChild) {
        return res.status(403).json({ error: 'Not authorized to manage this user' });
      }

      const hashed = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: childId },
        data: { password: hashed },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CHANGE_CHILD_PASSWORD',
          entity: 'User',
          entityId: childId,
          newData: { passwordChanged: true },
        },
      });

      res.json({ message: 'Password changed successfully' });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(500).json({ error: err.message || 'Failed to change password' });
    }
  }
);

// ─── 7. GET CHILD INFO ─────────────────────────────────────

/**
 * GET /api/admin/children/:childId/info
 */
router.get('/children/:childId/info', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const { childId } = req.params;

    const child = await prisma.user.findUnique({
      where: { id: childId },
      select: {
        id: true,
        username: true,
        name: true,
        mobile: true,
        reference: true,
        role: true,
        balance: true,
        exposure: true,
        creditReference: true,
        exposureLimit: true,
        myPartnership: true,
        myCasinoPartnership: true,
        myMatkaPartnership: true,
        matchCommission: true,
        sessionCommission: true,
        casinoCommission: true,
        matkaCommission: true,
        isActive: true,
        isBetLocked: true,
        isCasinoLocked: true,
        isMatkaLocked: true,
        resetPasswordRequired: true,
        parentId: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { children: true, bets: true, fancyBets: true, transactions: true } },
      },
    });

    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Non-SUPER_ADMIN can only see their own descendants
    if (role !== 'SUPER_ADMIN') {
      const canManageChild = await validateHierarchy(userId, childId);
      if (!canManageChild) {
        return res.status(403).json({ error: 'Not authorized to view this user' });
      }
    }

    // Fetch parent info
    let parentInfo = null;
    if (child.parentId) {
      parentInfo = await prisma.user.findUnique({
        where: { id: child.parentId },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          matchCommission: true,
          sessionCommission: true,
          casinoCommission: true,
          matkaCommission: true,
          myPartnership: true,
          myCasinoPartnership: true,
          myMatkaPartnership: true,
        },
      });
    }

    res.json({ ...child, parent: parentInfo });
  } catch (err: any) {
    console.error('Get child info error:', err);
    res.status(500).json({ error: 'Failed to fetch child info' });
  }
});

// ─── 8. CHILD DASHBOARD ───────────────────────────────────

/**
 * GET /api/admin/children/:childId/dashboard
 */
router.get('/children/:childId/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const { childId } = req.params;

    if (role !== 'SUPER_ADMIN') {
      const canManageChild = await validateHierarchy(userId, childId);
      if (!canManageChild) {
        return res.status(403).json({ error: 'Not authorized to view this user' });
      }
    }

    const child = await prisma.user.findUnique({
      where: { id: childId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        balance: true,
        exposure: true,
        creditReference: true,
        exposureLimit: true,
      },
    });

    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Get bet counts
    const [
      totalBets,
      matchedBets,
      unmatchedBets,
      totalFancyBets,
      totalMatkaBets,
      childrenCount,
      totalDeposits,
      totalWithdrawals,
    ] = await Promise.all([
      prisma.bet.count({ where: { userId: childId } }),
      prisma.bet.count({ where: { userId: childId, betStatus: 'MATCHED' } }),
      prisma.bet.count({ where: { userId: childId, betStatus: 'UNMATCHED' } }),
      prisma.fancyBet.count({ where: { userId: childId } }),
      prisma.matkaBet.count({ where: { userId: childId } }),
      prisma.user.count({ where: { parentId: childId } }),
      prisma.transaction.aggregate({
        where: { userId: childId, type: 'DEPOSIT' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: childId, type: 'WITHDRAW' },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      user: child,
      stats: {
        balance: toNumber(child.balance),
        exposure: toNumber(child.exposure),
        creditReference: toNumber(child.creditReference),
        exposureLimit: toNumber(child.exposureLimit),
        availableBalance: toNumber(
          new Decimal(child.balance.toString()).minus(new Decimal(child.exposure.toString()))
        ),
        totalBets,
        matchedBets,
        unmatchedBets,
        totalFancyBets,
        totalMatkaBets,
        childrenCount,
        totalDeposits: toNumber(totalDeposits._sum.amount || 0),
        totalWithdrawals: toNumber(totalWithdrawals._sum.amount || 0),
      },
    });
  } catch (err: any) {
    console.error('Child dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ─── 9. CHILD COIN HISTORY ─────────────────────────────────

/**
 * GET /api/admin/children/:childId/coin-history
 * Query: startDate, endDate
 */
router.get('/children/:childId/coin-history', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const { childId } = req.params;
    const { startDate, endDate } = req.query as Record<string, string | undefined>;

    if (role !== 'SUPER_ADMIN') {
      const canManageChild = await validateHierarchy(userId, childId);
      if (!canManageChild) {
        return res.status(403).json({ error: 'Not authorized to view this user' });
      }
    }

    const where: any = { userId: childId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: transactions });
  } catch (err: any) {
    console.error('Coin history error:', err);
    res.status(500).json({ error: 'Failed to fetch coin history' });
  }
});

// ─── 10. SIGNUP (CREATE CHILD USER) ────────────────────────

/**
 * POST /api/admin/signup
 * Body: full signup request
 */
const signupSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric'),
  password: z.string().min(6),
  transactionPassword: z.string().min(4).optional(),
  name: z.string().min(1).max(100),
  mobile: z.string().max(20).optional(),
  reference: z.string().max(100).optional(),
  matchCommission: z.number().min(0).max(100).optional(),
  sessionCommission: z.number().min(0).max(100).optional(),
  casinoCommission: z.number().min(0).max(100).optional(),
  matkaCommission: z.number().min(0).max(100).optional(),
  myPartnership: z.number().min(0).max(100).optional(),
  myCasinoPartnership: z.number().min(0).max(100).optional(),
  myMatkaPartnership: z.number().min(0).max(100).optional(),
  creditReference: z.number().min(0).optional(),
  exposureLimit: z.number().min(0).optional(),
});

router.post('/signup', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const data = signupSchema.parse(req.body);

    // Determine child role from parent role
    const childRole = getChildRole(role);
    if (!childRole) {
      return res.status(400).json({ error: 'You cannot create child users' });
    }

    // Check username uniqueness
    const exists = await prisma.user.findUnique({ where: { username: data.username } });
    if (exists) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash passwords
    const hashedPassword = await bcrypt.hash(data.password, 10);
    let hashedTxPassword: string | undefined;
    if (data.transactionPassword) {
      hashedTxPassword = await bcrypt.hash(data.transactionPassword, 10);
    }

    const newUser = await prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        transactionPassword: hashedTxPassword,
        name: data.name,
        mobile: data.mobile,
        reference: data.reference,
        role: childRole,
        parentId: userId,
        matchCommission: data.matchCommission ?? 0,
        sessionCommission: data.sessionCommission ?? 0,
        casinoCommission: data.casinoCommission ?? 0,
        matkaCommission: data.matkaCommission ?? 0,
        myPartnership: data.myPartnership ?? 0,
        myCasinoPartnership: data.myCasinoPartnership ?? 0,
        myMatkaPartnership: data.myMatkaPartnership ?? 0,
        creditReference: data.creditReference ?? 0,
        exposureLimit: data.exposureLimit ?? 0,
      },
      select: {
        id: true,
        username: true,
        name: true,
        mobile: true,
        role: true,
        balance: true,
        creditReference: true,
        exposureLimit: true,
        matchCommission: true,
        sessionCommission: true,
        casinoCommission: true,
        matkaCommission: true,
        myPartnership: true,
        myCasinoPartnership: true,
        myMatkaPartnership: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_CHILD',
        entity: 'User',
        entityId: newUser.id,
        newData: { username: data.username, role: childRole, name: data.name },
      },
    });

    res.status(201).json({ message: 'User created successfully', data: newUser });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message || 'Failed to create user' });
  }
});

// ─── 11. ANNOUNCEMENTS CRUD ────────────────────────────────

/**
 * GET /api/admin/announcements
 */
router.get('/announcements', async (_req: AuthRequest, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ data: announcements });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

/**
 * POST /api/admin/announcement
 */
const announcementSchema = z.object({
  announcement: z.string().min(1),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

router.post('/announcement', async (req: AuthRequest, res: Response) => {
  try {
    const data = announcementSchema.parse(req.body);

    const created = await prisma.announcement.create({
      data: {
        announcement: data.announcement,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
      },
    });

    res.status(201).json({ message: 'Announcement created', data: created });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

/**
 * PUT /api/admin/announcement
 * Body: { id, announcement, isActive, priority }
 */
const updateAnnouncementSchema = z.object({
  id: z.string().min(1),
  announcement: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

router.put('/announcement', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateAnnouncementSchema.parse(req.body);

    const existing = await prisma.announcement.findUnique({ where: { id: data.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const updateData: any = {};
    if (data.announcement !== undefined) updateData.announcement = data.announcement;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.priority !== undefined) updateData.priority = data.priority;

    const updated = await prisma.announcement.update({
      where: { id: data.id },
      data: updateData,
    });

    res.json({ message: 'Announcement updated', data: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

/**
 * DELETE /api/admin/announcement/:announcementId
 */
router.delete('/announcement/:announcementId', async (req: AuthRequest, res: Response) => {
  try {
    const { announcementId } = req.params;

    const existing = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!existing) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    await prisma.announcement.delete({ where: { id: announcementId } });

    res.json({ message: 'Announcement deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// ─── 12. DASHBOARD BANNERS CRUD ────────────────────────────

/**
 * GET /api/admin/dashboard-banner
 */
router.get('/dashboard-banner', async (_req: AuthRequest, res: Response) => {
  try {
    const banners = await prisma.dashboardBanner.findMany({
      orderBy: [{ bannerPriority: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ data: banners });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

/**
 * POST /api/admin/dashboard-banner
 */
const bannerSchema = z.object({
  bannerUrl: z.string().min(1),
  bannerPriority: z.number().int().optional(),
  fromDate: z.string().transform((s) => new Date(s)),
  toDate: z.string().transform((s) => new Date(s)),
  isActive: z.boolean().optional(),
});

router.post('/dashboard-banner', async (req: AuthRequest, res: Response) => {
  try {
    const data = bannerSchema.parse(req.body);

    const created = await prisma.dashboardBanner.create({
      data: {
        bannerUrl: data.bannerUrl,
        bannerPriority: data.bannerPriority ?? 0,
        fromDate: data.fromDate,
        toDate: data.toDate,
        isActive: data.isActive ?? true,
      },
    });

    res.status(201).json({ message: 'Banner created', data: created });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to create banner' });
  }
});

/**
 * PUT /api/admin/dashboard-banner
 * Body: { id, bannerUrl, bannerPriority, fromDate, toDate, isActive }
 */
const updateBannerSchema = z.object({
  id: z.string().min(1),
  bannerUrl: z.string().min(1).optional(),
  bannerPriority: z.number().int().optional(),
  fromDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  toDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  isActive: z.boolean().optional(),
});

router.put('/dashboard-banner', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateBannerSchema.parse(req.body);

    const existing = await prisma.dashboardBanner.findUnique({ where: { id: data.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    const updateData: any = {};
    if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;
    if (data.bannerPriority !== undefined) updateData.bannerPriority = data.bannerPriority;
    if (data.fromDate !== undefined) updateData.fromDate = data.fromDate;
    if (data.toDate !== undefined) updateData.toDate = data.toDate;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.dashboardBanner.update({
      where: { id: data.id },
      data: updateData,
    });

    res.json({ message: 'Banner updated', data: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to update banner' });
  }
});

/**
 * DELETE /api/admin/dashboard-banner/:bannerId
 */
router.delete('/dashboard-banner/:bannerId', async (req: AuthRequest, res: Response) => {
  try {
    const { bannerId } = req.params;

    const existing = await prisma.dashboardBanner.findUnique({ where: { id: bannerId } });
    if (!existing) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    await prisma.dashboardBanner.delete({ where: { id: bannerId } });

    res.json({ message: 'Banner deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete banner' });
  }
});

// ─── 13. BULK ACTIVE / DEACTIVE ────────────────────────────

/**
 * PUT /api/admin/all-active-deactive
 * Query: active (boolean)
 * Body: { ids: string[] }
 */
const bulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one ID is required'),
});

router.put('/all-active-deactive', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const { active } = req.query as Record<string, string | undefined>;
    const { ids } = bulkStatusSchema.parse(req.body);

    if (active === undefined) {
      return res.status(400).json({ error: 'Query param "active" is required' });
    }

    const isActive = active === 'true';

    // For non-SUPER_ADMIN, verify all targets are direct children
    if (role !== 'SUPER_ADMIN') {
      const children = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, parentId: true },
      });

      const unauthorized = children.filter((c) => c.parentId !== userId);
      if (unauthorized.length > 0) {
        return res.status(403).json({
          error: 'Not authorized to manage some of these users',
          unauthorizedIds: unauthorized.map((u) => u.id),
        });
      }
    }

    const result = await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { isActive },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: isActive ? 'BULK_ACTIVATE' : 'BULK_DEACTIVATE',
        entity: 'User',
        newData: { ids, isActive },
      },
    });

    res.json({
      message: `${result.count} user(s) ${isActive ? 'activated' : 'deactivated'} successfully`,
      count: result.count,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to update user statuses' });
  }
});

// ─── 14. GET SUGGESTED USERNAME ─────────────────────────────

/**
 * GET /api/admin/username
 * Query: userType (Role)
 */
router.get('/username', async (req: AuthRequest, res: Response) => {
  try {
    const { userType } = req.query as Record<string, string | undefined>;

    if (!userType) {
      return res.status(400).json({ error: 'Query param "userType" is required' });
    }

    // Validate userType is a valid Role
    const validRoles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'CLIENT'];
    if (!validRoles.includes(userType as Role)) {
      return res.status(400).json({ error: 'Invalid userType' });
    }

    const suggestedUsername = await generateUsername(userType as Role);

    res.json({ username: suggestedUsername });
  } catch (err: any) {
    console.error('Generate username error:', err);
    res.status(500).json({ error: 'Failed to generate username' });
  }
});

// ─── 15. LIST USERS BY TYPE ────────────────────────────────

/**
 * GET /api/admin/:userType/users
 * Params: userType (Role)
 */
router.get('/:userType/users', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const { userType } = req.params;

    // Validate userType is a valid Role
    const validRoles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'CLIENT'];
    if (!validRoles.includes(userType as Role)) {
      return res.status(400).json({ error: 'Invalid userType' });
    }

    const where: any = { role: userType as Role };

    // Non-SUPER_ADMIN can only see their descendants
    if (role !== 'SUPER_ADMIN') {
      where.parentId = userId;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        mobile: true,
        role: true,
        balance: true,
        exposure: true,
        creditReference: true,
        exposureLimit: true,
        matchCommission: true,
        sessionCommission: true,
        casinoCommission: true,
        matkaCommission: true,
        myPartnership: true,
        myCasinoPartnership: true,
        myMatkaPartnership: true,
        isActive: true,
        isBetLocked: true,
        isCasinoLocked: true,
        isMatkaLocked: true,
        parentId: true,
        lastLogin: true,
        createdAt: true,
        _count: { select: { children: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: users, total: users.length });
  } catch (err: any) {
    console.error('List users by type error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
