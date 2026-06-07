import { describe, it, expect } from "vitest";
import type { MetricsAdapter, FetchParams, SourceType } from "../../src/adapters/types";
import type { AlertChannel, Alert, AlertSeverity, ChannelType, Threshold } from "../../src/channels/types";
import type { MetricData } from "../../src/config/types";
import { calculateBackoff, type Timestamp, type CostValue, type RetryConfig } from "../../src/types/common";

describe("Core type definitions", () => {
  describe("MetricsAdapter interface", () => {
    it("enforces required properties and methods", () => {
      const mockAdapter: MetricsAdapter = {
        name: "test-adapter",
        type: "cloudflare-billing",
        priority: 1,
        fetchMetrics: async (params: FetchParams): Promise<MetricData[]> => {
          return [{ name: "test", value: 1, unit: "USD", timestamp: Date.now() }];
        },
        validateConfig: (config: Record<string, unknown>): boolean => {
          return !!config.accountId;
        },
      };

      expect(mockAdapter.name).toBe("test-adapter");
      expect(mockAdapter.type).toBe("cloudflare-billing");
      expect(mockAdapter.priority).toBe(1);
      expect(typeof mockAdapter.fetchMetrics).toBe("function");
      expect(typeof mockAdapter.validateConfig).toBe("function");
    });

    it("allows optional normalize method", () => {
      const mockAdapter: MetricsAdapter = {
        name: "test-adapter",
        type: "gcp-billing",
        priority: 2,
        fetchMetrics: async (): Promise<MetricData[]> => [],
        validateConfig: (): boolean => true,
        normalize: (data: unknown): MetricData[] => {
          return [];
        },
      };

      expect(typeof mockAdapter.normalize).toBe("function");
    });

    it("accepts generic config type", () => {
      interface CustomConfig extends Record<string, unknown> {
        apiKey: string;
        projectId: string;
      }

      const mockAdapter: MetricsAdapter<CustomConfig> = {
        name: "custom-adapter",
        type: "anyrouter",
        priority: 3,
        fetchMetrics: async (): Promise<MetricData[]> => [],
        validateConfig: (config: CustomConfig): boolean => {
          return !!config.apiKey && !!config.projectId;
        },
      };

      expect(mockAdapter.validateConfig({ apiKey: "key", projectId: "proj" })).toBe(true);
      expect(mockAdapter.validateConfig({ apiKey: "", projectId: "proj" })).toBe(false);
    });
  });

  describe("AlertChannel interface", () => {
    it("enforces required properties and methods", () => {
      const mockChannel: AlertChannel = {
        name: "test-channel",
        type: "slack",
        send: async (alert: Alert, config: Record<string, unknown>): Promise<void> => {
          return;
        },
        formatMessage: (alert: Alert): string => {
          return `Alert: ${alert.title}`;
        },
        validateConfig: (config: Record<string, unknown>): boolean => {
          return !!config.webhookUrl;
        },
      };

      expect(mockChannel.name).toBe("test-channel");
      expect(mockChannel.type).toBe("slack");
      expect(typeof mockChannel.send).toBe("function");
      expect(typeof mockChannel.formatMessage).toBe("function");
      expect(typeof mockChannel.validateConfig).toBe("function");
    });

    it("accepts generic config type", () => {
      interface SlackConfig extends Record<string, unknown> {
        webhookUrl: string;
        channel?: string;
      }

      const mockChannel: AlertChannel<SlackConfig> = {
        name: "slack-channel",
        type: "slack",
        send: async (): Promise<void> => {},
        formatMessage: (alert: Alert): string => alert.title,
        validateConfig: (config: SlackConfig): boolean => !!config.webhookUrl,
      };

      expect(mockChannel.validateConfig({ webhookUrl: "https://hooks.slack.com/xxx" })).toBe(true);
      expect(mockChannel.validateConfig({ webhookUrl: "" })).toBe(false);
    });
  });

  describe("Alert type", () => {
    it("includes all required fields", () => {
      const alert: Alert = {
        id: "alert-123",
        sourceId: "cf-billing-1",
        severity: "warning",
        title: "High billing alert",
        description: "Monthly bill exceeded $100",
        timestamp: Date.now(),
        metrics: [
          { name: "total_cost", value: 150, unit: "USD", timestamp: Date.now() },
        ],
      };

      expect(alert.id).toBe("alert-123");
      expect(alert.sourceId).toBe("cf-billing-1");
      expect(alert.severity).toBe("warning");
      expect(alert.title).toBe("High billing alert");
      expect(alert.description).toBe("Monthly bill exceeded $100");
      expect(typeof alert.timestamp).toBe("number");
      expect(alert.metrics).toHaveLength(1);
      const metric = alert.metrics[0];
      expect(metric).toBeDefined();
      if (metric) {
        expect(metric.name).toBe("total_cost");
        expect(metric.value).toBe(150);
      }
    });

    it("supports all severity levels", () => {
      const severities: AlertSeverity[] = ["info", "warning", "critical"];

      for (const severity of severities) {
        const alert: Alert = {
          id: "alert-1",
          sourceId: "test",
          severity,
          title: "Test",
          description: "Test",
          timestamp: Date.now(),
          metrics: [],
        };
        expect(alert.severity).toBe(severity);
      }
    });
  });

  describe("SourceType and ChannelType", () => {
    it("defines valid source types", () => {
      const sourceTypes: SourceType[] = ["cloudflare-billing", "gcp-billing", "anyrouter"];
      expect(sourceTypes).toHaveLength(3);
    });

    it("defines valid channel types", () => {
      const channelTypes: ChannelType[] = ["slack", "telegram", "webhook"];
      expect(channelTypes).toHaveLength(3);
    });
  });

  describe("Threshold type", () => {
    it("includes all required fields", () => {
      const threshold: Threshold = {
        metric: "total_cost",
        operator: "gt",
        value: 100,
        severity: "warning",
      };

      expect(threshold.metric).toBe("total_cost");
      expect(threshold.operator).toBe("gt");
      expect(threshold.value).toBe(100);
      expect(threshold.severity).toBe("warning");
    });

    it("supports all operators", () => {
      const operators = ["gt", "gte", "lt", "lte", "eq"] as const;
      for (const op of operators) {
        const threshold: Threshold = {
          metric: "test",
          operator: op,
          value: 1,
          severity: "info",
        };
        expect(threshold.operator).toBe(op);
      }
    });
  });

  describe("Common types", () => {
    it("Timestamp is a number", () => {
      const ts: Timestamp = Date.now();
      expect(typeof ts).toBe("number");
    });

    it("CostValue has amount and currency", () => {
      const cost: CostValue = { amount: 99.99, currency: "USD" };
      expect(cost.amount).toBe(99.99);
      expect(cost.currency).toBe("USD");
    });

    it("calculateBackoff returns increasing delays", () => {
      const config = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000 };
      const delay1 = calculateBackoff(0, config);
      const delay2 = calculateBackoff(1, config);
      const delay3 = calculateBackoff(2, config);

      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(30000 + 1000);
    });
  });
});