import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { gatewayService } from '../services/gateway/gatewayService';
import type {
  GatewayState, ApiRoute, ApiKey, GatewayRequest, GatewayResponse, ApiKeyScope,
} from '../services/gateway/types';

interface GatewayContextType extends GatewayState {
  dispatch: <T = unknown>(req: GatewayRequest) => Promise<GatewayResponse<T>>;
  addRoute: (route: Omit<ApiRoute, 'id'>) => ApiRoute;
  updateRoute: (id: string, patch: Partial<ApiRoute>) => void;
  deleteRoute: (id: string) => void;
  createApiKey: (name: string, scopes: ApiKeyScope[], owner: string, expiresInDays?: number) => ApiKey;
  revokeApiKey: (id: string) => void;
  deleteApiKey: (id: string) => void;
  setMaintenanceMode: (enabled: boolean) => void;
  clearRequestLog: () => void;
  downloadRequestLogCSV: () => void;
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined);

export function GatewayProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<GatewayState>(gatewayService.getState());

  useEffect(() => gatewayService.subscribe(setState), []);

  const value: GatewayContextType = {
    ...state,
    dispatch: (req) => gatewayService.dispatch(req),
    addRoute: (r) => gatewayService.addRoute(r),
    updateRoute: (id, p) => gatewayService.updateRoute(id, p),
    deleteRoute: (id) => gatewayService.deleteRoute(id),
    createApiKey: (n, s, o, d) => gatewayService.createApiKey(n, s, o, d),
    revokeApiKey: (id) => gatewayService.revokeApiKey(id),
    deleteApiKey: (id) => gatewayService.deleteApiKey(id),
    setMaintenanceMode: (e) => gatewayService.setMaintenanceMode(e),
    clearRequestLog: () => gatewayService.clearRequestLog(),
    downloadRequestLogCSV: () => gatewayService.downloadRequestLogCSV(),
  };

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway(): GatewayContextType {
  const ctx = useContext(GatewayContext);
  if (!ctx) throw new Error('useGateway must be used within GatewayProvider');
  return ctx;
}
