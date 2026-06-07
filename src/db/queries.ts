import type { DbClient } from "./client";
import { alertHistory, alertChannels, sourceConfig, webhookEvents } from "./schema";
import { eq, desc, and } from "drizzle-orm";
import type { NewAlertHistory, NewAlertChannel, NewSourceConfig, NewWebhookEvent } from "./schema";

export async function writeAlertHistory(db: DbClient, alert: NewAlertHistory) {
  return db.insert(alertHistory).values(alert);
}

export async function updateDeliveryStatus(
  db: DbClient,
  alertId: string,
  status: "sent" | "failed" | "partial",
  channelResults: Array<{ channelId: string; status: "sent" | "failed"; error?: string }>
) {
  const results = await db.select().from(alertHistory).where(eq(alertHistory.id, alertId)).limit(1);
  if (results.length === 0) return;

  // TypeScript doesn't narrow array element types after length check
  // Use a helper to get the first element with proper type
  const getFirst = <T>(arr: T[]): T | undefined => arr[0];
  const firstAlert = getFirst(results);
  if (!firstAlert) return;

  const channels: string = firstAlert.channels ?? "[]";
  const existingChannels = JSON.parse(channels);
  const updatedChannels = existingChannels.map((ch: string) => {
    const result = channelResults.find((r) => r.channelId === ch);
    return result ? { id: ch, status: result.status, error: result.error } : { id: ch, status: "pending" };
  });

  const allSent = channelResults.every((r) => r.status === "sent");
  const anyFailed = channelResults.some((r) => r.status === "failed");

  return db
    .update(alertHistory)
    .set({
      status: allSent ? "sent" : anyFailed ? "failed" : "partial",
      sentAt: Date.now(),
      channels: JSON.stringify(updatedChannels),
    })
    .where(eq(alertHistory.id, alertId));
}

export async function getAlertHistory(db: DbClient, limit = 100, offset = 0) {
  return db.select().from(alertHistory).orderBy(desc(alertHistory.createdAt)).limit(limit).offset(offset);
}

export async function getAlertById(db: DbClient, id: string) {
  const result = await db.select().from(alertHistory).where(eq(alertHistory.id, id)).limit(1);
  return result[0];
}

export async function createAlertChannel(db: DbClient, channel: NewAlertChannel) {
  return db.insert(alertChannels).values(channel);
}

export async function getAlertChannels(db: DbClient) {
  return db.select().from(alertChannels);
}

export async function getAlertChannelById(db: DbClient, id: string) {
  const result = await db.select().from(alertChannels).where(eq(alertChannels.id, id)).limit(1);
  return result[0];
}

export async function updateAlertChannel(db: DbClient, id: string, config: Partial<NewAlertChannel>) {
  return db
    .update(alertChannels)
    .set({ ...config, updatedAt: Date.now() })
    .where(eq(alertChannels.id, id));
}

export async function deleteAlertChannel(db: DbClient, id: string) {
  return db.delete(alertChannels).where(eq(alertChannels.id, id));
}

export async function createSourceConfig(db: DbClient, source: NewSourceConfig) {
  return db.insert(sourceConfig).values(source);
}

export async function getSourceConfigs(db: DbClient) {
  return db.select().from(sourceConfig);
}

export async function getSourceConfigById(db: DbClient, id: string) {
  const result = await db.select().from(sourceConfig).where(eq(sourceConfig.id, id)).limit(1);
  return result[0];
}

export async function updateSourceConfig(db: DbClient, id: string, config: Partial<NewSourceConfig>) {
  return db
    .update(sourceConfig)
    .set({ ...config, updatedAt: Date.now() })
    .where(eq(sourceConfig.id, id));
}

export async function deleteSourceConfig(db: DbClient, id: string) {
  return db.delete(sourceConfig).where(eq(sourceConfig.id, id));
}

export async function createWebhookEvent(db: DbClient, event: NewWebhookEvent) {
  return db.insert(webhookEvents).values(event);
}

export async function getWebhookEvent(db: DbClient, id: string) {
  const result = await db.select().from(webhookEvents).where(eq(webhookEvents.id, id)).limit(1);
  return result[0];
}

export async function getUnprocessedWebhookEvents(db: DbClient, limit = 100) {
  return db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.processed, false))
    .orderBy(webhookEvents.receivedAt)
    .limit(limit);
}

export async function markWebhookEventProcessed(db: DbClient, id: string, error?: string) {
  return db
    .update(webhookEvents)
    .set({
      processed: true,
      processedAt: Date.now(),
      error: error ?? null,
    })
    .where(eq(webhookEvents.id, id));
}

export async function getWebhookEventsBySource(db: DbClient, source: string, limit = 100, offset = 0) {
  return db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.source, source))
    .orderBy(desc(webhookEvents.receivedAt))
    .limit(limit)
    .offset(offset);
}