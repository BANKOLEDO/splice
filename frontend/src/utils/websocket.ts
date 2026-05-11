import { BASE_URL } from './api';

type MessageHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private userId: string = '';
  private token: string = '';
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnected: boolean = false;

  connect(userId: string, token: string) {
    this.userId = userId;
    this.token = token;
    this.doConnect();
  }

  private doConnect() {
    const wsUrl = BASE_URL.replace(/^http/, 'ws');
    this.ws = new WebSocket(`${wsUrl}/ws`);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.send({ type: 'auth', token: this.token });
      this.emit('connected', { user_id: this.userId });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'error') {
          console.warn('WS error:', data.detail);
          return;
        }
        this.emit(data.type, data);
        this.emit('message', data);
      } catch (e) {
        console.warn('WS parse error:', e);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.emit('disconnected', {});
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.warn('WS error:', error);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, 3000);
  }

  send(data: Record<string, any>) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(data));
    }
  }

  joinArtifact(artifactId: string) {
    this.send({ type: 'view_artifact', artifact_id: artifactId });
  }

  leaveArtifact(artifactId: string) {
    this.send({ type: 'leave_artifact', artifact_id: artifactId });
  }

  sendCursorPosition(artifactId: string, position: { x: number; y: number; text_offset: number }) {
    this.send({
      type: 'cursor_move',
      artifact_id: artifactId,
      position,
    });
  }

  sendTyping(artifactId: string) {
    this.send({ type: 'typing', artifact_id: artifactId });
  }

  ping() {
    this.send({ type: 'ping' });
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: any) {
    this.handlers.get(event)?.forEach((h) => h(data));
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  get connected() {
    return this.isConnected;
  }
}

export const wsClient = new WebSocketClient();
