import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;

export function initTicketWebSocket(server: HttpServer) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const rawUrl = request.url || '';
    const pathname = rawUrl.split('?')[0];

    if (pathname.includes('/ws/tickets') || pathname.endsWith('/ws')) {
      wss?.handleUpgrade(request, socket, head, (ws) => {
        wss?.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log(`🔌 [TicketWebSocket] Yeni WebSocket istemcisi bağlandı. (Toplam bağlı: ${wss?.clients.size})`);

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 25000);

    ws.on('close', () => {
      clearInterval(pingInterval);
      console.log(`🔌 [TicketWebSocket] İstemci ayrıldı. (Kalan bağlı: ${wss?.clients.size})`);
    });
  });
}

export function broadcastTicketEvent(event: 'TICKET_CREATED' | 'TICKET_UPDATED', payload: any) {
  if (!wss) return;
  const message = JSON.stringify({ type: event, data: payload, timestamp: new Date().toISOString() });
  console.log(`📢 [TicketWebSocket] Yayınlanıyor: ${event} -> ${wss.clients.size} istemciye gönderildi.`);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
