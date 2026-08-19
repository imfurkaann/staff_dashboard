import { Server as HttpServer, IncomingMessage } from 'http';
import { Duplex } from 'stream';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import prisma from '../db/prisma';
import { config } from '../config';
import { AuthService } from '../services/authService';

type SharedAssetEvent = 'SHARED_ASSET_UPDATED' | 'SHARED_ASSET_CHECKOUT' | 'SHARED_ASSET_CHECKIN';
type SharedAssetPayload = { assetId?: string; status?: string; borrowerName?: string } & Record<string, unknown>;
type SharedAssetSocket = WebSocket & { userId: string; employeeId?: string; isAlive: boolean };

let wss: WebSocketServer | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return cookies;
    const key = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    try { cookies[key] = decodeURIComponent(rawValue); } catch { cookies[key] = rawValue; }
    return cookies;
  }, {});
}

export function isAllowedSharedAssetSocketOrigin(origin: string | undefined): boolean {
  if (!origin) return config.nodeEnv !== 'production';
  if (config.cors.allowedOrigins.includes(origin)) return true;
  return config.nodeEnv === 'development' && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/.test(origin);
}

async function authenticateUpgrade(request: IncomingMessage) {
  const token = parseCookies(request.headers.cookie)[config.cookie.name];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { id?: string; pwd?: string };
    if (!decoded.id || !decoded.pwd) return null;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, role: true, isActive: true, mustChangePassword: true, passwordHash: true,
        employee: { select: { id: true } },
      },
    });
    if (!user?.isActive || user.mustChangePassword || decoded.pwd !== AuthService.passwordVersion(user.passwordHash)) return null;
    return {
      userId: user.id,
      employeeId: user.employee?.id,
    };
  } catch {
    return null;
  }
}

function rejectUpgrade(socket: Duplex, status: 401 | 403 | 404) {
  const reason = status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Not Found';
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

export function initSharedAssetWebSocket(server: HttpServer) {
  wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });

  server.on('upgrade', async (request, socket, head) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    if (pathname !== '/ws/shared-assets') return;
    if (!isAllowedSharedAssetSocketOrigin(request.headers.origin)) return rejectUpgrade(socket, 403);

    const identity = await authenticateUpgrade(request);
    if (!identity || socket.destroyed) return rejectUpgrade(socket, 401);

    wss?.handleUpgrade(request, socket, head, (webSocket) => {
      const assetSocket = webSocket as SharedAssetSocket;
      Object.assign(assetSocket, identity, { isAlive: true });
      wss?.emit('connection', assetSocket, request);
    });
  });

  wss.on('connection', (ws: SharedAssetSocket) => {
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('error', () => { ws.terminate(); });
  });

  heartbeatInterval = setInterval(() => {
    wss?.clients.forEach((client) => {
      const ws = client as SharedAssetSocket;
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);
  heartbeatInterval.unref();

  server.on('close', () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    wss?.close();
    wss = null;
  });
}

export function broadcastSharedAssetEvent(event: SharedAssetEvent, payload: SharedAssetPayload = {}) {
  if (!wss) return;
  const message = JSON.stringify({ type: event, data: payload, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    const ws = client as SharedAssetSocket;
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  });
}
