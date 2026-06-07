# onewf - Cloudflare Workflows Alerting Platform

A production-grade alerting platform built on Cloudflare Workflows for multi-source metrics collection and multi-channel alert delivery.

## Features

- **Multi-source metrics collection**: Cloudflare Billing, GCP Billing, AnyRouter Admin
- **Multi-channel alerting**: Slack, Telegram, Generic Webhook (with HMAC)
- **Cost-efficient**: Single cron trigger, workflow-based execution, KV-based idempotency
- **Type-safe**: Full TypeScript with Zod validation, Drizzle ORM for D1
- **Extensible**: Pluggable adapter and channel architecture

## Architecture

```
┌─────────────────┐
│  Cron Trigger   │  */15 * * * *
│  (1 of 5 free)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  CronDispatcherWorkflow │  Loads config, creates source workflow instances
└────────┬────────────────┘
         │
    ┌────┴────┬──────────────┐
    ▼         ▼              ▼
┌────────┐ ┌────────┐   ┌────────┐
│CF Bill │ │AnyRouter│   │GCP Bill│
│Workflow│ │Workflow │   │Workflow│
└────┬───┘ └────┬────┘   └────┬───┘
     │          │             │
     └──────────┼─────────────┘
                ▼
      ┌─────────────────┐
      │AlertDispatchWkfl│  Fans out to channels, writes D1 history
      └────────┬────────┘
               │
      ┌────────┼────────┬────────┐
      ▼        ▼        ▼        ▼
   ┌─────┐ ┌───────┐ ┌───────┐ ┌────────┐
   │Slack│ │Telegram│ │Webhook│ │  D1    │
   │Chan │ │ Chan  │ │ Chan  │ │ History│
   └─────┘ └───────┘ └───────┘ └────────┘
```

## Quick Start

### Prerequisites

- Cloudflare account with Workers paid plan (for Workflows)
- Node.js 20+ and Bun
- Wrangler CLI: `npm i -g wrangler`

### Installation

```bash
# Clone and install
git clone <repo>
cd onewf
bun install

# Create D1 database
wrangler d1 create onewf-db
# Update wrangler.jsonc with the database_id

# Create KV namespaces
wrangler kv:namespace create CONFIG_KV
wrangler kv:namespace create IDEMPOTENCY_KV
# Update wrangler.jsonc with the IDs

# Apply migrations
bun run migrate:local

# Configure secrets
wrangler secret put CF_API_TOKEN
wrangler secret put ANYROUTER_API_KEY
wrangler secret put GCP_SERVICE_ACCOUNT_JSON
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put WEBHOOK_URL
wrangler secret put WEBHOOK_SECRET
```

### Configuration

Edit `src/config/app.config.ts` with your source and channel configurations.

```typescript
// Example source config
{
  id: "cf-billing-1",
  type: "cloudflare-billing",
  enabled: true,
  config: { accountId: "your-account-id" },
  thresholds: [
    { metric: "billing_cost", operator: "gt", value: 100, severity: "warning" }
  ]
}

// Example channel config
{
  id: "slack-1",
  type: "slack",
  enabled: true,
  config: { webhookUrl: "https://hooks.slack.com/...", channel: "#alerts" }
}
```

### Development

```bash
# Start local dev server
bun run dev

# Run tests
bun run test

# Type check
bunx tsc --noEmit
```

### Deployment

```bash
# Deploy to Cloudflare
bun run deploy

# Or use CLI
bun run cli deploy
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start local development server |
| `bun run deploy` | Deploy to Cloudflare |
| `bun run deploy:dry-run` | Validate deployment without deploying |
| `bun run test` | Run test suite |
| `bun run migrate:local` | Apply D1 migrations locally |
| `bun run migrate:remote` | Apply D1 migrations to remote |
| `bun run logs` | Tail worker logs |
| `bun run cli <cmd>` | CLI helper commands |

## Project Structure

```
src/
├── adapters/          # Source adapters
│   ├── base.ts        # Base adapter class
│   ├── types.ts       # Adapter interfaces
│   ├── cloudflare-billing.ts
│   ├── anyrouter.ts
│   └── gcp-billing.ts
├── channels/          # Alert channels
│   ├── base.ts        # Base channel class
│   ├── types.ts       # Channel interfaces
│   ├── slack.ts
│   ├── telegram.ts
│   └── webhook.ts
├── workflows/         # Cloudflare Workflows
│   ├── dispatcher.ts  # Cron dispatcher
│   ├── cf-billing.ts  # CF billing workflow
│   ├── anyrouter.ts   # AnyRouter workflow
│   ├── gcp-billing.ts # GCP billing workflow
│   └── alert-dispatch.ts # Alert fan-out
├── registry/          # Registry & factories
│   ├── adapter-registry.ts
│   ├── adapter-factory.ts
│   ├── channel-registry.ts
│   └── channel-factory.ts
├── config/            # Configuration
│   ├── types.ts       # Config types
│   ├── schema.ts      # Zod schemas
│   ├── loader.ts      # Config loader (TS + KV)
│   └── app.config.ts  # Default config
├── db/                # Database layer
│   ├── schema.ts      # Drizzle schema
│   ├── client.ts      # Drizzle client
│   └── queries.ts     # Type-safe queries
├── observability/     # Logging & metrics
│   ├── logger.ts
│   ├── metrics.ts
│   └── tracing.ts
├── utils/             # Utilities
│   └── alert-evaluator.ts
├── cli/               # CLI tool
└── index.ts           # Worker entrypoint
```

## Extending

See [EXTENDING.md](docs/EXTENDING.md) for guides on:
- Adding a new source adapter
- Adding a new alert channel

## Cost Analysis

See [COST.md](docs/COST.md) for detailed cost breakdown.

## License

MIT