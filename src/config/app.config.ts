import type { AppConfig, SourceConfig, ChannelConfig, AlertRule } from "./types";

const config: AppConfig = {
  sources: [
    {
      id: "cf-billing-1",
      type: "cloudflare-billing",
      enabled: true,
      priority: 10,
      config: {
        accountId: "",
      },
      thresholds: [
        { metric: "billing_cost", operator: "gt", value: 100, severity: "warning" },
        { metric: "billing_cost", operator: "gt", value: 500, severity: "critical" },
      ],
    },
    {
      id: "anyrouter-1",
      type: "anyrouter",
      enabled: true,
      priority: 20,
      config: {
        apiKey: "",
        baseUrl: "https://api.anyrouter.dev",
      },
      thresholds: [
        { metric: "total_cost", operator: "gt", value: 50, severity: "warning" },
        { metric: "total_cost", operator: "gt", value: 200, severity: "critical" },
      ],
    },
    {
      id: "gcp-billing-1",
      type: "gcp-billing",
      enabled: true,
      priority: 30,
      config: {
        projectId: "",
        serviceAccountJson: "",
      },
      thresholds: [
        { metric: "billing_enabled", operator: "eq", value: 0, severity: "critical" },
      ],
    },
  ],
  channels: [
    {
      id: "slack-1",
      type: "slack",
      enabled: true,
      config: {
        webhookUrl: "",
        channel: "#alerts",
      },
    },
    {
      id: "telegram-1",
      type: "telegram",
      enabled: true,
      config: {
        botToken: "",
        chatId: "",
      },
    },
    {
      id: "webhook-1",
      type: "webhook",
      enabled: true,
      config: {
        url: "",
        secret: "",
      },
    },
  ],
  rules: [
    { sourceId: "cf-billing-1", channelIds: ["slack-1", "telegram-1"] },
    { sourceId: "anyrouter-1", channelIds: ["slack-1", "webhook-1"] },
    { sourceId: "gcp-billing-1", channelIds: ["slack-1"] },
  ],
};

export default config;