import type { MetricsAdapter, FetchParams, MetricData, SourceType } from "./types";

export abstract class BaseMetricsAdapter<TConfig extends Record<string, unknown> = Record<string, unknown>> implements MetricsAdapter<TConfig> {
  abstract readonly name: string;
  abstract readonly type: SourceType;
  abstract readonly priority: number;

  abstract fetchMetrics(params: FetchParams): Promise<MetricData[]>;
  abstract validateConfig(config: TConfig): boolean;

  protected config: TConfig;

  constructor(config: TConfig) {
    this.config = config;
  }

  protected async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    maxRetries = 3,
    baseDelayMs = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          if (response.status === 429 && attempt < maxRetries) {
            const delay = baseDelayMs * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error("Max retries exceeded");
  }
}