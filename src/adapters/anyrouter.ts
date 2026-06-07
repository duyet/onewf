import type { MetricsAdapter, FetchParams, MetricData, SourceType } from "./types";
import { BaseMetricsAdapter } from "./base";
import type { Env } from "../index";

export interface AnyRouterConfig extends Record<string, unknown> {
  apiKey: string;
  baseUrl?: string;
}

export class AnyRouterAdapter extends BaseMetricsAdapter<AnyRouterConfig> {
  readonly name = "anyrouter";
  readonly type: SourceType = "anyrouter";
  readonly priority = 20;

  constructor(config: AnyRouterConfig, private env: Env) {
    super(config);
  }

  validateConfig(config: AnyRouterConfig): boolean {
    return !!config.apiKey;
  }

  async fetchMetrics(params: FetchParams): Promise<MetricData[]> {
    const { apiKey, baseUrl = "https://api.anyrouter.dev" } = this.config;
    const url = `${baseUrl}/admin/overview`;

    const response = await this.fetchWithRetry<any>(
      url,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
      3,
      2000
    );

    if (!response) {
      return [];
    }

    return this.normalize(response);
  }

  normalize(data: unknown): MetricData[] {
    const overview = data as {
      totalCost?: number;
      totalRequests?: number;
      totalTokens?: number;
      byProvider?: Record<string, { cost: number; requests: number; tokens: number }>;
      byModel?: Record<string, { cost: number; requests: number; tokens: number }>;
      timestamp?: string;
    };

    const timestamp = overview.timestamp ? new Date(overview.timestamp).getTime() : Date.now();
    const metrics: MetricData[] = [];

    if (overview.totalCost !== undefined) {
      metrics.push({
        name: "total_cost",
        value: overview.totalCost,
        unit: "USD",
        timestamp,
      });
    }

    if (overview.totalRequests !== undefined) {
      metrics.push({
        name: "total_requests",
        value: overview.totalRequests,
        unit: "requests",
        timestamp,
      });
    }

    if (overview.totalTokens !== undefined) {
      metrics.push({
        name: "total_tokens",
        value: overview.totalTokens,
        unit: "tokens",
        timestamp,
      });
    }

    if (overview.byProvider) {
      for (const [provider, stats] of Object.entries(overview.byProvider)) {
        metrics.push({
          name: "provider_cost",
          value: stats.cost,
          unit: "USD",
          timestamp,
          labels: { provider, type: "cost" },
        });
        metrics.push({
          name: "provider_requests",
          value: stats.requests,
          unit: "requests",
          timestamp,
          labels: { provider, type: "requests" },
        });
      }
    }

    return metrics;
  }
}