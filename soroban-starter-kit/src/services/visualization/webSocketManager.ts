import { WebSocketMessage } from './types';

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, Set<(data: WebSocketMessage) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            const callbacks = this.listeners.get(message.type) || new Set();
            callbacks.forEach(cb => cb(message));
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = () => reject(new Error('WebSocket connection failed'));
        this.ws.onclose = () => this.attemptReconnect();
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      setTimeout(() => this.connect().catch(console.error), delay);
    }
  }

  subscribe(type: string, callback: (data: WebSocketMessage) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  unsubscribe(type: string, callback: (data: WebSocketMessage) => void): void {
    this.listeners.get(type)?.delete(callback);
  }

  send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const createWebSocketManager = (url: string) => new WebSocketManager(url);
