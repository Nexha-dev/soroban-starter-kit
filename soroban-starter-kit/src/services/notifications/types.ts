export type NotificationChannel = 'in-app' | 'push' | 'email';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type AlertRuleOperator = 'equals' | 'greater' | 'less' | 'contains';
export type NotificationCategory = 'transaction' | 'escrow' | 'system' | 'security' | 'marketing' | 'general';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type DeliveryStatus = 'processing' | 'completed' | 'failed' | 'retrying';

export interface Notification {
  id: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  category: NotificationCategory;
  timestamp: number;
  read: boolean;
  status: NotificationStatus;
  actionUrl?: string;
  actionText?: string;
  icon?: string;
  imageUrl?: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
  retryCount?: number;
  scheduledFor?: number;
}

export interface UserPreferences {
  userId: string;
  enabledChannels: NotificationChannel[];
  priorityThreshold: NotificationPriority;
  quietHours?: { start: number; end: number };
  categories: Record<NotificationCategory, boolean>;
  frequency: 'instant' | 'hourly' | 'daily' | 'weekly';
  maxNotificationsPerHour?: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  desktopNotifications: boolean;
  timezone: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    field: string;
    operator: AlertRuleOperator;
    value: unknown;
  };
  action: {
    channels: NotificationChannel[];
    priority: NotificationPriority;
    category: string;
  };
  enabled: boolean;
  createdAt: number;
}

export interface NotificationAnalytics {
  id: string;
  notificationId: string;
  action: 'sent' | 'delivered' | 'read' | 'clicked' | 'dismissed' | 'failed';
  channel: NotificationChannel;
  timestamp: number;
  duration?: number;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface NotificationSchedule {
  id: string;
  notificationId: string;
  scheduledTime: number;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  retries: number;
  maxRetries: number;
  retryDelay: number;
  timezone: string;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  attempts: number;
  lastAttempt: number;
  nextRetry?: number;
  deliveredAt?: number;
  error?: string;
}

export interface NotificationTemplate {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  titleTemplate: string;
  messageTemplate: string;
  variables: string[];
  defaultChannels: NotificationChannel[];
  enabled: boolean;
}

export interface NotificationBatch {
  id: string;
  notifications: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  processedAt?: number;
  error?: string;
}

export interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  averageDeliveryTime: number;
  engagementRate: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
  byChannel: Record<NotificationChannel, number>;
}
