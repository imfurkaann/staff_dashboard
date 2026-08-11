import { appConfig } from '../config/appConfig';

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

export interface SupportTicket {
  id: string;
  ticketNo: string;
  employeeId?: string | null;
  creatorName: string;
  roomNumber?: string | null;
  blockName?: string | null;
  category: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  adminNote?: string | null;
  resolvedAt?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    registrationNo?: string | null;
    department?: string | null;
  } | null;
  createdBy?: {
    id: string;
    fullName: string;
    role: string;
  } | null;
}

export interface SupportTicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  rejected: number;
}

export const ticketApi = {
  async getTickets(filters?: {
    status?: string;
    category?: string;
    search?: string;
  }): Promise<{ tickets: SupportTicket[]; stats: SupportTicketStats }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${appConfig.apiBaseUrl}/tickets${query}`, { credentials: 'include' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Talepler alınamadı.');
    return json.data;
  },

  async getMyTickets(): Promise<SupportTicket[]> {
    const res = await fetch(`${appConfig.apiBaseUrl}/tickets/my-tickets`, { credentials: 'include' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Talepleriniz alınamadı.');
    return json.data || [];
  },

  async createTicket(payload: {
    employeeId?: string;
    creatorName?: string;
    roomNumber?: string;
    blockName?: string;
    category: string;
    subject: string;
    description: string;
  }): Promise<SupportTicket> {
    const res = await fetch(`${appConfig.apiBaseUrl}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Talep oluşturulamadı.');
    return json.data;
  },

  async updateTicketStatus(
    id: string,
    payload: { status: SupportTicketStatus; adminNote?: string }
  ): Promise<SupportTicket> {
    const res = await fetch(`${appConfig.apiBaseUrl}/tickets/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Talep durumu güncellenemedi.');
    return json.data;
  },
};

export function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playNote = (freq: number, delay: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

      gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    };

    // Pleasant metallic bell chime: High C (1046.5Hz) -> G (1567.98Hz)
    playNote(1046.5, 0, 0.35);
    playNote(1567.98, 0.12, 0.5);
  } catch (e) {
    // Ignore audio context restrictions if any
  }
}

export function connectTicketSocket(onEvent: (event: { type: 'TICKET_CREATED' | 'TICKET_UPDATED'; data: SupportTicket }) => void): () => void {
  let wsUrl = '';
  const apiBase = appConfig.apiBaseUrl;

  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    wsUrl = apiBase.replace(/^http/, 'ws').replace(/\/api\/?$/, '') + '/ws/tickets';
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}/ws/tickets`;
  }

  let ws: WebSocket | null = null;
  let reconnectTimer: any = null;
  let isUnmounted = false;

  function connect() {
    if (isUnmounted) return;
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (import.meta.env.DEV) console.log('⚡ [TicketWebSocket] Bağlantı başarılı:', wsUrl);
      };

      ws.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && (parsed.type === 'TICKET_CREATED' || parsed.type === 'TICKET_UPDATED')) {
            onEvent(parsed);
          }
        } catch (err) {
          // ignore parsing error
        }
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch (err) {
      if (!isUnmounted) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }
  }

  connect();

  return () => {
    isUnmounted = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  };
}
