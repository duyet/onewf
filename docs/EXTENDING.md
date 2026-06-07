# Extending onewf

This guide explains how to add new source adapters and alert channels to onewf.

## Adding a Source Adapter

### 1. Create the Adapter

Create a new file in `src/adapters/your-source.ts`:

```typescript
import type { MetricsAdapter, FetchParams, MetricData, SourceType } from "./types";
import { BaseMetricsAdapter } from "./base";
import type { Env } from "../index";

export interface YourSourceConfig {
  apiKey: string;
  // Add your config fields
}

export class YourSourceAdapter extends BaseMetricsAdapter<YourSourceConfig> {
  readonly name = "your-source";
  readonly type: SourceType = "your-source"; // Must match SourceType in types.ts
  readonly priority = 40; // Priority for ordering

  constructor(config: YourSourceConfig, private env: Env) {
    super(config);
  }

  validateConfig(config: YourSourceConfig): boolean {
    return !!config.apiKey;
  }

  async fetchMetrics(params: FetchParams): Promise<MetricData[]> {
    // Implement API call with retry logic
    const response = await this.fetchWithRetry<any>(
      "https://api.your-source.com/metrics",
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      }
    );

    return this.normalize(response);
  }

  normalize(data: unknown): MetricData[] {
    // Convert API response to MetricData[]
    const items = data as YourApiResponse[];
    return items.map(item => ({
      name: "metric_name",
      value: item.value,
      unit: "unit",
      timestamp: Date.now(),
      labels: { /* optional labels */ },
    }));
  }
}
```

### 2. Update SourceType

Add your source type to `src/adapters/types.ts`:

```typescript
export type SourceType = "cloudflare-billing" | "gcp-billing" | "anyrouter" | "your-source";
```

### 3. Register in Factory

Update `src/registry/adapter-factory.ts`:

```typescript
import { YourSourceAdapter } from "../adapters/your-source";

export function createAdapter(config: SourceConfig, env: Env): MetricsAdapter {
  switch (config.type) {
    // ... existing cases
    case "your-source":
      return new YourSourceAdapter(config.config as Record<string, unknown>, env);
    // ...
  }
}
```

### 4. Add Workflow

Create `src/workflows/your-source.ts`:

```typescript
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { Env } from "../index";
import { loadConfig } from "../config/loader";
import { createAdapter } from "../registry/adapter-factory";
import { evaluateAlerts } from "../utils/alert-evaluator";
import { createTraceContext } from "../observability";

export interface YourSourceParams {
  sourceId: string;
  scheduledTime: number;
}

export class YourSourceWorkflow extends WorkflowEntrypoint<Env, YourSourceParams> {
  override async run(event: WorkflowEvent<YourSourceParams>, step: WorkflowStep): Promise<void> {
    const { sourceId, scheduledTime } = event.payload;
    const traceContext = createTraceContext();

    const config = await loadConfig(this.env);
    const sourceConfig = config.sources.find((s) => s.id === sourceId);
    if (!sourceConfig || !sourceConfig.enabled) return;

    const adapter = createAdapter(sourceConfig, this.env);

    const metrics = await step.do("fetch-metrics", async () => {
      return adapter.fetchMetrics({ scheduledTime, config: sourceConfig.config });
    });

    const alerts = evaluateAlerts(metrics, sourceConfig.thresholds, sourceId);

    for (const alert of alerts) {
      await step.do(`dispatch-alert-${alert.id}`, async () => {
        await this.env.ALERT_DISPATCH.create({ id: alert.id, params: alert });
      });
    }
  }
}
```

### 5. Register Workflow

Add to `wrangler.jsonc`:

```json
{
  "name": "YOUR_SOURCE",
  "binding": "YOUR_SOURCE",
  "class_name": "YourSourceWorkflow"
}
```

Add to `src/index.ts` exports.

### 6. Add Tests

Create `test/adapters/your-source.test.ts` following existing test patterns.

---

## Adding an Alert Channel

### 1. Create the Channel

Create a new file in `src/channels/your-channel.ts`:

```typescript
import type { AlertChannel, Alert, ChannelType } from "./types";
import { BaseAlertChannel } from "./base";

export interface YourChannelConfig {
  webhookUrl: string;
  // Add your config fields
}

export class YourChannel extends BaseAlertChannel<YourChannelConfig> {
  readonly name = "your-channel";
  readonly type: ChannelType = "your-channel"; // Must match ChannelType in types.ts

  validateConfig(config: YourChannelConfig): boolean {
    return !!config.webhookUrl && config.webhookUrl.startsWith("http");
  }

  formatMessage(alert: Alert): string {
    // Format alert for your channel
    return JSON.stringify({
      text: `Alert: ${alert.title}`,
      // Your channel-specific format
    });
  }

  async send(alert: Alert, config: YourChannelConfig): Promise<void> {
    const message = this.formatMessage(alert);
    const payload = JSON.parse(message);

    await this.sendWithRetry(alert, async () => {
      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Your channel failed: ${response.status} ${text}`);
      }
    });
  }
}
```

### 2. Update ChannelType

Add to `src/channels/types.ts`:

```typescript
export type ChannelType = "slack" | "telegram" | "webhook" | "your-channel";
```

### 3. Register in Factory

Update `src/registry/channel-factory.ts`:

```typescript
import { YourChannel } from "../channels/your-channel";

export function createChannel(config: ChannelConfig, env: Env): AlertChannel {
  switch (config.type) {
    // ... existing cases
    case "your-channel":
      return new YourChannel(config.config as Record<string, unknown>);
    // ...
  }
}
```

### 4. Add Tests

Create `test/channels/your-channel.test.ts`.

---

## Configuration

After adding your adapter/channel, update `src/config/app.config.ts` with example configuration:

```typescript
// Source example
{
  id: "your-source-1",
  type: "your-source",
  enabled: true,
  config: { apiKey: "" },
  thresholds: [
    { metric: "metric_name", operator: "gt", value: 100, severity: "warning" }
  ]
}

// Channel example
{
  id: "your-channel-1",
  type: "your-channel",
  enabled: true,
  config: { webhookUrl: "" }
}
```

And add a rule linking them:

```typescript
{ sourceId: "your-source-1", channelIds: ["your-channel-1"] }
```

---

## Testing Your Extension

```bash
# Run all tests
bun test

# Run specific test file
bun test test/adapters/your-source.test.ts

# Type check
bunx tsc --noEmit

# Local dev
bun run dev
```

## Key Points

1. **Use Base Classes**: Extend `BaseMetricsAdapter` and `BaseAlertChannel` for retry logic, validation, and common patterns
2. **Type Safety**: Define config interfaces and use them in your classes
3. **Error Handling**: Use `sendWithRetry` / `fetchWithRetry` for automatic retries with exponential backoff
4. **Idempotency**: The alert dispatch workflow handles deduplication via KV
5. **Observability**: Use the logger and tracing utilities for debugging