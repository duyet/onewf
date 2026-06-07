# Development Guide

This guide covers the development workflow for onewf.

## Prerequisites

- **Bun** ≥ 1.1.0
- **Wrangler** ≥ 4.0.0
- **Cloudflare Account** with Workers paid plan

## Project Setup

```bash
# Install dependencies
bun install

# Generate types for Cloudflare bindings
bun run cf-typegen

# Create local D1 database
wrangler d1 create onewf-db --local

# Create local KV namespaces
wrangler kv:namespace create CONFIG_KV --local
wrangler kv:namespace create IDEMPOTENCY_KV --local

# Apply local migrations
bun run migrate:local
```

## Development Commands

```bash
# Start local dev server with hot reload
bun run dev

# Run all tests
bun run test

# Run tests with UI
bun run test --ui

# Run specific test file
bun run test test/adapters/cloudflare-billing.test.ts

# Type check
bunx tsc --noEmit

# Lint and format
bunx biome check --apply-unsafe .

# Deploy dry-run
bun run deploy:dry-run
```

## Project Structure Deep Dive

### Adding a New Source Adapter

1. Create `src/adapters/your-source.ts`:
```typescript
import { BaseMetricsAdapter } from "./base";
import type { MetricsAdapter, FetchParams, MetricData, SourceType } from "./types";
import type { Env } from "../index";

export interface YourSourceConfig extends Record<string, unknown> {
  apiKey: string;
  // ... your config
}

export class YourSourceAdapter extends BaseMetricsAdapter<YourSourceConfig> {
  readonly name = "your-source";
  readonly type: SourceType = "your-source" as SourceType;
  readonly priority = 40;

  constructor(config: YourSourceConfig, private env: Env) {
    super(config);
  }

  validateConfig(config: YourSourceConfig): boolean {
    return !!config.apiKey;
  }

  async fetchMetrics(params: FetchParams): Promise<MetricData[]> {
    const response = await this.fetchWithRetry<any>(url, options);
    return this.normalize(response);
  }

  normalize(data: unknown): MetricData[] {
    // Convert to MetricData[]
  }
}
```

2. Add type to `src/adapters/types.ts`:
```typescript
export type SourceType = "cloudflare-billing" | "gcp-billing" | "anyrouter" | "your-source";
```

3. Register in `src/registry/adapter-factory.ts`:
```typescript
import { YourSourceAdapter } from "../adapters/your-source";

case "your-source":
  return new YourSourceAdapter(config.config as YourSourceConfig, env);
```

4. Add workflow `src/workflows/your-source.ts` (follow existing pattern)

5. Register workflow in `wrangler.jsonc` and `src/index.ts`

6. Add tests in `test/adapters/your-source.test.ts`

### Adding a New Alert Channel

1. Create `src/channels/your-channel.ts`:
```typescript
import { BaseAlertChannel } from "./base";
import type { AlertChannel, Alert, ChannelType } from "./types";

export interface YourChannelConfig extends Record<string, unknown> {
  webhookUrl: string;
}

export class YourChannel extends BaseAlertChannel<YourChannelConfig> {
  readonly name = "your-channel";
  readonly type: ChannelType = "your-channel" as ChannelType;

  validateConfig(config: YourChannelConfig): boolean {
    return !!config.webhookUrl && config.webhookUrl.startsWith("http");
  }

  formatMessage(alert: Alert): string {
    return JSON.stringify({ text: alert.title, ... });
  }

  async send(alert: Alert, config: YourChannelConfig): Promise<void> {
    await this.sendWithRetry(alert, async () => {
      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(JSON.parse(this.formatMessage(alert))),
      });
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
    });
  }
}
```

2. Add type to `src/channels/types.ts`
3. Register in `src/registry/channel-factory.ts`
4. Add tests in `test/channels/your-channel.test.ts`

## Testing Patterns

### Unit Testing Adapters

```typescript
import { describe, it, expect, vi } from "vitest";
import { CloudflareBillingAdapter } from "../../src/adapters/cloudflare-billing";

describe("CloudflareBillingAdapter", () => {
  it("validates config", () => {
    const adapter = new CloudflareBillingAdapter(
      { accountId: "test", apiToken: "token" },
      {} as any
    );
    expect(adapter.validateConfig({ accountId: "a", apiToken: "t" })).toBe(true);
    expect(adapter.validateConfig({ accountId: "", apiToken: "t" })).toBe(false);
  });

  it("fetches metrics with correct auth", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [{ amount: 10000, currency: "USD", occurredAt: "2024-01-01", description: "test" }] })
    });
    global.fetch = mockFetch;

    const adapter = new CloudflareBillingAdapter(
      { accountId: "test", apiToken: "token" },
      {} as any
    );
    const metrics = await adapter.fetchMetrics({ scheduledTime: Date.now(), config: {} });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api.cloudflare.com"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" })
      })
    );
    expect(metrics[0].value).toBe(100); // cents to dollars
  });
});
```

### Integration Testing Workflows

```typescript
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { CfBillingWorkflow } from "../../src/workflows/cf-billing";

describe("CfBillingWorkflow", () => {
  it("fetches metrics and evaluates thresholds", async () => {
    // Mock the adapter
    const workflow = new CfBillingWorkflow(env, {} as any);
    // Test via workflow instance...
  });
});
```

## Debugging

### Local Logs
```bash
# Tail logs in real-time
bun run logs

# One-time log fetch
bun run logs:once
```

### Type Errors
```bash
# Full type check with details
bunx tsc --noEmit --pretty
```

### Workflow Debugging
- Use `step.do` for debug logging
- Check `wrangler dev` console output
- Use `createTraceContext` for request tracing

## Code Style

- **TypeScript**: Strict mode, no `any` in public APIs
- **Formatting**: Biome (2 spaces, single quotes, trailing commas)
- **Naming**: camelCase for variables, PascalCase for types/classes
- **Imports**: Relative imports for internal, bare for external
- **Comments**: Minimal, prefer self-documenting code

## Git Workflow

```bash
# Feature branch
git checkout -b feat/your-feature

# Commit with conventional messages
git commit -m "feat(adapter): add new source adapter"

# Push and create PR
git push origin feat/your-feature
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `wrangler dev` fails | Check `wrangler.jsonc` bindings match local resources |
| D1 migration errors | Run `bun run migrate:local` with fresh DB |
| Type errors in adapters | Ensure config extends `Record<string, unknown>` |
| Tests timeout | Increase timeout in `vitest.config.ts` |
| KV not found | Create KV namespaces with `--local` flag |

---

*Part of docs-driven design for onewf*