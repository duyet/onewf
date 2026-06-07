export type SourceType = "cloudflare-billing" | "gcp-billing" | "anyrouter";
export type ChannelType = "slack" | "telegram" | "webhook";
export type AlertSeverity = "info" | "warning" | "critical";

export interface SourceConfig {
  id: string;
  type: SourceType;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  thresholds: ThresholdConfig[];
}

export interface ThresholdConfig {
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number;
  severity: AlertSeverity;
}

export interface ChannelConfig {
  id: string;
  type: ChannelType;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface AlertRule {
  sourceId: string;
  channelIds: string[];
  severityFilter?: AlertSeverity[];
}

export interface AppConfig {
  sources: SourceConfig[];
  channels: ChannelConfig[];
  rules: AlertRule[];
}

export interface MetricData {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface Alert {
  id: string;
  sourceId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: number;
  metrics: MetricData[];
}