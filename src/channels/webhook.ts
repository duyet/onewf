import type { Alert, ChannelType } from "./types";
import { BaseAlertChannel } from "./base";

export interface WebhookConfig extends Record<string, unknown> {
  url: string;
  secret: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export class WebhookChannel extends BaseAlertChannel<WebhookConfig> {
  readonly name = "webhook";
  readonly type: ChannelType = "webhook";

  validateConfig(config: WebhookConfig): boolean {
    return !!config.url && config.url.startsWith("http") && !!config.secret;
  }

  formatMessage(alert: Alert): string {
    return JSON.stringify({
      alert: {
        id: alert.id,
        sourceId: alert.sourceId,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        timestamp: alert.timestamp,
        metrics: alert.metrics,
      },
      metadata: {
        instanceId: "",
        workflowName: "",
        timestamp: Date.now(),
      },
    });
  }

  private async generateSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", key, payloadData);
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async send(alert: Alert, config: WebhookConfig): Promise<void> {
    const payload = JSON.stringify({
      ...JSON.parse(this.formatMessage(alert)),
      metadata: {
        instanceId: alert.id,
        workflowName: "AlertDispatchWorkflow",
        timestamp: Date.now(),
      },
    });

    const signature = await this.generateSignature(payload, config.secret);

    await this.sendWithRetry(alert, async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 10000);

      try {
        const response = await fetch(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": `sha256=${signature}`,
            ...config.headers,
          },
          body: payload,
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Webhook failed: ${response.status} ${text}`);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }
}