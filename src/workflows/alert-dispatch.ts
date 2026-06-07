import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { Env } from "../index";
import { loadConfig } from "../config/loader";
import { createChannel } from "../registry/channel-factory";
import { writeAlertHistory, updateDeliveryStatus } from "../db/queries";
import { createDbClient } from "../db/client";
import type { Alert, AlertSeverity, ChannelType } from "../channels/types";

export interface AlertDispatchParams {
  id: string;
  sourceId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: number;
  metrics: Array<{
    name: string;
    value: number;
    unit: string;
    timestamp: number;
    labels?: Record<string, string>;
  }>;
}

export class AlertDispatchWorkflow extends WorkflowEntrypoint<Env, AlertDispatchParams> {
  override async run(event: WorkflowEvent<AlertDispatchParams>, step: WorkflowStep): Promise<void> {
    const alert = event.payload as Alert;
    const config = await loadConfig(this.env);
    const db = createDbClient(this.env.DB);

    await step.do("write-history", async () => {
      await writeAlertHistory(db, {
        id: alert.id,
        sourceId: alert.sourceId,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        cost: alert.metrics[0]?.value,
        currency: alert.metrics[0]?.unit,
        channels: JSON.stringify(config.rules.find((r) => r.sourceId === alert.sourceId)?.channelIds || []),
        status: "pending",
        sentAt: 0,
        createdAt: alert.timestamp,
      });
    });

    const rule = config.rules.find((r) => r.sourceId === alert.sourceId);
    if (!rule) return;

    const enabledChannels = config.channels
      .filter((c) => c.enabled && rule.channelIds.includes(c.id))
      .map((c) => createChannel(c, this.env));

    const results: Array<{ channelId: string; status: "sent" | "failed"; error?: string }> = [];

    for (const channel of enabledChannels) {
      const channelConfig = config.channels.find((c) => c.id === channel.name);
      if (!channelConfig) continue;

      const result = await step.do(`send-${channel.name}`, async () => {
        try {
          await channel.send(alert, channelConfig.config as Record<string, unknown>);
          return { channelId: channel.name, status: "sent" as const };
        } catch (error) {
          return { channelId: channel.name, status: "failed" as const, error: String(error) };
        }
      });

      results.push(result);
    }

    await step.do("update-history", async () => {
      await updateDeliveryStatus(db, alert.id, "sent", results);
    });
  }
}