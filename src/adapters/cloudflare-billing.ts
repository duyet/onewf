import type { MetricsAdapter, FetchParams, MetricData, SourceType } from "./types";
import { BaseMetricsAdapter } from "./base";
import type { Env } from "../index";

export interface CloudflareBillingConfig extends Record<string, unknown> {
  accountId: string;
  apiToken: string;
}

export class CloudflareBillingAdapter extends BaseMetricsAdapter<CloudflareBillingConfig> {
  readonly name = "cloudflare-billing";
  readonly type: SourceType = "cloudflare-billing";
  readonly priority = 10;

  constructor(config: CloudflareBillingConfig, private env: Env) {
    super(config);
  }

  validateConfig(config: CloudflareBillingConfig): boolean {
    return !!config.accountId && !!config.apiToken;
  }

  async fetchMetrics(params: FetchParams): Promise<MetricData[]> {
    const { accountId, apiToken } = this.config;
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/billing/history`;

    const response = await this.fetchWithRetry<any>(
      url,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      },
      3,
      2000
    );

    if (!response.result || !Array.isArray(response.result)) {
      return [];
    }

    return this.normalize(response.result);
  }

  normalize(data: unknown): MetricData[] {
    const items = data as Array<{
      amount: number;
      currency: string;
      occurredAt: string;
      description: string;
    }>;

    return items.map((item) => ({
      name: "billing_cost",
      value: Math.abs(item.amount) / 100,
      unit: item.currency,
      timestamp: new Date(item.occurredAt).getTime(),
      labels: {
        description: item.description,
      },
    }));
  }
}