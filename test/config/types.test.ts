import { describe, it, expect } from "vitest";
import {
  appConfigSchema,
  sourceConfigSchema,
  channelConfigSchema,
  alertRuleSchema,
  validateAppConfig,
  validateSourceConfig,
  validateChannelConfig,
  validateAlertRule,
} from "../../src/config/schema";
import type { AppConfig, SourceConfig, ChannelConfig, AlertRule, AlertSeverity } from "../../src/config/types";

describe("Config types and schemas", () => {
  describe("Valid configs", () => {
    it("parses valid AppConfig", () => {
      const config: AppConfig = {
        sources: [
          {
            id: "cf-billing-1",
            type: "cloudflare-billing",
            enabled: true,
            priority: 1,
            config: { accountId: "test-account" },
            thresholds: [
              { metric: "total_cost", operator: "gt", value: 100, severity: "warning" },
            ],
          },
        ],
        channels: [
          { id: "slack-1", type: "slack", enabled: true, config: { webhookUrl: "https://hooks.slack.com/xxx" } },
        ],
        rules: [
          { sourceId: "cf-billing-1", channelIds: ["slack-1"] },
        ],
      };

      const result = validateAppConfig(config);
      expect(result).toEqual(config);
    });

    it("parses valid SourceConfig", () => {
      const config: SourceConfig = {
        id: "test-source",
        type: "gcp-billing",
        enabled: true,
        priority: 5,
        config: { projectId: "test-project" },
        thresholds: [],
      };

      const result = validateSourceConfig(config);
      expect(result).toEqual(config);
    });

    it("parses valid ChannelConfig", () => {
      const config: ChannelConfig = {
        id: "test-channel",
        type: "webhook",
        enabled: true,
        config: { url: "https://example.com/webhook", secret: "secret" },
      };

      const result = validateChannelConfig(config);
      expect(result).toEqual(config);
    });

    it("parses valid AlertRule", () => {
      const config: AlertRule = {
        sourceId: "source-1",
        channelIds: ["channel-1", "channel-2"],
        severityFilter: ["warning", "critical"] as AlertSeverity[],
      };

      const result = validateAlertRule(config);
      expect(result).toEqual(config);
    });

    it("applies defaults for optional fields", () => {
      const source = validateSourceConfig({ id: "s1", type: "anyrouter" });
      expect(source.enabled).toBe(true);
      expect(source.priority).toBe(0);
      expect(source.config).toEqual({});
      expect(source.thresholds).toEqual([]);

      const channel = validateChannelConfig({ id: "c1", type: "telegram" });
      expect(channel.enabled).toBe(true);
      expect(channel.config).toEqual({});

      const rule = validateAlertRule({ sourceId: "s1", channelIds: ["c1"] });
      expect(rule.severityFilter).toBeUndefined();
    });
  });

  describe("Invalid configs", () => {
    it("rejects AppConfig with invalid source", () => {
      expect(() => validateAppConfig({ sources: [{ id: "s1", type: "invalid" }], channels: [], rules: [] })).toThrow();
    });

    it("rejects SourceConfig with invalid type", () => {
      expect(() =>
        validateSourceConfig({ id: "s1", type: "invalid-type" })
      ).toThrow(/type/);
    });

    it("rejects SourceConfig with missing id", () => {
      expect(() =>
        validateSourceConfig({ type: "cloudflare-billing" })
      ).toThrow(/id/);
    });

    it("rejects ChannelConfig with invalid type", () => {
      expect(() =>
        validateChannelConfig({ id: "c1", type: "invalid-type" })
      ).toThrow(/type/);
    });

    it("rejects AlertRule with empty channelIds", () => {
      expect(() =>
        validateAlertRule({ sourceId: "s1", channelIds: [] })
      ).toThrow(/channelIds/);
    });

    it("rejects invalid threshold operator", () => {
      const config = {
        id: "s1",
        type: "cloudflare-billing" as const,
        thresholds: [{ metric: "cost", operator: "invalid", value: 100, severity: "warning" as const }],
      };
      expect(() => validateSourceConfig(config)).toThrow(/operator/);
    });

    it("rejects invalid severity", () => {
      const config = {
        id: "s1",
        type: "cloudflare-billing" as const,
        thresholds: [{ metric: "cost", operator: "gt", value: 100, severity: "invalid" }],
      };
      expect(() => validateSourceConfig(config)).toThrow(/severity/);
    });
  });

  describe("Zod error messages include field paths", () => {
    it("includes field path for nested source config error", () => {
      try {
        validateAppConfig({
          sources: [{ id: "s1", type: "invalid-type" }],
          channels: [],
          rules: [],
        });
        throw new Error("should have thrown");
      } catch (e) {
        const error = e as Error;
        const parsed = JSON.parse(error.message);
        expect(parsed[0].path).toEqual(["sources", 0, "type"]);
      }
    });

    it("includes field path for nested threshold error", () => {
      try {
        validateAppConfig({
          sources: [
            {
              id: "s1",
              type: "cloudflare-billing",
              thresholds: [{ metric: "cost", operator: "invalid", value: 100, severity: "warning" }],
            },
          ],
          channels: [],
          rules: [],
        });
        throw new Error("should have thrown");
      } catch (e) {
        const error = e as Error;
        const parsed = JSON.parse(error.message);
        expect(parsed[0].path).toEqual(["sources", 0, "thresholds", 0, "operator"]);
      }
    });

    it("includes field path for channel config error", () => {
      try {
        validateAppConfig({
          sources: [],
          channels: [{ id: "c1", type: "invalid-type" }],
          rules: [],
        });
        throw new Error("should have thrown");
      } catch (e) {
        const error = e as Error;
        const parsed = JSON.parse(error.message);
        expect(parsed[0].path).toEqual(["channels", 0, "type"]);
      }
    });

    it("includes field path for rule error", () => {
      try {
        validateAppConfig({
          sources: [],
          channels: [],
          rules: [{ sourceId: "s1", channelIds: [] }],
        });
        throw new Error("should have thrown");
      } catch (e) {
        const error = e as Error;
        const parsed = JSON.parse(error.message);
        expect(parsed[0].path).toEqual(["rules", 0, "channelIds"]);
      }
    });
  });
});