import { Router, Response } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { RequestType, PaymentMethod } from '@prisma/client';
import fs from 'fs';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { secureUpload, validateUploadedFile, handleUploadError } from '../utils/upload';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── HELPERS ──────────────────────────────────────────────

function toNumber(val: Decimal | number | string): number {
  return parseFloat(val.toString());
}

// ─── VALIDATION SCHEMAS ───────────────────────────────────

const submitRequestSchema = z.object({
  type: z.nativeEnum(RequestType),
  paymentMethod: z.nativeEnum(PaymentMethod),
  amount: z.coerce.number().positive(),
  utrReference: z.string().optional(),
  bankAccountId: z.string().optional(),
  cryptoWalletId: z.string().optional(),
});

const processSchema = z.object({
  adminRemarks: z.string().optional(),
});

// ─── CLIENT: SUBMIT REQUEST ──────────────────────────────

router.post(
  '/',
  secureUpload.single('screenshot'),
  validateUploadedFile('screenshot'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = submitRequestSchema.parse(req.body);
      const userId = req.user!.userId;

      // Screenshot is compulsory for all requests
      if (!req.file) {
        return res.status(400).json({ error: 'Payment screenshot is required' });
      }

      // For withdrawals, verify sufficient balance
      if (data.type === 'WITHDRAW') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        });
        if (!user || toNumber(user.balance) < data.amount) {
          // Clean up uploaded file on validation failure
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Require bank account for withdrawal
        if (!data.bankAccountId) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: 'Bank account required for withdrawal' });
        }

        // Verify bank account belongs to user
        const bankAccount = await prisma.bankAccount.findFirst({
          where: { id: data.bankAccountId, userId },
        });
        if (!bankAccount) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: 'Invalid bank account' });
        }
      }

      // For crypto deposits, verify wallet exists
      if (data.paymentMethod === 'CRYPTO' && data.cryptoWalletId) {
        const wallet = await prisma.cryptoWallet.findFirst({
          where: { id: data.cryptoWalletId, isActive: true },
        });
        if (!wallet) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: 'Invalid crypto wallet' });
        }
      }

      const screenshotUrl = `/uploads/${req.file.filename}`;

      const request = await prisma.depositRequest.create({
        data: {
          userId,
          type: data.type,
          paymentMethod: data.paymentMethod,
          amount: data.amount,
          utrReference: data.utrReference,
          screenshotUrl,
          bankAccountId: data.bankAccountId,
          cryptoWalletId: data.cryptoWalletId,
        },
        include: {
          user: { select: { id: true, username: true, name: true } },
          bankAccount: true,
          cryptoWallet: true,
        },
      });

      // Notify admins via socket
      const io = req.app.get('io');
      if (io) {
        io.to('role:SUPER_ADMIN').to('role:ADMIN').to('role:AGENT').emit('deposit-request:new', request);
      }

      res.status(201).json({ message: 'Request submitted successfully', data: request });
    } catch (err: any) {
      // Clean up uploaded file on any error
      if (req.file) fs.unlink(req.file.path, () => {});
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(500).json({ error: err.message || 'Failed to submit request' });
    }
  }
);

// Handle multer errors (file too large, wrong type)
router.use(handleUploadError);

// ─── CLIENT: MY REQUESTS ─────────────────────────────────

router.get('/my-requests', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const size = Math.min(50, Math.max(1, parseInt(req.query.size as string) || 20));
    const type = req.query.type as string;
    const status = req.query.status as string;

    const where: any = { userId: req.user!.userId };
    if (type && Object.values(RequestType).includes(type as RequestType)) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }

    const [total, requests] = await Promise.all([
      prisma.depositRequest.count({ where }),
      prisma.depositRequest.findMany({
        where,
        include: {
          bankAccount: true,
          cryptoWallet: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);

    res.json({
      data: requests,
      pagination: { page, size, total, totalPages: Math.ceil(total / size) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch requests' });
  }
});

// ─── ADMIN: LIST PENDING/ALL REQUESTS ────────────────────

router.get(
  '/pending',
  authorize('SUPER_ADMIN', 'ADMIN', 'AGENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const size = Math.min(50, Math.max(1, parseInt(req.query.size as string) || 20));
      const type = req.query.type as string;
      const status = req.query.status as string;

      const where: any = {};
      if (type && Object.values(RequestType).includes(type as RequestType)) {
        where.type = type;
      }
      if (status) {
        where.status = status;
      } else {
        where.status = 'PENDING';
      }

      // Agents only see their own clients' requests
      if (req.user!.role === 'AGENT') {
        where.user = { parentId: req.user!.userId };
      }

      const [total, requests] = await Promise.all([
        prisma.depositRequest.count({ where }),
        prisma.depositRequest.findMany({
          where,
          include: {
            user: { select: { id: true, username: true, name: true, role: true } },
            bankAccount: true,
            cryptoWallet: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * size,
          take: size,
        }),
      ]);

      res.json({
        data: requests,
        pagination: { page, size, total, totalPages: Math.ceil(total / size) },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch requests' });
    }
  }
);

// ─── REQUEST DETAIL ──────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.depositRequest.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, username: true, name: true, role: true } },
        bankAccount: true,
        cryptoWallet: true,
      },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Only owner or admin/agent can view
    const isOwner = request.userId === req.user!.userId;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'AGENT'].includes(req.user!.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ data: request });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch request' });
  }
});

// ─── ADMIN: APPROVE REQUEST ─────────────────────────────

router.put(
  '/:id/approve',
  authorize('SUPER_ADMIN', 'ADMIN', 'AGENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { adminRemarks } = processSchema.parse(req.body);

      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.depositRequest.findUnique({
          where: { id: req.params.id },
          include: { user: { select: { id: true, balance: true } } },
        });

        if (!request) throw new Error('Request not found');
        if (request.status !== 'PENDING') throw new Error('Request already processed');

        const amount = new Decimal(request.amount.toString());

        if (request.type === 'WITHDRAW') {
          // Verify sufficient balance for withdrawal
          const userBalance = new Decimal(request.user.balance.toString());
          if (userBalance.lt(amount)) {
            throw new Error('User has insufficient balance for this withdrawal');
          }
        }

        // Update user balance
        const balanceChange = request.type === 'DEPOSIT' ? amount.toNumber() : -amount.toNumber();
        const updatedUser = await tx.user.update({
          where: { id: request.userId },
          data: { balance: { increment: balanceChange } },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            userId: request.userId,
            type: request.type === 'DEPOSIT' ? 'DEPOSIT' : 'WITHDRAW',
            amount: amount.toNumber(),
            balance: toNumber(updatedUser.balance),
            reference: request.id,
            remarks: `${request.type} via ${request.paymentMethod}${request.utrReference ? ` (Ref: ${request.utrReference})` : ''}`,
            createdBy: req.user!.userId,
          },
        });

        // Update request status
        const updated = await tx.depositRequest.update({
          where: { id: req.params.id },
          data: {
            status: 'APPROVED',
            adminRemarks,
            processedBy: req.user!.userId,
            processedAt: new Date(),
          },
          include: {
            user: { select: { id: true, username: true, name: true } },
            bankAccount: true,
            cryptoWallet: true,
          },
        });

        return { request: updated, newBalance: toNumber(updatedUser.balance) };
      });

      // Socket emit
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${result.request.userId}`).emit('balance:updated', {
          balance: result.newBalance,
        });
        io.to(`user:${result.request.userId}`).emit('deposit-request:updated', result.request);
      }

      res.json({ message: 'Request approved', data: result.request });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(400).json({ error: err.message || 'Failed to approve request' });
    }
  }
);

// ─── ADMIN: REJECT REQUEST ──────────────────────────────

router.put(
  '/:id/reject',
  authorize('SUPER_ADMIN', 'ADMIN', 'AGENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { adminRemarks } = processSchema.parse(req.body);

      const request = await prisma.depositRequest.findUnique({
        where: { id: req.params.id },
      });

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }
      if (request.status !== 'PENDING') {
        return res.status(400).json({ error: 'Request already processed' });
      }

      const updated = await prisma.depositRequest.update({
        where: { id: req.params.id },
        data: {
          status: 'REJECTED',
          adminRemarks,
          processedBy: req.user!.userId,
          processedAt: new Date(),
        },
        include: {
          user: { select: { id: true, username: true, name: true } },
          bankAccount: true,
          cryptoWallet: true,
        },
      });

      // Socket emit
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${updated.userId}`).emit('deposit-request:updated', updated);
      }

      res.json({ message: 'Request rejected', data: updated });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(500).json({ error: err.message || 'Failed to reject request' });
    }
  }
);

export default router;
