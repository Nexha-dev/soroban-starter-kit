# Implementation Plan: Real-Time Monitoring Dashboard

## Overview

Incrementally build the monitoring dashboard within the existing React/TypeScript/Vite frontend. Each task wires into the previous, starting with the data layer and services, then UI components, and finally integration.

## Tasks

- [ ] 1. Extend IndexedDB schema and set up monitoring types
  - [ ] 1.1 Add `MonitoringDBSchema` stores (`metricHistory`, `kpis`, `alertRules`, `alerts`) to `src/services/storage/schema.ts`
    - Extend `FidelisDBSchema` with the four new object stores and their indexes as defined in the design
    - _Requirements: 5.2, 6.1, 7.1_
  - [ ] 1.2 Create `src/services/monitoring/types.ts` with all shared interfaces
    - Export `MetricUpdate`, `KPI`, `Threshold`, `KPIState`, `AlertRule`, `Alert`, `AlertSeverity`, `AlertStatus`, `WidgetConfig`, `ForecastResult`, `ForecastHorizon`, `HistoryQuery`, `DataPoint`, `MonitoringWebSocketMessage`, `MonitoringMessageType`
    - _Requirements: 1.1, 2.2, 5.1, 6.1, 9.1_

- [ ] 2. Implement MetricsService
  - [ ] 2.1 Create `src/services/monitoring/MetricsService.ts`
    - Maintain `Map<string, MetricUpdate>` for latest values
    - Implement `subscribe`, `getLatest`, `getLatestAll`
    - Parse incoming `MonitoringWebSocketMessage` events and dispatch to subscribers
    - _Requirements: 1.2, 2.1, 2.3_
  - [ ]* 2.2 Write property test for MetricsService subscriber fan-out
    - **Property 1: Every subscriber registered for a metric name receives the update when that metric is published**
    - **Validates: Requirements 1.2, 2.1**

- [ ] 3. Implement HistoryService
  - [ ] 3.1 Create `src/services/monitoring/HistoryService.ts`
    - Write `record(update)` to persist to `metricHistory` IndexedDB store
    - Implement `query(q)` using the `by-metric-time` compound index
    - Implement `pruneOlderThan(cutoffMs)` to enforce 30-day TTL
    - Implement `exportCSV(q)` returning a CSV string
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_
  - [ ]* 3.2 Write property test for HistoryService round-trip
    - **Property 2: Any MetricUpdate recorded and then queried within its time range is returned in the result set**
    - **Validates: Requirements 7.1, 7.3**
  - [ ]* 3.3 Write property test for HistoryService pruning
    - **Property 3: After pruneOlderThan(T), no record with timestamp < T remains in the store**
    - **Validates: Requirements 7.1**

- [ ] 4. Implement ForecastService
  - [ ] 4.1 Create `src/services/monitoring/ForecastService.ts`
    - Implement in-browser linear regression over the last N data points from `HistoryService`
    - Compute `predictedValue`, `confidenceLow`, `confidenceHigh` for 1h, 6h, 24h horizons
    - Set `insufficientData: true` when fewer than 24 hours of history are available
    - Implement `getForecast` and `recompute`; schedule recompute every 15 minutes
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [ ]* 4.2 Write property test for ForecastService linear regression
    - **Property 4: For a perfectly linear input sequence, the predicted value at any horizon equals the exact extrapolation of that line (within floating-point tolerance)**
    - **Validates: Requirements 9.1, 9.2**
  - [ ]* 4.3 Write unit tests for ForecastService insufficient-data guard
    - Test that `insufficientData` is `true` when fewer than 24 hours of data points are present
    - _Requirements: 9.4_

- [ ] 5. Implement KPIService
  - [ ] 5.1 Create `src/services/monitoring/KPIService.ts`
    - Implement `createKPI`, `deleteKPI`, `listKPIs` backed by the `kpis` IndexedDB store
    - Implement `getKPIState` computing `currentValue` and `progressPercent` from `MetricsService.getLatest`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 5.2 Write property test for KPIService progress computation
    - **Property 5: progressPercent = clamp((currentValue / targetValue) * 100, 0, 100) for any non-zero targetValue**
    - **Validates: Requirements 5.3**

- [ ] 6. Implement AlertService
  - [ ] 6.1 Create `src/services/monitoring/AlertService.ts`
    - Implement `createRule`, `deleteRule` backed by the `alertRules` IndexedDB store
    - Evaluate rules on each `MetricUpdate` from `MetricsService`; trigger alerts within one update cycle
    - Maintain in-memory `Map<string, Alert>` keyed by `ruleId` for deduplication; increment `repeatCount` on re-trigger
    - Mark alert resolved and record `resolvedAt` when metric returns within threshold
    - Implement `getActiveAlerts` and `onAlert` callback registration
    - Dispatch in-app notification via existing `NotificationManager` on alert trigger
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 6.2 Write property test for AlertService deduplication
    - **Property 6: Triggering the same alert rule N times without resolution produces exactly one active alert with repeatCount = N - 1**
    - **Validates: Requirements 6.5**
  - [ ]* 6.3 Write unit tests for AlertService threshold evaluation
    - Test `above` and `below` operators at boundary values
    - Test resolution path sets `status = 'resolved'` and records `resolvedAt`
    - _Requirements: 6.2, 6.4_

- [ ] 7. Checkpoint — Ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Extend WebSocketManager with monitoring reconnection schedule
  - [ ] 8.1 Update `WebSocketManager` (or its subclass) in `src/services/` to implement the 5s → 10s → 30s reconnection schedule
    - Emit a `connection-status` event (`connecting | connected | disconnected | failed`) on each state transition
    - Wire `MonitoringWebSocketMessage` parsing to `MetricsService.distribute`
    - _Requirements: 1.1, 1.3, 1.4_
  - [ ]* 8.2 Write unit tests for reconnection schedule
    - Test that retry delays follow the 5s, 10s, 30s sequence using fake timers
    - Test that `connection-status` events fire on each transition
    - _Requirements: 1.3, 1.4_

- [ ] 9. Implement LayoutService
  - [ ] 9.1 Create `src/services/monitoring/LayoutService.ts`
    - Implement `saveLayout`, `loadLayout`, `resetToDefault` using `VisualizationManager.saveDashboard` / `getDashboard`
    - Define and export the default widget arrangement (5 built-in widget types)
    - _Requirements: 10.1, 10.2, 10.3, 10.5_
  - [ ]* 9.2 Write unit tests for LayoutService persistence round-trip
    - Test that a saved layout is returned unchanged by `loadLayout`
    - Test that `resetToDefault` returns the canonical default arrangement
    - _Requirements: 10.2, 10.5_

- [ ] 10. Create monitoring service barrel and wire services together
  - [ ] 10.1 Create `src/services/monitoring/index.ts` exporting all six services as singletons
    - Instantiate services in dependency order: `MetricsService` → `HistoryService`, `KPIService`, `AlertService` → `ForecastService`
    - Subscribe `HistoryService.record` to `MetricsService` for all metrics
    - _Requirements: 1.2, 2.1, 7.1_

- [ ] 11. Implement ConnectionStatusBanner component
  - [ ] 11.1 Create `src/components/monitoring/ConnectionStatusBanner.tsx`
    - Subscribe to `connection-status` events from `WebSocketManager`
    - Render a sticky banner when status is `disconnected` or `failed`; hide when `connected`
    - _Requirements: 1.3, 1.4_

- [ ] 12. Implement KPICardWidget and KPIForm
  - [ ] 12.1 Create `src/components/monitoring/KPICardWidget.tsx`
    - Display `currentValue`, `targetValue`, progress bar, and threshold indicator from `KPIService.getKPIState`
    - _Requirements: 5.3_
  - [ ] 12.2 Create `src/components/monitoring/KPIForm.tsx`
    - Form fields: name, sourceMetric (dropdown from `MetricsService.getLatestAll`), targetValue, optional threshold
    - On submit call `KPIService.createKPI`; validate that targetValue > 0
    - _Requirements: 5.1, 5.2_

- [ ] 13. Implement AlertPanelWidget and AlertRuleForm
  - [ ] 13.1 Create `src/components/monitoring/AlertPanelWidget.tsx`
    - Render active alerts from `AlertService.getActiveAlerts`, sorted by severity then by `triggeredAt` descending
    - Show severity badge, `repeatCount`, and resolution status
    - _Requirements: 6.3, 6.4_
  - [ ] 13.2 Create `src/components/monitoring/AlertRuleForm.tsx`
    - Form fields: targetMetric, threshold value, operator (`above`/`below`), notification channels
    - On submit call `AlertService.createRule`
    - _Requirements: 6.1, 6.6_

- [ ] 14. Implement ContractPerformanceWidget
  - [ ] 14.1 Create `src/components/monitoring/ContractPerformanceWidget.tsx`
    - Subscribe to `contract_perf` metric updates via `MetricsService`
    - Display invocation count, median latency (ms), p95 latency (ms), error rate (%) per contract
    - Support up to 10 contracts simultaneously
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 15. Implement TransactionVolumeWidget
  - [ ] 15.1 Create `src/components/monitoring/TransactionVolumeWidget.tsx`
    - Render a time-series bar/line chart from `HistoryService.query` for `tx_volume` metric
    - Provide time-window selector: 1 min, 5 min, 1 hour, 24 hours; re-render within 1 second on change
    - Display total transaction count and total XLM value for the selected window
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 16. Implement SystemHealthWidget
  - [ ] 16.1 Create `src/components/monitoring/SystemHealthWidget.tsx`
    - Subscribe to `system_health` metric updates via `MetricsService`
    - Render status grid with Healthy / Degraded / Unavailable per component
    - Display elapsed time since last Healthy status for each component
    - Trigger `AlertService` for Unavailable (Critical) and Degraded (Warning) status changes
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 17. Implement HistoricalChartWidget
  - [ ] 17.1 Create `src/components/monitoring/HistoricalChartWidget.tsx`
    - Render line chart from `HistoryService.query` with time on x-axis, value on y-axis
    - Overlay trend line from `ForecastService` (linear regression slope); show Improving / Stable / Degrading indicator with tooltip
    - Render forecast horizons as dashed lines with confidence interval shading
    - Provide CSV export button calling `HistoryService.exportCSV`; complete within 5 seconds
    - Show "reduced accuracy" warning when `ForecastResult.insufficientData` is true
    - _Requirements: 7.2, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.4, 9.5_

- [ ] 18. Implement WidgetConfigPanel
  - [ ] 18.1 Create `src/components/monitoring/WidgetConfigPanel.tsx`
    - Sidebar panel for configuring a selected widget's `dataSource`, `timeRange`, and `title`
    - On save, update the widget config in `LayoutService` and re-render the target widget
    - _Requirements: 10.4_

- [ ] 19. Implement MonitoringDashboard root component
  - [ ] 19.1 Create `src/components/monitoring/MonitoringDashboard.tsx`
    - Load layout from `LayoutService.loadLayout` on mount; render widgets in a drag-and-drop grid
    - Support add, remove, and reposition of widgets; persist layout changes via `LayoutService.saveLayout`
    - Provide "Reset to default" action calling `LayoutService.resetToDefault`
    - Render `ConnectionStatusBanner` at the top
    - _Requirements: 10.1, 10.2, 10.3, 10.5_
  - [ ]* 19.2 Write unit tests for MonitoringDashboard layout persistence
    - Test that layout saved on unmount is restored on remount
    - Test that reset restores the default widget set
    - _Requirements: 10.2, 10.5_

- [ ] 20. Create monitoring component barrel and integrate into app routing
  - [ ] 20.1 Create `src/components/monitoring/index.ts` exporting all monitoring components
  - [ ] 20.2 Add a `/monitoring` route (or tab) in the existing app router pointing to `MonitoringDashboard`
    - _Requirements: 1.1_

- [ ] 21. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already in devDependencies) and `fake-indexeddb` for IndexedDB mocking
- Checkpoints ensure incremental validation before moving to the next layer
