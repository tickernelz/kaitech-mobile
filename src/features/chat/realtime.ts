import type { ChatClient } from './api';

export type Notification = { id: number; type: string; payload: unknown };
export type RealtimeState = 'connecting' | 'open' | 'closed';

const sessionExpired = 4001;
const maxDelayMs = 30000;

type SocketWithHeaders = new (url: string, protocols: string[] | null, options: { headers: Record<string, string> }) => WebSocket;

export function notificationsFrom(raw: string): Notification[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Notification[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const { id, message } = item as { id?: unknown; message?: unknown };
    if (typeof id !== 'number' || !message || typeof message !== 'object') continue;
    const { type, payload } = message as { type?: unknown; payload?: unknown };
    if (typeof type === 'string') out.push({ id, type, payload });
  }
  return out;
}

export class Realtime {
  private socket: WebSocket | null = null;
  private last = 0;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private generation = 0;

  constructor(
    private readonly client: ChatClient,
    private readonly onNotifications: (notifications: Notification[]) => void,
    private readonly onState: (state: RealtimeState, reconnected: boolean) => void,
  ) {}

  start() {
    if (this.running) return;
    this.running = true;
    void this.connect(false);
  }

  stop() {
    this.running = false;
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000);
    this.onState('closed', false);
  }

  reconnectNow() {
    if (!this.running || this.socket) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.attempts = 0;
    void this.connect(false);
  }

  private schedule(forceSession: boolean) {
    if (!this.running || this.timer) return;
    const delay = Math.min(maxDelayMs, 1000 * 2 ** this.attempts) * (0.75 + Math.random() * 0.5);
    this.attempts += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect(forceSession);
    }, delay);
  }

  private async connect(forceSession: boolean) {
    const generation = ++this.generation;
    this.onState('connecting', false);
    let cookie: string;
    try {
      cookie = await this.client.cookie(forceSession);
    } catch {
      if (generation === this.generation) this.schedule(false);
      return;
    }
    if (generation !== this.generation || !this.running) return;
    const Socket = WebSocket as unknown as SocketWithHeaders;
    const socket = new Socket(this.client.websocketUrl(), null, {
      headers: { Cookie: cookie, 'User-Agent': 'KaitechMobile' },
    });
    this.socket = socket;
    const reconnected = this.last > 0;
    socket.onopen = () => {
      if (generation !== this.generation) return;
      this.attempts = 0;
      socket.send(JSON.stringify({ event_name: 'subscribe', data: { channels: [], last: this.last } }));
      this.onState('open', reconnected);
    };
    socket.onmessage = (event) => {
      if (generation !== this.generation || typeof event.data !== 'string') return;
      const notifications = notificationsFrom(event.data);
      if (!notifications.length) return;
      this.last = Math.max(this.last, ...notifications.map((notification) => notification.id));
      this.onNotifications(notifications);
    };
    socket.onclose = (event) => {
      if (generation !== this.generation) return;
      this.socket = null;
      this.onState('closed', false);
      this.schedule(event.code === sessionExpired);
    };
    socket.onerror = () => undefined;
  }
}
