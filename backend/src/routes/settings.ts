import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/settings/whitelabel - public endpoint for theme
router.get('/whitelabel', async (_req, res) => {
  try {
    let config = await prisma.whitelabelConfig.findFirst();
    if (!config) {
      config = await prisma.whitelabelConfig.create({ data: {} });
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// PUT /api/settings/whitelabel - update whitelabel config (admin)
router.put('/whitelabel', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      siteName: z.string().optional(),
      logoUrl: z.string().nullable().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      bgColor: z.string().optional(),
      cardColor: z.string().optional(),
      textColor: z.string().optional(),
      features: z.any().optional(),
    });
    const data = schema.parse(req.body);

    let config = await prisma.whitelabelConfig.findFirst();
    if (!config) {
      config = await prisma.whitelabelConfig.create({ data });
    } else {
      config = await prisma.whitelabelConfig.update({
        where: { id: config.id },
        data,
      });
    }

    // Notify all clients of theme change
    const io = req.app.get('io');
    if (io) {
      io.emit('whitelabel:updated', config);
    }

    res.json(config);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// GET /api/settings/system
router.get('/system', authenticate, authorize('ADMIN'), async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.systemSettings.findMany();
    const result: Record<string, any> = {};
    settings.forEach((s) => {
      result[s.key] = s.value;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings/system/:key
router.put('/system/:key', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { value } = req.body;
    const setting = await prisma.systemSettings.upsert({
      where: { key: req.params.key },
      update: { value },
      create: { key: req.params.key, value },
    });
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// GET /api/settings/audit-logs
router.get('/audit-logs', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '50', action, userId } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { username: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
