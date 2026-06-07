-- Add webhook_events table for incoming webhook processing

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  headers TEXT,
  signature TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER
);

CREATE INDEX idx_webhook_events_source ON webhook_events(source);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);