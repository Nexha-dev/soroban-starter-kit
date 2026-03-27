# Requirements Document

## Introduction

This feature adds a real-time monitoring dashboard to the Fidelis Soroban DApp. The dashboard provides live visibility into Soroban smart contract performance, transaction volumes, and system health. It supports custom metrics and KPI tracking, threshold-based alerting, historical data analysis, trend visualization, and predictive analytics — giving operators and developers a single pane of glass for observing on-chain and off-chain system behavior.

## Glossary

- **Dashboard**: The real-time monitoring UI rendered in the browser.
- **Data_Feed**: A continuous stream of metrics data delivered to the Dashboard via WebSocket or polling.
- **Metric**: A named, time-stamped numeric measurement (e.g., transaction count, contract invocation latency).
- **KPI**: Key Performance Indicator — a user-defined Metric with a target value and optional threshold.
- **Alert**: A notification generated when a Metric value crosses a user-defined Threshold.
- **Threshold**: A numeric boundary (upper or lower) associated with a KPI that triggers an Alert when breached.
- **Alert_Rule**: A user-defined configuration pairing a KPI with a Threshold and a notification channel.
- **Notification_Channel**: A delivery mechanism for Alerts (e.g., in-app notification, email, webhook).
- **Historical_Data**: Time-series Metric records stored for analysis beyond the live window.
- **Trend**: A directional pattern identified in Historical_Data over a configurable time range.
- **Prediction**: A forecast of a future Metric value derived from Historical_Data using a statistical model.
- **Widget**: A configurable visual component on the Dashboard that displays one or more Metrics.
- **Layout**: The arrangement of Widgets on the Dashboard, persisted per user.
- **Contract_Performance**: Metrics related to Soroban smart contract execution (invocation count, latency, error rate).
- **Transaction_Volume**: The count and value of Stellar transactions processed within a time window.
- **System_Health**: Aggregate status of infrastructure components (RPC node, indexer, frontend service).

---

## Requirements

### Requirement 1: Live Data Feed

**User Story:** As an operator, I want live metric data delivered to the dashboard without manual refresh, so that I can observe system behavior as it happens.

#### Acceptance Criteria

1. WHEN the Dashboard is opened, THE Data_Feed SHALL establish a connection and begin streaming Metric updates within 3 seconds.
2. WHILE the Data_Feed connection is active, THE Dashboard SHALL update displayed Metric values within 2 seconds of a new data point being available.
3. IF the Data_Feed connection is interrupted, THEN THE Dashboard SHALL display a connection-lost indicator and attempt reconnection at intervals of 5, 10, and 30 seconds.
4. WHEN the Data_Feed reconnects after an interruption, THE Dashboard SHALL resume live updates and remove the connection-lost indicator.
5. THE Data_Feed SHALL support a minimum update frequency of once per 5 seconds for all active Metrics.

---

### Requirement 2: Contract Performance Monitoring

**User Story:** As a developer, I want to monitor Soroban contract invocation counts, latency, and error rates in real time, so that I can detect and diagnose contract issues quickly.

#### Acceptance Criteria

1. WHEN a Soroban contract is invoked, THE Dashboard SHALL reflect the updated invocation count within the next Data_Feed update cycle.
2. THE Dashboard SHALL display Contract_Performance Metrics including: invocation count, median invocation latency in milliseconds, p95 invocation latency in milliseconds, and error rate as a percentage.
3. WHILE Contract_Performance data is being displayed, THE Dashboard SHALL refresh latency and error rate values at least once every 10 seconds.
4. IF a contract invocation results in an error, THEN THE Dashboard SHALL increment the error rate Metric for that contract.
5. THE Dashboard SHALL support monitoring Contract_Performance for a minimum of 10 distinct contracts simultaneously.

---

### Requirement 3: Transaction Volume Monitoring

**User Story:** As an operator, I want to see transaction volumes over time, so that I can understand usage patterns and detect anomalies.

#### Acceptance Criteria

1. THE Dashboard SHALL display Transaction_Volume as a time-series chart with configurable time windows of 1 minute, 5 minutes, 1 hour, and 24 hours.
2. WHEN the selected time window changes, THE Dashboard SHALL re-render the Transaction_Volume chart within 1 second using cached or fetched Historical_Data.
3. THE Dashboard SHALL display the total transaction count and total transaction value (in XLM) for the currently selected time window.
4. WHEN Transaction_Volume exceeds a user-defined Threshold, THE Dashboard SHALL generate an Alert.

---

### Requirement 4: System Health Monitoring

**User Story:** As an operator, I want a consolidated view of infrastructure component health, so that I can identify failing components before they impact users.

#### Acceptance Criteria

1. THE Dashboard SHALL display a System_Health panel showing the status of each monitored component as one of: Healthy, Degraded, or Unavailable.
2. WHEN a component's status changes, THE Dashboard SHALL update the System_Health panel within the next Data_Feed update cycle.
3. IF any component status becomes Unavailable, THEN THE Dashboard SHALL generate an Alert with severity level Critical.
4. IF any component status becomes Degraded, THEN THE Dashboard SHALL generate an Alert with severity level Warning.
5. THE Dashboard SHALL display the time elapsed since each component last reported a Healthy status.

---

### Requirement 5: Custom Metrics and KPI Tracking

**User Story:** As a developer, I want to define custom Metrics and KPIs with target values, so that I can track business-specific goals alongside system metrics.

#### Acceptance Criteria

1. THE Dashboard SHALL allow a user to create a KPI by specifying: a name, a source Metric, a target value, and an optional Threshold.
2. WHEN a KPI is created, THE Dashboard SHALL persist the KPI configuration and display it in the Dashboard within the current session and on subsequent sessions.
3. THE Dashboard SHALL display each KPI's current value, target value, and percentage progress toward the target.
4. THE Dashboard SHALL support a minimum of 50 user-defined KPIs per Dashboard instance.
5. WHEN a user deletes a KPI, THE Dashboard SHALL remove it from the display and cease evaluating its Threshold.

---

### Requirement 6: Alert System and Threshold Monitoring

**User Story:** As an operator, I want to configure alerts that fire when metrics cross defined thresholds, so that I am notified of issues without continuously watching the dashboard.

#### Acceptance Criteria

1. THE Dashboard SHALL allow a user to create an Alert_Rule by specifying: a target KPI or Metric, a Threshold value, a comparison operator (above or below), and one or more Notification_Channels.
2. WHEN a Metric value crosses the configured Threshold, THE Alert_Rule SHALL trigger an Alert within one Data_Feed update cycle.
3. THE Dashboard SHALL display all active Alerts in a dedicated Alert panel, ordered by severity then by time descending.
4. WHEN an Alert condition is resolved (the Metric value returns within the Threshold), THE Dashboard SHALL mark the Alert as resolved and record the resolution time.
5. IF an Alert_Rule is triggered and the same Alert_Rule has already produced an unresolved Alert, THEN THE Dashboard SHALL suppress duplicate Alerts and increment a repeat count on the existing Alert.
6. THE Dashboard SHALL support in-app notifications as a Notification_Channel for all Alert_Rules.
7. WHERE a webhook Notification_Channel is configured, THE Dashboard SHALL send an HTTP POST request containing the Alert payload to the configured URL within 5 seconds of Alert generation.

---

### Requirement 7: Historical Data Analysis

**User Story:** As an analyst, I want to query and visualize historical metric data, so that I can understand past performance and identify patterns.

#### Acceptance Criteria

1. THE Dashboard SHALL retain Historical_Data for all Metrics for a minimum of 30 days.
2. WHEN a user selects a historical time range, THE Dashboard SHALL retrieve and display the corresponding Historical_Data within 3 seconds.
3. THE Dashboard SHALL support querying Historical_Data with a start time, end time, and Metric name as filter parameters.
4. THE Dashboard SHALL display Historical_Data as a line chart with time on the x-axis and Metric value on the y-axis.
5. THE Dashboard SHALL allow a user to export Historical_Data for a selected Metric and time range as a CSV file.
6. WHEN a CSV export is requested, THE Dashboard SHALL generate and download the file within 5 seconds for time ranges up to 30 days.

---

### Requirement 8: Performance Trend Visualization

**User Story:** As a developer, I want to see trend lines overlaid on metric charts, so that I can quickly assess whether performance is improving or degrading.

#### Acceptance Criteria

1. THE Dashboard SHALL compute and display a Trend line for any Metric chart when the displayed time range contains at least 10 data points.
2. THE Dashboard SHALL indicate the Trend direction as Improving, Stable, or Degrading based on the slope of a linear regression over the displayed data points.
3. WHEN the Trend direction changes from the previous computation, THE Dashboard SHALL update the Trend indicator within the next chart refresh cycle.
4. THE Dashboard SHALL display the Trend computation method (linear regression) as a tooltip on the Trend indicator.

---

### Requirement 9: Predictive Analytics

**User Story:** As an operator, I want the dashboard to forecast future metric values, so that I can proactively address capacity or performance issues before they occur.

#### Acceptance Criteria

1. WHERE predictive analytics is enabled for a Metric, THE Dashboard SHALL display a forecast of that Metric's value for the next 1 hour, 6 hours, and 24 hours.
2. WHEN a forecast is generated, THE Dashboard SHALL display a confidence interval alongside the predicted value.
3. THE Dashboard SHALL recompute forecasts at least once every 15 minutes using the latest available Historical_Data.
4. IF fewer than 24 hours of Historical_Data are available for a Metric, THEN THE Dashboard SHALL display a warning that the forecast may have reduced accuracy.
5. THE Dashboard SHALL clearly distinguish forecast data from actual Historical_Data in all visualizations using a visually distinct style (e.g., dashed line).

---

### Requirement 10: Customizable Dashboard Layout

**User Story:** As a user, I want to arrange and configure dashboard widgets to match my workflow, so that the most relevant information is always visible.

#### Acceptance Criteria

1. THE Dashboard SHALL allow a user to add, remove, and reposition Widgets via drag-and-drop.
2. WHEN a user saves a Layout, THE Dashboard SHALL persist the Layout and restore it on the next session load.
3. THE Dashboard SHALL provide a minimum of 5 built-in Widget types: line chart, bar chart, numeric KPI card, alert list, and system health panel.
4. THE Dashboard SHALL allow a user to configure each Widget's data source, time range, and display title.
5. WHEN a user resets the Layout to default, THE Dashboard SHALL restore the default Widget arrangement and remove all user-added Widgets.
