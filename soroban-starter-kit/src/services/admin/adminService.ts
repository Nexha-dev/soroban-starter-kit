import {
  AdminState, AdminUser, AdminAuditEntry, ManagedContract,
  EmergencyAction, EmergencyEvent, HealthCheck, SystemHealth,
  Permission, Role, ROLE_PERMISSIONS, AuditCategory,
} from './types';

const STORAGE_KEY = 'admin_state';
const APP_START = Date.now();

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_USERS: AdminUser[] = [
  { id: 'u1', username: 'superadmin', email: 'admin@fidelis.app', role: 'superadmin', status: 'active', createdAt: Date.now() - 86400000 * 30, mfaEnabled: true, permissions: [] },
  { id: 'u2', username: 'alice', email: 'alice@fidelis.app', role: 'admin', status: 'active', createdAt: Date.now() - 86400000 * 14, lastLogin: Date.now() - 3600000, mfaEnabled: true, permissions: [] },
  { id: 'u3', username: 'bob', email: 'bob@fidelis.app', role: 'operator', status: 'active', createdAt: Date.now() - 86400000 * 7, lastLogin: Date.now() - 7200000, mfaEnabled: false, permissions: [] },
  { id: 'u4', username: 'carol', email: 'carol@fidelis.app', role: 'auditor', status: 'active', createdAt: Date.now() - 86400000 * 3, mfaEnabled: true, permissions: [] },
  { id: 'u5', username: 'dave', email: 'dave@fidelis.app', role: 'viewer', status: 'suspended', createdAt: Date.now() - 86400000 * 60, mfaEnabled: false, permissions: [] },
];

const SEED_CONTRACTS: ManagedContract[] = [
  { id: 'c1', name: 'Token Contract', contractId: 'CTOKEN123...', version: '1.2.0', status: 'active', deployedAt: Date.now() - 86400000 * 90, admin: 'superadmin', description: 'Main XLM-pegged token' },
  { id: 'c2', name: 'Escrow Contract', contractId: 'CESCROW456...', version: '2.0.1', status: 'active', deployedAt: Date.now() - 86400000 * 60, lastUpgraded: Date.now() - 86400000 * 5, admin: 'alice', description: 'Multi-party escrow' },
  { id: 'c3', name: 'Legacy Bridge', contractId: 'CBRIDGE789...', version: '0.9.0', status: 'deprecated', deployedAt: Date.now() - 86400000 * 180, admin: 'superadmin', description: 'Old bridge — deprecated' },
];

function defaultState(): AdminState {
  return {
    currentUser: SEED_USERS[0],
    users: SEED_USERS,
    contracts: SEED_CONTRACTS,
    auditLog: [],
    emergencyEvents: [],
    systemLocked: false,
    allContractsPaused: false,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class AdminService {
  private state: AdminState;
  private listeners: Set<(s: AdminState) => void> = new Set();

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      this.state = stored ? { ...defaultState(), ...JSON.parse(stored) } : defaultState();
    } catch {
      this.state = defaultState();
    }
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  subscribe(fn: (s: AdminState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): AdminState { return { ...this.state }; }

  private emit() {
    const s = this.getState();
    this.listeners.forEach(fn => fn(s));
    try {
      const { auditLog, ...rest } = s;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, auditLog: auditLog.slice(-200) }));
    } catch { /* quota */ }
  }

  // ── RBAC ───────────────────────────────────────────────────────────────────

  hasPermission(permission: Permission, user?: AdminUser): boolean {
    const u = user ?? this.state.currentUser;
    if (!u) return false;
    const rolePerms = ROLE_PERMISSIONS[u.role];
    return rolePerms.includes(permission) || u.permissions.includes(permission);
  }

  // ── Audit ──────────────────────────────────────────────────────────────────

  private audit(category: AuditCategory, action: string, details: string, target?: string, severity: AdminAuditEntry['severity'] = 'info') {
    const entry: AdminAuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      actor: this.state.currentUser?.username ?? 'system',
      category,
      action,
      target,
      details,
      severity,
    };
    this.state = { ...this.state, auditLog: [entry, ...this.state.auditLog].slice(0, 500) };
  }

  exportAuditCSV(): string {
    const rows = [
      ['Timestamp', 'Actor', 'Category', 'Action', 'Target', 'Details', 'Severity'],
      ...this.state.auditLog.map(e => [
        new Date(e.timestamp).toISOString(), e.actor, e.category,
        e.action, e.target ?? '', e.details, e.severity,
      ]),
    ];
    return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  downloadAuditCSV() {
    const csv = this.exportAuditCSV();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  createUser(data: Omit<AdminUser, 'id' | 'createdAt'>): AdminUser {
    const user: AdminUser = { ...data, id: `u_${Date.now()}`, createdAt: Date.now() };
    this.state = { ...this.state, users: [...this.state.users, user] };
    this.audit('user', 'create_user', `Created user ${user.username}`, user.username);
    this.emit();
    return user;
  }

  updateUser(id: string, patch: Partial<AdminUser>) {
    this.state = {
      ...this.state,
      users: this.state.users.map(u => u.id === id ? { ...u, ...patch } : u),
    };
    this.audit('user', 'update_user', `Updated user ${id}`, id);
    this.emit();
  }

  deleteUser(id: string) {
    const user = this.state.users.find(u => u.id === id);
    this.state = { ...this.state, users: this.state.users.filter(u => u.id !== id) };
    this.audit('user', 'delete_user', `Deleted user ${user?.username ?? id}`, id, 'warning');
    this.emit();
  }

  setUserRole(id: string, role: Role) {
    this.updateUser(id, { role });
    this.audit('user', 'change_role', `Changed role to ${role}`, id, 'warning');
    this.emit();
  }

  // ── Contracts ──────────────────────────────────────────────────────────────

  pauseContract(id: string) {
    this.state = {
      ...this.state,
      contracts: this.state.contracts.map(c => c.id === id ? { ...c, status: 'paused' } : c),
    };
    this.audit('contract', 'pause_contract', `Paused contract ${id}`, id, 'warning');
    this.emit();
  }

  resumeContract(id: string) {
    this.state = {
      ...this.state,
      contracts: this.state.contracts.map(c => c.id === id ? { ...c, status: 'active' } : c),
    };
    this.audit('contract', 'resume_contract', `Resumed contract ${id}`, id);
    this.emit();
  }

  upgradeContract(id: string, newVersion: string) {
    this.state = {
      ...this.state,
      contracts: this.state.contracts.map(c =>
        c.id === id ? { ...c, version: newVersion, status: 'active', lastUpgraded: Date.now() } : c
      ),
    };
    this.audit('contract', 'upgrade_contract', `Upgraded contract ${id} to v${newVersion}`, id, 'warning');
    this.emit();
  }

  addContract(data: Omit<ManagedContract, 'id' | 'deployedAt'>) {
    const contract: ManagedContract = { ...data, id: `c_${Date.now()}`, deployedAt: Date.now() };
    this.state = { ...this.state, contracts: [...this.state.contracts, contract] };
    this.audit('contract', 'add_contract', `Registered contract ${contract.name}`, contract.id);
    this.emit();
    return contract;
  }

  // ── System health ──────────────────────────────────────────────────────────

  async checkHealth(): Promise<SystemHealth> {
    const checks: HealthCheck[] = await Promise.all([
      this.ping('Soroban RPC', 'https://soroban-testnet.stellar.org'),
      this.ping('Horizon API', 'https://horizon-testnet.stellar.org'),
      this.checkStorage(),
      this.checkIndexedDB(),
    ]);
    const overall = checks.some(c => c.status === 'down') ? 'down'
      : checks.some(c => c.status === 'degraded') ? 'degraded' : 'healthy';
    return {
      overall,
      checks,
      uptime: Date.now() - APP_START,
      memoryMB: (performance as any).memory?.usedJSHeapSize
        ? Math.round((performance as any).memory.usedJSHeapSize / 1_048_576)
        : undefined,
    };
  }

  private async ping(name: string, url: string): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      await fetch(url, { method: 'HEAD', signal: ctrl.signal, mode: 'no-cors' });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      return { name, status: latencyMs > 2000 ? 'degraded' : 'healthy', latencyMs, checkedAt: Date.now() };
    } catch {
      return { name, status: 'down', message: 'Unreachable', checkedAt: Date.now() };
    }
  }

  private checkStorage(): HealthCheck {
    try {
      localStorage.setItem('__health__', '1');
      localStorage.removeItem('__health__');
      return { name: 'Local Storage', status: 'healthy', checkedAt: Date.now() };
    } catch {
      return { name: 'Local Storage', status: 'down', message: 'Quota exceeded or blocked', checkedAt: Date.now() };
    }
  }

  private async checkIndexedDB(): Promise<HealthCheck> {
    try {
      await new Promise<void>((res, rej) => {
        const req = indexedDB.open('__health_check__');
        req.onsuccess = () => { req.result.close(); indexedDB.deleteDatabase('__health_check__'); res(); };
        req.onerror = () => rej(req.error);
      });
      return { name: 'IndexedDB', status: 'healthy', checkedAt: Date.now() };
    } catch {
      return { name: 'IndexedDB', status: 'down', message: 'Unavailable', checkedAt: Date.now() };
    }
  }

  // ── Emergency ──────────────────────────────────────────────────────────────

  triggerEmergency(action: EmergencyAction, reason: string): EmergencyEvent {
    const event: EmergencyEvent = {
      id: `em_${Date.now()}`,
      action,
      triggeredBy: this.state.currentUser?.username ?? 'system',
      timestamp: Date.now(),
      reason,
      resolved: false,
    };

    let patch: Partial<AdminState> = { emergencyEvents: [event, ...this.state.emergencyEvents] };

    if (action === 'pause_all') {
      patch.allContractsPaused = true;
      patch.contracts = this.state.contracts.map(c => c.status === 'active' ? { ...c, status: 'paused' } : c);
    } else if (action === 'resume_all') {
      patch.allContractsPaused = false;
      patch.contracts = this.state.contracts.map(c => c.status === 'paused' ? { ...c, status: 'active' } : c);
    } else if (action === 'lock_system') {
      patch.systemLocked = true;
    } else if (action === 'revoke_sessions') {
      // In a real app this would invalidate all JWT/session tokens
    }

    this.state = { ...this.state, ...patch };
    this.audit('emergency', action, reason, undefined, 'critical');
    this.emit();
    return event;
  }

  resolveEmergency(id: string) {
    this.state = {
      ...this.state,
      systemLocked: false,
      emergencyEvents: this.state.emergencyEvents.map(e =>
        e.id === id ? { ...e, resolved: true, resolvedAt: Date.now() } : e
      ),
    };
    this.audit('emergency', 'resolve_emergency', `Resolved emergency ${id}`, id, 'warning');
    this.emit();
  }

  switchUser(userId: string) {
    const user = this.state.users.find(u => u.id === userId) ?? null;
    this.state = { ...this.state, currentUser: user };
    if (user) this.audit('auth', 'switch_user', `Switched to ${user.username}`, user.username);
    this.emit();
  }
}

export const adminService = new AdminService();
