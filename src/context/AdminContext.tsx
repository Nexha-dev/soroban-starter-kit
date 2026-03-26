import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { adminService } from '../services/admin/adminService';
import type {
  AdminState, AdminUser, ManagedContract, EmergencyAction,
  Permission, Role,
} from '../services/admin/types';

interface AdminContextType extends AdminState {
  hasPermission: (p: Permission) => boolean;
  createUser: (data: Omit<AdminUser, 'id' | 'createdAt'>) => AdminUser;
  updateUser: (id: string, patch: Partial<AdminUser>) => void;
  deleteUser: (id: string) => void;
  setUserRole: (id: string, role: Role) => void;
  pauseContract: (id: string) => void;
  resumeContract: (id: string) => void;
  upgradeContract: (id: string, version: string) => void;
  addContract: (data: Omit<ManagedContract, 'id' | 'deployedAt'>) => ManagedContract;
  triggerEmergency: (action: EmergencyAction, reason: string) => void;
  resolveEmergency: (id: string) => void;
  checkHealth: () => Promise<import('../services/admin/types').SystemHealth>;
  downloadAuditCSV: () => void;
  switchUser: (id: string) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<AdminState>(adminService.getState());

  useEffect(() => adminService.subscribe(setState), []);

  const value: AdminContextType = {
    ...state,
    hasPermission: (p) => adminService.hasPermission(p),
    createUser: (d) => adminService.createUser(d),
    updateUser: (id, patch) => adminService.updateUser(id, patch),
    deleteUser: (id) => adminService.deleteUser(id),
    setUserRole: (id, role) => adminService.setUserRole(id, role),
    pauseContract: (id) => adminService.pauseContract(id),
    resumeContract: (id) => adminService.resumeContract(id),
    upgradeContract: (id, v) => adminService.upgradeContract(id, v),
    addContract: (d) => adminService.addContract(d),
    triggerEmergency: (a, r) => adminService.triggerEmergency(a, r),
    resolveEmergency: (id) => adminService.resolveEmergency(id),
    checkHealth: () => adminService.checkHealth(),
    downloadAuditCSV: () => adminService.downloadAuditCSV(),
    switchUser: (id) => adminService.switchUser(id),
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextType {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
