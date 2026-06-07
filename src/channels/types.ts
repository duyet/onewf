import type { MetricData } from "../config/types";

export type ChannelType = "slack" | "telegram" | "webhook";
export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  sourceId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: number;
  metrics: MetricData[];
}

export interface AlertChannel<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  readonly name: string;
  readonly type: ChannelType;

  send(alert: Alert, config: TConfig): Promise<void>;
  formatMessage(alert: Alert): string;
  validateConfig(config: TConfig): boolean;
}

export interface Timestamp {
  value: number;
  iso: string;
}

export interface CostValue {
  amount: number;
  currency: string;
}

export interface Threshold {
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number;
  severity: AlertSeverity;
}