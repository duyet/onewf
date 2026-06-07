import type { Alert, ChannelType } from "./types";
import { BaseAlertChannel } from "./base";

export interface SlackConfig extends Record<string, unknown> {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export class SlackChannel extends BaseAlertChannel<SlackConfig> {
  readonly name = "slack";
  readonly type: ChannelType = "slack";

  validateConfig(config: SlackConfig): boolean {
    return !!config.webhookUrl && config.webhookUrl.startsWith("https://");
  }

  formatMessage(alert: Alert): string {
    const severityEmoji = {
      info: ":information_source:",
      warning: ":warning:",
      critical: ":rotating_light:",
    };

    const fields = alert.metrics.map((m) => ({
      title: m.name,
      value: `${m.value} ${m.unit}`,
      short: true,
    }));

    return JSON.stringify({
      text: `${severityEmoji[alert.severity]} ${alert.title}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${severityEmoji[alert.severity]} ${alert.title}`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Source:*\n${alert.sourceId}`,
            },
            {
              type: "mrkdwn",
              text: `*Severity:*\n${alert.severity.toUpperCase()}`,
            },
            {
              type: "mrkdwn",
              text: `*Time:*\n<@${new Date(alert.timestamp).toISOString()}|${new Date(alert.timestamp).toLocaleString()}>`,
            },
            ...fields.flatMap((f) => [
              { type: "mrkdwn", text: `*${f.title}:*\n${f.value}` },
            ]),
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: alert.description,
          },
        },
      ],
    });
  }

  async send(alert: Alert, config: SlackConfig): Promise<void> {
    const message = this.formatMessage(alert);
    const payload = JSON.parse(message);

    if (config.channel) payload.channel = config.channel;
    if (config.username) payload.username = config.username;
    if (config.iconEmoji) payload.icon_emoji = config.iconEmoji;

    await this.sendWithRetry(alert, async () => {
      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Slack webhook failed: ${response.status} ${text}`);
      }
    });
  }
}