// ─── RBAC ─────────────────────────────────────────────────────────────────────

export type Permission =
  | 'users:read' | 'users:write' | 'users:delete'
  | 'contracts:read' | 'contracts:write' | 'contracts:upgrade' | 'contracts:pause'
  | 'system:read' | 'system:config'
  | 'audit:read' | 'audit:export'
  | 'emergency:trigger';

export type Role = 'superadmin' | 'admin' | 'operator' | 'auditor' | 'viewer';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  superadmin: [
    'users:read', 'users:write', 'users:delete',
    'contracts:read', 'contracts:write', 'contracts:upgrade', 'contracts:pause',
    'system:read', 'system:config',
    'audit:read', 'audit:export',
    'emergency:trigger',
  ],
  admin: [
    'users:read', 'users:write',
    'contracts:read', 'contracts:write', 'contracts:pause',
    'system:read', 'system:config',
    'audit:read', 'audit:export',
  ],
  operator: [
    'users:read',
    'contracts:read', 'contracts:write',
    'system:read',
    'audit:read',
  ],
  auditor: ['users:read', 'contracts:read', 'system:read', 'audit:read', 'audit:export'],
  viewer: ['users:read', 'contracts:read', 'system:read', 'audit:read'],
};

// ─── Users ────────────────────────────────────────────────────────────────────

export type UserStatus = 'active' | 'suspended' | 'pending';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: number;
  lastLogin?: number;
  permissions: Permission[]; // overrides on top of role
  mfaEnabled: boolean;
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export type ContractStatus = 'active' | 'paused' | 'deprecated' | 'upgrading';

export interface ManagedContract {
  id: string;
  name: string;
  contractId: string;
  version: string;
  status: ContractStatus;
  deployedAt: number;
  lastUpgraded?: number;
  admin: string;
  description?: string;
}

// ─── System health ────────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  checkedAt: number;
}

export interface SystemHealth {
  overall: HealthStatus;
  checks: HealthCheck[];
  uptime: number; // ms since app start
  memoryMB?: number;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export type AuditCategory = 'user' | 'contract' | 'system' | 'emergency' | 'auth';

export interface AdminAuditEntry {
  id: string;
  timestamp: number;
  actor: string; // username
  category: AuditCategory;
  action: string;
  target?: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
  ipAddress?: string;
}

// ─── Emergency ────────────────────────────────────────────────────────────────

export type EmergencyAction = 'pause_all' | 'resume_all' | 'revoke_sessions' | 'lock_system';

export interface EmergencyEvent {
  id: string;
  action: EmergencyAction;
  triggeredBy: string;
  timestamp: number;
  reason: string;
  resolved: boolean;
  resolvedAt?: number;
}

// ─── Admin state ──────────────────────────────────────────────────────────────

export interface AdminState {
  currentUser: AdminUser | null;
  users: AdminUser[];
  contracts: ManagedContract[];
  auditLog: AdminAuditEntry[];
  emergencyEvents: EmergencyEvent[];
  systemLocked: boolean;
  allContractsPaused: boolean;
}
