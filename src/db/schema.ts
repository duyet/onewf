import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const alertHistory = sqliteTable("alert_history", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  severity: text("severity", { enum: ["info", "warning", "critical"] }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  cost: integer("cost"),
  currency: text("currency"),
  thresholdValue: integer("threshold_value"),
  thresholdOperator: text("threshold_operator"),
  channels: text("channels").notNull(), // JSON array of channel IDs
  status: text("status", { enum: ["pending", "sent", "failed", "partial"] }).notNull().default("pending"),
  sentAt: integer("sent_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => ({
  sourceIdx: index("idx_alert_history_source").on(table.sourceId),
  sentAtIdx: index("idx_alert_history_sent_at").on(table.sentAt),
  statusIdx: index("idx_alert_history_status").on(table.status),
}));

export const alertChannels = sqliteTable("alert_channels", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["slack", "telegram", "webhook"] }).notNull(),
  config: text("config").notNull(), // JSON config
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => ({
  typeIdx: index("idx_alert_channels_type").on(table.type),
}));

export const sourceConfig = sqliteTable("source_config", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["cloudflare-billing", "gcp-billing", "anyrouter"] }).notNull(),
  config: text("config").notNull(), // JSON config
  thresholds: text("thresholds").notNull(), // JSON thresholds
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  source: text("source").notNull(), // clerk, gcp, generic, etc.
  eventType: text("event_type").notNull(), // user.created, billing.updated, etc.
  payload: text("payload").notNull(), // JSON string of the full payload
  headers: text("headers"), // JSON string of relevant headers
  signature: text("signature"), // Webhook signature for verification
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  processed: integer("processed", { mode: "boolean" }).notNull().default(false),
  error: text("error"), // Processing error if any
  receivedAt: integer("received_at").notNull(),
  processedAt: integer("processed_at"),
}, (table) => ({
  sourceIdx: index("idx_webhook_events_source").on(table.source),
  eventTypeIdx: index("idx_webhook_events_event_type").on(table.eventType),
  receivedAtIdx: index("idx_webhook_events_received_at").on(table.receivedAt),
  processedIdx: index("idx_webhook_events_processed").on(table.processed),
}));

export type AlertHistory = typeof alertHistory.$inferSelect;
export type NewAlertHistory = typeof alertHistory.$inferInsert;
export type AlertChannel = typeof alertChannels.$inferSelect;
export type NewAlertChannel = typeof alertChannels.$inferInsert;
export type SourceConfig = typeof sourceConfig.$inferSelect;
export type NewSourceConfig = typeof sourceConfig.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;