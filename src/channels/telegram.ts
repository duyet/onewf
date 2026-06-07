import type { Alert, ChannelType } from "./types";
import { BaseAlertChannel } from "./base";

export interface TelegramConfig extends Record<string, unknown> {
  botToken: string;
  chatId: string;
  parseMode?: "Markdown" | "HTML";
}

export class TelegramChannel extends BaseAlertChannel<TelegramConfig> {
  readonly name = "telegram";
  readonly type: ChannelType = "telegram";

  validateConfig(config: TelegramConfig): boolean {
    return !!config.botToken && !!config.chatId;
  }

  formatMessage(alert: Alert): string {
    const severityEmoji = {
      info: "ℹ️",
      warning: "⚠️",
      critical: "🚨",
    };

    const metricsText = alert.metrics
      .map((m) => `• *${m.name}*: \`${m.value} ${m.unit}\``)
      .join("\n");

    return [
      `${severityEmoji[alert.severity]} *${alert.title}*`,
      "",
      `*Source:* ${alert.sourceId}`,
      `*Severity:* ${alert.severity.toUpperCase()}`,
      `*Time:* ${new Date(alert.timestamp).toLocaleString()}`,
      "",
      alert.description,
      "",
      metricsText ? `*Metrics:*\n${metricsText}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async send(alert: Alert, config: TelegramConfig): Promise<void> {
    const message = this.formatMessage(alert);
    const disableNotification = alert.severity === "info";

    await this.sendWithRetry(alert, async () => {
      const response = await fetch(
        `https://api.telegram.org/bot${config.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: config.chatId,
            text: message,
            parse_mode: config.parseMode || "Markdown",
            disable_notification: disableNotification,
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Telegram API failed: ${response.status} ${text}`);
      }
    });
  }
}