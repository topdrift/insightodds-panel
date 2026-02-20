import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { Role } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: Role;
    name: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      name: decoded.name,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Middleware to verify transaction password for sensitive operations
 */
export function verifyTransactionPassword() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { transactionPassword } = req.body;
    if (!transactionPassword) {
      return res.status(400).json({ error: 'Transaction password required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { transactionPassword: true },
    });

    if (!user?.transactionPassword) {
      return res.status(400).json({ error: 'Transaction password not set' });
    }

    const valid = await bcrypt.compare(transactionPassword, user.transactionPassword);
    if (!valid) {
      return res.status(403).json({ error: 'Invalid transaction password' });
    }

    next();
  };
}
