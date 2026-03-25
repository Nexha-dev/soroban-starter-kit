/**
 * User Preferences System Types
 */

export type Theme = 'light' | 'dark' | 'auto';
export type Language = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';
export type TimeFormat = '12h' | '24h';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

export interface ThemePreferences {
  theme: Theme;
  accentColor?: string;
  fontSize: 'small' | 'normal' | 'large';
  compactMode: boolean;
}

export interface NotificationSettings {
  enabledChannels: ('in-app' | 'push' | 'email')[];
  priorityThreshold: 'low' | 'medium' | 'high';
  frequency: 'instant' | 'daily' | 'weekly';
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;
  };
  categories: {
    transactions: boolean;
    escrows: boolean;
    balances: boolean;
    system: boolean;
    security: boolean;
  };
}

export interface DisplayPreferences {
  language: Language;
  timezone: string;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  currency: string;
  numberFormat: 'en-US' | 'de-DE' | 'fr-FR'; // Locale for number formatting
  showAdvancedOptions: boolean;
}

export interface PrivacySettings {
  dataCollection: boolean;
  crashReports: boolean;
  analyticsTracking: boolean;
  personalizedResults: boolean;
  shareUsageData: boolean;
  allowCrossSyncData: boolean;
}

export interface SyncSettings {
  enableCloudSync: boolean;
  autoSync: boolean;
  syncInterval: number; // milliseconds
  syncDeviceId: string;
  lastSyncTime?: number;
  linkedDevices: LinkedDevice[];
}

export interface LinkedDevice {
  id: string;
  name: string;
  type: 'web' | 'mobile' | 'desktop';
  osType: string;
  lastActive: number;
  canRemove: boolean;
}

export interface UserOnboarding {
  completed: boolean;
  currentStep: number;
  stepsCompleted: string[];
  lastAccessed: number;
  skipped: boolean;
}

export interface PreferenceBackup {
  id: string;
  timestamp: number;
  data: UserPreferences;
  version: string;
  device: string;
  notes?: string;
}

export interface UserPreferences {
  userId: string;
  theme: ThemePreferences;
  notifications: NotificationSettings;
  display: DisplayPreferences;
  privacy: PrivacySettings;
  sync: SyncSettings;
  onboarding: UserOnboarding;
  backups: PreferenceBackup[];
  createdAt: number;
  updatedAt: number;
  version: string;
}

export interface PreferenceUpdatePayload {
  theme?: Partial<ThemePreferences>;
  notifications?: Partial<NotificationSettings>;
  display?: Partial<DisplayPreferences>;
  privacy?: Partial<PrivacySettings>;
  sync?: Partial<SyncSettings>;
  onboarding?: Partial<UserOnboarding>;
}

export interface PreferenceAnalytics {
  userId: string;
  prefChanges: {
    category: string;
    key: string;
    oldValue: any;
    newValue: any;
    timestamp: number;
  }[];
  onboardingProgress: {
    startTime: number;
    completionTime?: number;
    stepsSkipped: string[];
  };
  syncEvents: {
    timestamp: number;
    action: 'backup' | 'restore' | 'import' | 'export' | 'cross-sync';
    status: 'success' | 'error';
    deviceId?: string;
  }[];
}
