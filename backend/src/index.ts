import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';

// Try both locations for .env
dotenv.config({ path: '.env' });
dotenv.config({ path: '../.env' });

import { prisma } from './utils/prisma';
import { redis } from './utils/redis';
import { setupSocketIO } from './utils/socket';
import { startOddsPoller, stopOddsPoller } from './services/odds-poller';
import { automationEngine } from './services/automation';

// Routes
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import adminReportRoutes from './routes/admin-reports';
import cricketRoutes from './routes/cricket';
import betRoutes from './routes/bet';
import userRoutes from './routes/user';
import matkaRoutes from './routes/matka';
import settingsRoutes from './routes/settings';
import notificationRoutes from './routes/notifications';
import automationRoutes from './routes/automation';
import casinoRoutes from './routes/casino';
import { aviatorEngine } from './services/casino/aviator';
import { initBlackjack } from './services/casino/blackjack';

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());

const io = new SocketServer(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminReportRoutes);
app.use('/api/cricket', cricketRoutes);
app.use('/api/bet', betRoutes);
app.use('/api/user', userRoutes);
app.use('/api/matka', matkaRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/casino', casinoRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io setup
setupSocketIO(io);

// Start odds poller
startOddsPoller(io);

// Initialize automation engine
automationEngine.initialize().catch((err) => {
  console.error('Failed to initialize automation engine:', err.message);
});

// Initialize casino engines
aviatorEngine.initialize(io).catch((err) => {
  console.error('Failed to initialize Aviator engine:', err.message);
});
initBlackjack().catch((err) => {
  console.error('Failed to initialize Blackjack engine:', err.message);
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Catch unhandled errors to prevent PM2 restarts
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  aviatorEngine.shutdown();
  stopOddsPoller();
  await prisma.$disconnect();
  redis.disconnect();
  server.close();
  process.exit(0);
});

export { io };
