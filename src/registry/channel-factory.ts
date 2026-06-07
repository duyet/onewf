import type { AlertChannel } from "../channels/types";
import type { ChannelConfig } from "../config/types";
import { SlackChannel, type SlackConfig } from "../channels/slack";
import { TelegramChannel, type TelegramConfig } from "../channels/telegram";
import { WebhookChannel, type WebhookConfig } from "../channels/webhook";
import type { Env } from "../index";

export function createChannel(config: ChannelConfig, env: Env): AlertChannel {
  switch (config.type) {
    case "slack":
      return new SlackChannel(config.config as SlackConfig);
    case "telegram":
      return new TelegramChannel(config.config as TelegramConfig);
    case "webhook":
      return new WebhookChannel(config.config as WebhookConfig);
    default:
      throw new Error(`Unknown channel type: ${config.type}`);
  }
}