import { z } from "zod";
import type {
  SourceConfig,
  ChannelConfig,
  AlertRule,
  AppConfig,
  ThresholdConfig,
} from "./types";

export const alertSeveritySchema = z.enum(["info", "warning", "critical"]);

export const thresholdConfigSchema = z.object({
  metric: z.string().min(1, "metric is required"),
  operator: z.enum(["gt", "gte", "lt", "lte", "eq"]),
  value: z.number(),
  severity: alertSeveritySchema,
});

export const sourceConfigSchema = z.object({
  id: z.string().min(1, "source id is required"),
  type: z.enum(["cloudflare-billing", "gcp-billing", "anyrouter"]),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
  config: z.record(z.string(), z.unknown()).default({}),
  thresholds: z.array(thresholdConfigSchema).default([]),
});

export const channelConfigSchema = z.object({
  id: z.string().min(1, "channel id is required"),
  type: z.enum(["slack", "telegram", "webhook"]),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const alertRuleSchema = z.object({
  sourceId: z.string().min(1, "sourceId is required"),
  channelIds: z.array(z.string().min(1)).min(1, "at least one channelId required"),
  severityFilter: z.array(alertSeveritySchema).optional(),
});

export const appConfigSchema = z.object({
  sources: z.array(sourceConfigSchema).default([]),
  channels: z.array(channelConfigSchema).default([]),
  rules: z.array(alertRuleSchema).default([]),
});

export function validateAppConfig(config: unknown): AppConfig {
  return appConfigSchema.parse(config);
}

export function validateSourceConfig(config: unknown): SourceConfig {
  return sourceConfigSchema.parse(config);
}

export function validateChannelConfig(config: unknown): ChannelConfig {
  return channelConfigSchema.parse(config);
}

export function validateAlertRule(config: unknown): AlertRule {
  return alertRuleSchema.parse(config);
}