import type { Notification, UserPreferences, NotificationDelivery, NotificationTemplate, NotificationCategory, NotificationPriority, NotificationChannel } from './types';

export class RealtimeNotificationService {
  private static instance: RealtimeNotificationService;
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscribers = new Map<string, (notification: Notification) => void>();
  private isConnecting = false;

  static getInstance(): RealtimeNotificationService {
    if (!RealtimeNotificationService.instance) {
      RealtimeNotificationService.instance = new RealtimeNotificationService();
    }
    return RealtimeNotificationService.instance;
  }

  async connect(userId: string): Promise<void> {
    if (this.isConnecting || (this.websocket && this.websocket.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    try {
      const wsUrl = this.getWebSocketUrl(userId);
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('Notification WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.websocket.onmessage = (event) => {
        try {
          const notification: Notification = JSON.parse(event.data);
          this.handleIncomingNotification(notification);
        } catch (error) {
          console.error('Failed to parse notification:', error);
        }
      };

      this.websocket.onclose = () => {
        console.log('Notification WebSocket disconnected');
        this.isConnecting = false;
        this.attemptReconnect(userId);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.subscribers.clear();
  }

  subscribe(id: string, callback: (notification: Notification) => void): void {
    this.subscribers.set(id, callback);
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  private getWebSocketUrl(userId: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/notifications/${userId}`;
  }

  private handleIncomingNotification(notification: Notification): void {
    this.subscribers.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('Error in notification subscriber:', error);
      }
    });
  }

  private async attemptReconnect(userId: string): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => {
      if (!this.websocket || this.websocket.readyState === WebSocket.CLOSED) {
        this.connect(userId);
      }
    }, delay);
  }
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private subscription: PushSubscription | null = null;
  private isSupported = false;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return false;
    }

    this.isSupported = true;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      this.subscription = await registration.pushManager.getSubscription();
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  async subscribe(): Promise<PushSubscription | null> {
    if (!this.isSupported) {
      throw new Error('Push notifications not supported');
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      this.subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.getVapidPublicKey()),
      });

      await this.sendSubscriptionToServer(this.subscription);
      return this.subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.subscription) {
      return;
    }

    try {
      await this.subscription.unsubscribe();
      await this.removeSubscriptionFromServer(this.subscription);
      this.subscription = null;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Browser notifications not supported');
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  getSubscriptionStatus(): { subscribed: boolean; supported: boolean; permission: NotificationPermission } {
    return {
      subscribed: !!this.subscription,
      supported: this.isSupported,
      permission: 'Notification' in window ? Notification.permission : 'denied'
    };
  }

  private getVapidPublicKey(): string {
    return import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  }

  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
      throw error;
    }
  }
}

export class NotificationDeliveryService {
  private static instance: NotificationDeliveryService;
  private deliveryQueue = new Map<string, NotificationDelivery>();
  private activeDeliveries = new Set<string>();

  static getInstance(): NotificationDeliveryService {
    if (!NotificationDeliveryService.instance) {
      NotificationDeliveryService.instance = new NotificationDeliveryService();
    }
    return NotificationDeliveryService.instance;
  }

  async deliverNotification(notification: Notification, preferences: UserPreferences): Promise<void> {
    const deliveryId = `delivery_${notification.id}_${Date.now()}`;
    
    for (const channel of notification.channels) {
      if (!preferences.enabledChannels.includes(channel)) {
        continue;
      }

      const delivery: NotificationDelivery = {
        id: deliveryId,
        notificationId: notification.id,
        channel,
        status: 'processing',
        attempts: 0,
        lastAttempt: Date.now(),
      };

      this.deliveryQueue.set(deliveryId, delivery);
      this.activeDeliveries.add(deliveryId);

      try {
        await this.deliverViaChannel(notification, channel, preferences);
        delivery.status = 'completed';
        delivery.deliveredAt = Date.now();
      } catch (error) {
        delivery.status = 'failed';
        delivery.error = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to deliver notification via ${channel}:`, error);
      }

      this.activeDeliveries.delete(deliveryId);
    }
  }

  private async deliverViaChannel(notification: Notification, channel: NotificationChannel, preferences: UserPreferences): Promise<void> {
    switch (channel) {
      case 'in-app':
        await this.deliverInApp(notification, preferences);
        break;
      case 'push':
        await this.deliverPush(notification, preferences);
        break;
      case 'email':
        await this.deliverEmail(notification, preferences);
        break;
      default:
        throw new Error(`Unknown notification channel: ${channel}`);
    }
  }

  private async deliverInApp(notification: Notification, preferences: UserPreferences): Promise<void> {
    if (preferences.soundEnabled && 'audio' in window) {
      try {
        const audio = new Audio('/notification-sound.mp3');
        await audio.play();
      } catch (error) {
        console.log('Could not play notification sound:', error);
      }
    }

    if (preferences.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    if (preferences.desktopNotifications && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: notification.icon,
        tag: notification.id,
        requireInteraction: notification.priority === 'critical',
      });
    }
  }

  private async deliverPush(notification: Notification, preferences: UserPreferences): Promise<void> {
    const pushService = PushNotificationService.getInstance();
    const subscription = pushService.getSubscriptionStatus();
    
    if (!subscription.subscribed) {
      throw new Error('Push notification subscription not active');
    }

    await fetch('/api/notifications/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notification,
        subscription,
      }),
    });
  }

  private async deliverEmail(notification: Notification, preferences: UserPreferences): Promise<void> {
    await fetch('/api/notifications/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notification,
        userId: preferences.userId,
      }),
    });
  }

  getDeliveryStatus(deliveryId: string): NotificationDelivery | undefined {
    return this.deliveryQueue.get(deliveryId);
  }

  getActiveDeliveries(): NotificationDelivery[] {
    return Array.from(this.activeDeliveries).map(id => this.deliveryQueue.get(id)!);
  }
}

export class NotificationTemplateService {
  private templates = new Map<string, NotificationTemplate>();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'transaction-success',
        category: 'transaction',
        priority: 'medium',
        titleTemplate: 'Transaction Successful',
        messageTemplate: 'Your transaction of {{amount}} {{token}} has been completed successfully.',
        variables: ['amount', 'token'],
        defaultChannels: ['in-app', 'push'],
        enabled: true,
      },
      {
        id: 'transaction-failed',
        category: 'transaction',
        priority: 'high',
        titleTemplate: 'Transaction Failed',
        messageTemplate: 'Your transaction of {{amount}} {{token}} has failed. Reason: {{reason}}',
        variables: ['amount', 'token', 'reason'],
        defaultChannels: ['in-app', 'push', 'email'],
        enabled: true,
      },
      {
        id: 'escrow-created',
        category: 'escrow',
        priority: 'medium',
        titleTemplate: 'Escrow Created',
        messageTemplate: 'An escrow for {{amount}} {{token}} has been created with {{counterparty}}.',
        variables: ['amount', 'token', 'counterparty'],
        defaultChannels: ['in-app', 'push'],
        enabled: true,
      },
      {
        id: 'escrow-released',
        category: 'escrow',
        priority: 'high',
        titleTemplate: 'Escrow Released',
        messageTemplate: 'The escrow for {{amount}} {{token}} has been released to your account.',
        variables: ['amount', 'token'],
        defaultChannels: ['in-app', 'push', 'email'],
        enabled: true,
      },
      {
        id: 'security-alert',
        category: 'security',
        priority: 'critical',
        titleTemplate: 'Security Alert',
        messageTemplate: 'Unusual activity detected: {{activity}}. Please review your account.',
        variables: ['activity'],
        defaultChannels: ['in-app', 'push', 'email'],
        enabled: true,
      },
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  renderTemplate(templateId: string, variables: Record<string, unknown>): Notification | null {
    const template = this.templates.get(templateId);
    if (!template || !template.enabled) {
      return null;
    }

    const title = this.replaceVariables(template.titleTemplate, variables);
    const message = this.replaceVariables(template.messageTemplate, variables);

    return {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      message,
      priority: template.priority,
      channels: template.defaultChannels,
      category: template.category,
      timestamp: Date.now(),
      read: false,
      status: 'pending',
      metadata: { templateId, variables },
    };
  }

  private replaceVariables(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key]?.toString() || match;
    });
  }

  addTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): NotificationTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  updateTemplate(id: string, updates: Partial<NotificationTemplate>): boolean {
    const template = this.templates.get(id);
    if (!template) {
      return false;
    }

    this.templates.set(id, { ...template, ...updates });
    return true;
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }
}
