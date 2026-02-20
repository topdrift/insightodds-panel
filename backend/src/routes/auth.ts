import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { shakti11Scraper } from '../services/shakti11-scraper';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  otp: z.string().optional(),
});

function generateTokens(user: { id: string; username: string; role: string; name: string }) {
  const accessToken = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, name: user.name },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any }
  );
  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any }
  );
  return { accessToken, refreshToken };
}

// POST /api/auth/login (signin)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Subdomain role validation
    const subdomain = (req.headers['x-subdomain'] as string) || req.body.subdomain || 'client';
    const subdomainRoleMap: Record<string, string[]> = {
      admin: ['SUPER_ADMIN', 'ADMIN'],
      agent: ['AGENT'],
      client: ['CLIENT'],
    };
    const allowedRoles = subdomainRoleMap[subdomain];
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: 'Access denied. Use the correct portal for your role.',
      });
    }

    const tokens = generateTokens(user);

    // Update last login + log activity
    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      }),
      prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: 'LOGIN',
          ip: req.ip || req.headers['x-forwarded-for']?.toString(),
          userAgent: req.headers['user-agent'],
        },
      }),
    ]);

    res.json({
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        balance: user.balance,
        exposure: user.exposure,
        creditReference: user.creditReference,
        exposureLimit: user.exposureLimit,
        myPartnership: user.myPartnership,
        myCasinoPartnership: user.myCasinoPartnership,
        myMatkaPartnership: user.myMatkaPartnership,
        matchCommission: user.matchCommission,
        sessionCommission: user.sessionCommission,
        casinoCommission: user.casinoCommission,
        matkaCommission: user.matkaCommission,
        isBetLocked: user.isBetLocked,
        isCasinoLocked: user.isCasinoLocked,
        isMatkaLocked: user.isMatkaLocked,
        resetPasswordRequired: user.resetPasswordRequired,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user);
    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
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
        isBetLocked: true,
        isCasinoLocked: true,
        isMatkaLocked: true,
        isActive: true,
        resetPasswordRequired: true,
        parentId: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      password: z.string().min(1),
      newPassword: z.string().min(6),
      resetRequired: z.boolean().optional(),
    });
    const { password, newPassword, resetRequired } = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetPasswordRequired: resetRequired ?? false,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        activityType: 'CHANGE_PASSWORD',
        ip: req.ip || req.headers['x-forwarded-for']?.toString(),
      },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// GET /api/auth/valid/username/:username — check username availability
router.get('/valid/username/:username', async (req, res) => {
  try {
    const existing = await prisma.user.findUnique({ where: { username: req.params.username } });
    res.json({ available: !existing });
  } catch {
    res.status(500).json({ error: 'Failed to check username' });
  }
});

// GET /api/auth/announcements — public announcements (plural alias)
router.get('/announcements', async (_req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });
    res.json(announcements);
  } catch {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// GET /api/auth/announcement — public announcements
router.get('/announcement', async (_req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });
    res.json(announcements);
  } catch {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// GET /api/auth/dashboard-banner — public banners
router.get('/dashboard-banner', async (_req, res) => {
  try {
    const now = new Date();
    const banners = await prisma.dashboardBanner.findMany({
      where: {
        isActive: true,
        fromDate: { lte: now },
        toDate: { gte: now },
      },
      orderBy: { bannerPriority: 'desc' },
    });
    res.json(banners);
  } catch {
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

// POST /api/auth/score-sport2 — proxy score endpoint
router.post('/score-sport2', async (req, res) => {
  try {
    const eventId = req.query.eventId as string;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    const score = await shakti11Scraper.fetchScore(eventId);
    res.json({ status: 'success', code: 200, response: { data: { score } } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch score' });
  }
});

// GET /api/auth/streaming/:eventId — proxy streaming
router.get('/streaming/:eventId', async (req, res) => {
  try {
    const data = await shakti11Scraper.getStreamingUrl(req.params.eventId);
    res.json({ status: 'success', code: 200, response: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch streaming' });
  }
});

// GET /api/auth/upcoming-fixture
router.get('/upcoming-fixture', async (_req, res) => {
  try {
    const events = await prisma.cricketEvent.findMany({
      where: { isActive: true, isSettled: false, inPlay: false },
      orderBy: { startTime: 'asc' },
      take: 20,
    });
    res.json(events);
  } catch {
    res.status(500).json({ error: 'Failed to fetch fixtures' });
  }
});

export default router;
