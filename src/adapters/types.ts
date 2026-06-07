import type { MetricData } from "../config/types";

export type SourceType = "cloudflare-billing" | "gcp-billing" | "anyrouter";

export interface FetchParams {
  scheduledTime: number;
  config: Record<string, unknown>;
}

export interface MetricsAdapter<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  readonly name: string;
  readonly type: SourceType;
  readonly priority: number;

  fetchMetrics(params: FetchParams): Promise<MetricData[]>;
  validateConfig(config: TConfig): boolean;
  normalize?(data: unknown): MetricData[];
}

export { type MetricData } from "../config/types";