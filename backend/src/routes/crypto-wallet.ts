import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { secureUpload, validateUploadedFile, handleUploadError } from '../utils/upload';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── VALIDATION SCHEMAS ───────────────────────────────────

const createSchema = z.object({
  network: z.string().min(1).max(50),
  currency: z.string().min(1).max(20),
  address: z.string().min(10).max(200),
});

const updateSchema = z.object({
  network: z.string().min(1).max(50).optional(),
  currency: z.string().min(1).max(20).optional(),
  address: z.string().min(10).max(200).optional(),
  isActive: z.boolean().optional(),
});

// ─── ADMIN: CREATE CRYPTO WALLET ─────────────────────────

router.post(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN'),
  secureUpload.single('qrCode'),
  validateUploadedFile('qrCode'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createSchema.parse(req.body);
      const qrCodeUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

      const wallet = await prisma.cryptoWallet.create({
        data: {
          network: data.network,
          currency: data.currency,
          address: data.address,
          qrCodeUrl,
          createdBy: req.user!.userId,
        },
      });

      res.status(201).json({ message: 'Crypto wallet added', data: wallet });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(500).json({ error: err.message || 'Failed to add crypto wallet' });
    }
  }
);

// ─── LIST WALLETS (all auth'd users see active wallets) ──

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role);
    const where = isAdmin ? {} : { isActive: true };

    const wallets = await prisma.cryptoWallet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: wallets });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch wallets' });
  }
});

// ─── ADMIN: UPDATE WALLET ────────────────────────────────

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  secureUpload.single('qrCode'),
  validateUploadedFile('qrCode'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updateSchema.parse(req.body);

      const existing = await prisma.cryptoWallet.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const qrCodeUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

      const wallet = await prisma.cryptoWallet.update({
        where: { id: req.params.id },
        data: {
          ...data,
          ...(qrCodeUrl && { qrCodeUrl }),
        },
      });

      res.json({ message: 'Wallet updated', data: wallet });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      res.status(500).json({ error: err.message || 'Failed to update wallet' });
    }
  }
);

// ─── ADMIN: DEACTIVATE WALLET ────────────────────────────

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await prisma.cryptoWallet.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      await prisma.cryptoWallet.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      res.json({ message: 'Wallet deactivated' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to deactivate wallet' });
    }
  }
);

// Handle multer errors (file too large, wrong type)
router.use(handleUploadError);

export default router;
