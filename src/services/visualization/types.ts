export interface DataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  label?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'area' | 'candlestick';
  title: string;
  dataKey: string;
  color?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  animated?: boolean;
}

export interface ChartTooltip {
  x: number;
  y: number;
  value: number;
  label: string;
  timestamp: number;
}

export interface TrendMetrics {
  slope: number;
  rSquared: number;
  direction: 'up' | 'down' | 'flat';
  changePercent: number;
  volatility: number;
}

export interface DashboardWidget {
  id: string;
  title: string;
  chartConfig: ChartConfig;
  data: DataPoint[];
  ohlcData?: OHLCPoint[];
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  createdAt: number;
}

export interface VisualizationAnalytics {
  id: string;
  widgetId: string;
  action: 'zoom' | 'pan' | 'export' | 'interact';
  timestamp: number;
  duration?: number;
}

export interface WebSocketMessage {
  type: 'price' | 'transaction' | 'balance';
  data: Record<string, unknown>;
  timestamp: number;
}
