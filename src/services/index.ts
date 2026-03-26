// Test Reporting
export { testReportingService } from './testReporting';
export type { TestResult, TestRun, TestStatus, QualityGate, TestAnalytics } from './testReporting';

// State Management Services
export {
  stateManager,
  type NormalizedState,
  type StateMetrics,
} from "./stateManager";
export { persistenceManager } from "./persistenceManager";
export { devTools, type DevToolsConfig } from "./devTools";
export { stateSynchronizer, type SyncEvent } from "./stateSynchronizer";
export {
  conflictResolver,
  type ConflictResolutionStrategy,
  type ConflictResolution,
} from "./conflictResolver";
export {
  stateValidator,
  type ValidationResult,
  type ValidationError,
} from "./stateValidator";
export {
  performanceMonitor,
  type PerformanceMetric,
  type PerformanceSummary,
} from "./performanceMonitor";

// Storage Services
export { storageService } from "./storage";
export type {
  Balance,
  EscrowData,
  CachedTransaction,
  UserPreferences,
  ConnectionStatus,
  SyncStatus,
} from "./storage/types";
export { storageService } from './storage';
export { DBError } from './storage/errors';
export type { DBHealthReport } from './storage/health';
export type { UserRecord, SettingRecord } from './storage/schema';
export type { Balance, EscrowData, CachedTransaction, UserPreferences, ConnectionStatus, SyncStatus } from './storage/types';

// Transaction Queue
export { transactionQueue } from "./transactionQueue";

// Sync Service
export { syncService } from "./sync";

// Localization Service
export {
  translationManager,
  TranslationManager,
  localizationAnalytics,
  communityTranslations,
} from "./localization";

// Logger
export { logger, type LogLevel, type LogEntry, type StellarLogData } from './logger';
export { installFetchLogger } from './logger/middleware';
// Security Service
export { securityService, encryptData, decryptData } from './security';
export type { SecuritySession, AuditLogEntry, SecurityAlert, SecurityConfig, SecurityState, AuthMethod, AlertSeverity } from './security';

// Wallet Service
export { walletService, WALLET_REGISTRY } from './wallet';
export type { WalletId, WalletInfo, WalletAccount, WalletConnection, WalletState, WalletPreferences, ConnectionEvent, NetworkPassphrase } from './wallet';
// Logging Service
export { loggingService } from './logging';
export type { LogEntry, ParsedLog, LogQuery, LogSearchResult, AnomalyAlert, RetentionPolicy, LogStats, LogLevel, LogSource } from './logging';
export { securityService, encryptData, decryptData } from "./security";
export type { SecuritySession, AuditLogEntry, SecurityAlert, SecurityConfig, SecurityState, AuthMethod, AlertSeverity } from "./security";
