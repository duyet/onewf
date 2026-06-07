# Configuration Reference

Complete configuration reference for onewf.

## Configuration Layers

1. **TypeScript Config** (`src/config/app.config.ts`) - Base configuration, deployed with worker
2. **KV Overrides** (`CONFIG_KV` namespace) - Runtime overrides, higher priority
3. **Secrets** (Workers Secrets) - Sensitive values (API keys, tokens)

Priority: KV > TypeScript > Defaults

## TypeScript Configuration

### AppConfig Structure

```typescript
interface AppConfig {
  sources: SourceConfig[];
  channels: ChannelConfig[];
  rules: AlertRule[];
}
```

### SourceConfig

```typescript
interface SourceConfig {
  id: string;                    // Unique identifier
  type: SourceType;              // "cloudflare-billing" | "gcp-billing" | "anyrouter"
  enabled: boolean;              // Default: true
  priority: number;              // Default: 0 (higher = runs first)
  config: Record<string, unknown>; // Source-specific config
  thresholds: ThresholdConfig[]; // Alert thresholds
}

interface ThresholdConfig {
  metric: string;                // Metric name to evaluate
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number;                 // Threshold value
  severity: AlertSeverity;       // "info" | "warning" | "critical"
}
```

#### Cloudflare Billing Source

```typescript
{
  id: "cf-billing-1",
  type: "cloudflare-billing",
  enabled: true,
  priority: 10,
  config: {
    accountId: "your-account-id"  // Required
  },
  thresholds: [
    { metric: "billing_cost", operator: "gt", value: 100, severity: "warning" },
    { metric: "billing_cost", operator: "gt", value: 500, severity: "critical" }
  ]
}
```

**Required Secrets**: `CF_API_TOKEN` (Cloudflare API token with Billing read permission)

#### AnyRouter Source

```typescript
{
  id: "anyrouter-1",
  type: "anyrouter",
  enabled: true,
  priority: 20,
  config: {
    apiKey: "",                    // Required
    baseUrl: "https://api.anyrouter.dev"  // Optional
  },
  thresholds: [
    { metric: "total_cost", operator: "gt", value: 50, severity: "warning" },
    { metric: "total_cost", operator: "gt", value: 200, severity: "critical" },
    { metric: "total_requests", operator: "gt", value: 10000, severity: "warning" }
  ]
}
```

**Required Secrets**: `ANYROUTER_API_KEY` (AnyRouter admin API key)

**Available Metrics**:
- `total_cost` - Total cost in USD
- `total_requests` - Total API requests
- `total_tokens` - Total tokens consumed
- `provider_cost` - Cost per provider (with `provider` label)
- `provider_requests` - Requests per provider

#### GCP Billing Source

```typescript
{
  id: "gcp-billing-1",
  type: "gcp-billing",
  enabled: true,
  priority: 30,
  config: {
    projectId: "your-project-id",           // Required
    serviceAccountJson: "",                 // Required (full JSON)
    billingAccountId: "optional-billing-id" // Optional
  },
  thresholds: [
    { metric: "billing_enabled", operator: "eq", value: 0, severity: "critical" }
  ]
}
```

**Required Secrets**: `GCP_SERVICE_ACCOUNT_JSON` (Service account JSON with Cloud Billing Viewer role)

**Available Metrics**:
- `billing_enabled` - 1 if billing enabled, 0 if disabled
- `billing_account` - Billing account name (with `account` label)

---

### ChannelConfig

```typescript
interface ChannelConfig {
  id: string;                           // Unique identifier
  type: ChannelType;                    // "slack" | "telegram" | "webhook"
  enabled: boolean;                     // Default: true
  config: Record<string, unknown>;      // Channel-specific config
}
```

#### Slack Channel

```typescript
{
  id: "slack-1",
  type: "slack",
  enabled: true,
  config: {
    webhookUrl: "https://hooks.slack.com/services/...",  // Required
    channel: "#alerts",                // Optional: override channel
    username: "onewf",                 // Optional: bot username
    iconEmoji: ":warning:"             // Optional: emoji icon
  }
}
```

**Required Secrets**: `SLACK_WEBHOOK_URL`

**Features**:
- Block Kit formatting with severity emojis
- Metrics as formatted fields
- Supports channel override

#### Telegram Channel

```typescript
{
  id: "telegram-1",
  type: "telegram",
  enabled: true,
  config: {
    botToken: "123456:ABC-DEF...",    // Required
    chatId: "-1001234567890",         // Required (can be negative for groups)
    parseMode: "Markdown"              // Optional: "Markdown" | "HTML"
  }
}
```

**Required Secrets**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

**Features**:
- Markdown formatting
- Silent notifications for info severity
- Severity emojis

#### Webhook Channel

```typescript
{
  id: "webhook-1",
  type: "webhook",
  enabled: true,
  config: {
    url: "https://your-endpoint.com/alerts",  // Required
    secret: "your-hmac-secret",               // Required for HMAC
    timeoutMs: 10000,                         // Optional: default 10000
    headers: {                                // Optional: custom headers
      "X-Custom-Header": "value"
    }
  }
}
```

**Required Secrets**: `WEBHOOK_URL`, `WEBHOOK_SECRET`

**Features**:
- HMAC-SHA256 signature (`X-Webhook-Signature: sha256=...`)
- JSON payload with alert + metadata
- Configurable timeout
- Custom headers support

**Payload Format**:
```json
{
  "alert": {
    "id": "alert-123",
    "sourceId": "cf-billing-1",
    "severity": "warning",
    "title": "billing_cost gt 100",
    "description": "Metric billing_cost (150 USD) exceeds threshold 100",
    "timestamp": 1234567890,
    "metrics": [
      { "name": "billing_cost", "value": 150, "unit": "USD", "timestamp": 1234567890 }
    ]
  },
  "metadata": {
    "instanceId": "alert-123",
    "workflowName": "AlertDispatchWorkflow",
    "timestamp": 1234567890
  }
}
```

**Verification**:
```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

---

### AlertRule

```typescript
interface AlertRule {
  sourceId: string;              // Source to monitor
  channelIds: string[];          // Channels to notify (at least 1)
  severityFilter?: AlertSeverity[]; // Optional: only notify for these severities
}
```

```typescript
// Notify all channels for all severities
{ sourceId: "cf-billing-1", channelIds: ["slack-1", "telegram-1"] }

// Only notify Slack for warning/critical
{ sourceId: "anyrouter-1", channelIds: ["slack-1", "webhook-1"], severityFilter: ["warning", "critical"] }
```

---

## KV Override Format

Store in `CONFIG_KV` namespace:

```bash
# Sources
wrangler kv:key put --binding=CONFIG_KV "sources" '[{"id":"cf-billing-1","type":"cloudflare-billing","enabled":true,"config":{"accountId":"new-id"},"thresholds":[{"metric":"billing_cost","operator":"gt","value":200,"severity":"warning"}]}]'

# Channels
wrangler kv:key put --binding=CONFIG_KV "channels" '[{"id":"slack-1","type":"slack","enabled":true,"config":{"webhookUrl":"https://hooks.slack.com/new","channel":"#new-channel"}}]'

# Rules
wrangler kv:key put --binding=CONFIG_KV "rules" '[{"sourceId":"cf-billing-1","channelIds":["slack-1"]}]'
```

---

## Secrets Reference

| Secret | Required For | Description |
|--------|--------------|-------------|
| `CF_API_TOKEN` | Cloudflare Billing | Cloudflare API token with Account Billing read |
| `ANYROUTER_API_KEY` | AnyRouter | AnyRouter admin API key |
| `GCP_SERVICE_ACCOUNT_JSON` | GCP Billing | Full service account JSON |
| `SLACK_WEBHOOK_URL` | Slack | Incoming webhook URL |
| `TELEGRAM_BOT_TOKEN` | Telegram | Bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Telegram | Chat/Group ID |
| `WEBHOOK_URL` | Webhook | Target URL |
| `WEBHOOK_SECRET` | Webhook | HMAC secret |

---

## Environment Variables

No environment variables required. All configuration via:
- TypeScript config (deployed)
- KV overrides (runtime)
- Workers Secrets (sensitive)

---

## Validation

All configs validated on load with Zod schemas. Invalid configs throw with field paths:

```
ZodError: [
  {
    "path": ["sources", 0, "config", "accountId"],
    "message": "Required"
  }
]
```