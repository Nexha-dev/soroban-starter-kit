import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { analyticsService, DATA_SOURCES } from '../services/analytics/analyticsService';
import type {
  AnalyticsState, ReportDefinition, ScheduleFrequency, ExportFormat, ReportResult, ComparisonResult,
} from '../services/analytics/types';

interface AnalyticsContextType extends AnalyticsState {
  dataSources: typeof DATA_SOURCES;
  createReport: (def: Omit<ReportDefinition, 'id' | 'createdAt' | 'updatedAt'>) => ReportDefinition;
  updateReport: (id: string, patch: Partial<ReportDefinition>) => void;
  deleteReport: (id: string) => void;
  runReport: (id: string) => ReportResult;
  compareReports: (id: string) => ComparisonResult;
  scheduleReport: (reportId: string, freq: ScheduleFrequency, recipients: string[], format: ExportFormat) => void;
  updateSchedule: (id: string, patch: Partial<import('../services/analytics/types').ScheduledReport>) => void;
  deleteSchedule: (id: string) => void;
  exportResult: (reportId: string, format: ExportFormat) => void;
  refreshInsights: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<AnalyticsState>(analyticsService.getState());

  useEffect(() => analyticsService.subscribe(setState), []);

  const value: AnalyticsContextType = {
    ...state,
    dataSources: DATA_SOURCES,
    createReport: (def) => analyticsService.createReport(def),
    updateReport: (id, p) => analyticsService.updateReport(id, p),
    deleteReport: (id) => analyticsService.deleteReport(id),
    runReport: (id) => analyticsService.runReport(id),
    compareReports: (id) => analyticsService.compareReports(id),
    scheduleReport: (rid, f, r, fmt) => analyticsService.scheduleReport(rid, f, r, fmt),
    updateSchedule: (id, p) => analyticsService.updateSchedule(id, p),
    deleteSchedule: (id) => analyticsService.deleteSchedule(id),
    exportResult: (id, fmt) => analyticsService.exportResult(id, fmt),
    refreshInsights: () => analyticsService.refreshInsights(),
  };

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AnalyticsContextType {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics must be used within AnalyticsProvider');
  return ctx;
}
