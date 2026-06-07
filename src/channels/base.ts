import type { AlertChannel, Alert, ChannelType } from "./types";
import { createTraceContext } from "../observability";

export abstract class BaseAlertChannel<TConfig extends Record<string, unknown> = Record<string, unknown>> implements AlertChannel<TConfig> {
  abstract readonly name: string;
  abstract readonly type: ChannelType;

  abstract send(alert: Alert, config: TConfig): Promise<void>;
  abstract formatMessage(alert: Alert): string;
  abstract validateConfig(config: TConfig): boolean;

  protected config: TConfig;

  constructor(config: TConfig) {
    this.config = config;
  }

  async sendWithRetry(
    alert: Alert,
    sendFn: () => Promise<void>,
    maxRetries = 3,
    baseDelayMs = 1000
  ): Promise<void> {
    const traceContext = createTraceContext();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await sendFn();
        return;
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