import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── VALIDATION SCHEMAS ───────────────────────────────────

const createSchema = z.object({
  accountName: z.string().min(2).max(100),
  accountNumber: z.string().min(5).max(30),
  ifscCode: z.string().min(4).max(20),
  bankName: z.string().min(2).max(100),
  upiId: z.string().max(100).optional(),
  isDefault: z.boolean().optional(),
});

const updateSchema = z.object({
  accountName: z.string().min(2).max(100).optional(),
  accountNumber: z.string().min(5).max(30).optional(),
  ifscCode: z.string().min(4).max(20).optional(),
  bankName: z.string().min(2).max(100).optional(),
  upiId: z.string().max(100).optional().nullable(),
});

// ─── CREATE BANK ACCOUNT ─────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createSchema.parse(req.body);
    const userId = req.user!.userId;

    // If this is set as default, unset others
    if (data.isDefault) {
      await prisma.bankAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // If first account, auto-set as default
    const count = await prisma.bankAccount.count({ where: { userId } });
    const isDefault = data.isDefault || count === 0;

    const account = await prisma.bankAccount.create({
      data: {
        userId,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode,
        bankName: data.bankName,
        upiId: data.upiId,
        isDefault,
      },
    });

    res.status(201).json({ message: 'Bank account added', data: account });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(500).json({ error: err.message || 'Failed to add bank account' });
  }
});

// ─── LIST BANK ACCOUNTS ──────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { userId: req.user!.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ data: accounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch bank accounts' });
  }
});

// ─── UPDATE BANK ACCOUNT ─────────────────────────────────

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateSchema.parse(req.body);

    const existing = await prisma.bankAccount.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const account = await prisma.bankAccount.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ message: 'Bank account updated', data: account });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(500).json({ error: err.message || 'Failed to update bank account' });
  }
});

// ─── DELETE BANK ACCOUNT ─────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.bankAccount.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Check if used in any pending deposit requests
    const pendingRequests = await prisma.depositRequest.count({
      where: { bankAccountId: req.params.id, status: 'PENDING' },
    });
    if (pendingRequests > 0) {
      return res.status(400).json({ error: 'Cannot delete bank account with pending requests' });
    }

    await prisma.bankAccount.delete({ where: { id: req.params.id } });

    // If deleted was default, set another as default
    if (existing.isDefault) {
      const nextDefault = await prisma.bankAccount.findFirst({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
      });
      if (nextDefault) {
        await prisma.bankAccount.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ message: 'Bank account deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete bank account' });
  }
});

// ─── SET DEFAULT ─────────────────────────────────────────

router.put('/:id/default', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.bankAccount.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Unset all defaults, then set this one
    await prisma.bankAccount.updateMany({
      where: { userId: req.user!.userId, isDefault: true },
      data: { isDefault: false },
    });

    const account = await prisma.bankAccount.update({
      where: { id: req.params.id },
      data: { isDefault: true },
    });

    res.json({ message: 'Default bank account updated', data: account });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to set default bank account' });
  }
});

export default router;
