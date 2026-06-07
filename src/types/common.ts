export type Timestamp = number;
export type CostValue = { amount: number; currency: string };
export type Threshold = {
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number;
  severity: "info" | "warning" | "critical";
};

export interface WorkflowInstanceId {
  value: string;
  sourceId: string;
  scheduledTime: number;
}

export interface StepResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

export function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = Math.min(config.baseDelayMs * Math.pow(2, attempt), config.maxDelayMs);
  return delay + Math.random() * 1000;
}