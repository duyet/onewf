-- Initial migration for onalert
-- Creates tables for alert history, alert channels, and source config

CREATE TABLE alert_history (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cost INTEGER,
  currency TEXT,
  threshold_value INTEGER,
  threshold_operator TEXT,
  channels TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'partial')) DEFAULT 'pending',
  sent_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE alert_channels (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('slack', 'telegram', 'webhook')),
  config TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE source_config (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('cloudflare-billing', 'gcp-billing', 'anyrouter')),
  config TEXT NOT NULL,
  thresholds TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for alert_history
CREATE INDEX idx_alert_history_source ON alert_history(source_id);
CREATE INDEX idx_alert_history_sent_at ON alert_history(sent_at);
CREATE INDEX idx_alert_history_status ON alert_history(status);

-- Index for alert_channels
CREATE INDEX idx_alert_channels_type ON alert_channels(type);