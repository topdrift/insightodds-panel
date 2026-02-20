import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export function setupSocketIO(io: SocketServer) {
  // Auth middleware for socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      (socket as any).userId = decoded.userId;
      (socket as any).role = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    const role = (socket as any).role;

    // Join personal room
    socket.join(`user:${userId}`);

    // Join role-based room
    socket.join(`role:${role}`);

    console.log(`Socket connected: ${userId} (${role})`);

    // Join match room for live odds/score updates
    socket.on('match:join', (cricketId: string | number) => {
      socket.join(`match:${cricketId}`);
    });

    socket.on('match:leave', (cricketId: string | number) => {
      socket.leave(`match:${cricketId}`);
    });

    // Casino room handlers
    socket.on('casino:join', (game: string) => {
      socket.join(`casino:${game}`);
    });

    socket.on('casino:leave', (game: string) => {
      socket.leave(`casino:${game}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${userId}`);
    });
  });
}

// ─── EMIT HELPERS ───────────────────────────────────────────

export function emitToUser(io: SocketServer, userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToRole(io: SocketServer, role: string, event: string, data: any) {
  io.to(`role:${role}`).emit(event, data);
}

export function emitToMatch(io: SocketServer, cricketId: string | number, event: string, data: any) {
  io.to(`match:${cricketId}`).emit(event, data);
}

// ─── CHANNEL EVENTS ─────────────────────────────────────────
// odds:match:{eventId}       — 3-deep match odds
// odds:bookmaker:{eventId}   — bookmaker updates
// odds:fancy:{eventId}       — fancy market updates
// score:{eventId}            — live score
// balance:{userId}           — balance changes
// bet:update:{userId}        — bet status changes
// announcement:new           — broadcast new announcement
// match:status:{eventId}     — lock/enable changes
// matches:updated            — dashboard match list update
