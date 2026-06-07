# Architecture Decision Records (ADRs)

This document captures the key architectural decisions for onewf.

## ADR-001: Cloudflare Workflows as Execution Engine

**Status**: Accepted
**Date**: 2025-06-07

### Context
Need a durable, serverless execution engine for scheduled metric collection and alert dispatch.

### Decision
Use Cloudflare Workflows (Durable Workflows) as the primary execution engine.

### Consequences
- ✅ Built-in state persistence via step returns
- ✅ Automatic retries with exponential backoff
- ✅ Sleep/wait without CPU charges
- ✅ Hibernation = zero cost while waiting
- ✅ Single cron trigger fans out to multiple workflows
- ⚠️ Requires Workers paid plan
- ⚠️ Limited to 5 cron triggers on free tier (we use 1)

## ADR-002: Adapter Pattern for Source Integrations

**Status**: Accepted
**Date**: 2025-06-07

### Context
Need to integrate with multiple metric sources (Cloudflare, GCP, AnyRouter) with different auth and APIs.

### Decision
Implement adapter pattern with `BaseMetricsAdapter` abstract class and registry.

### Consequences
- ✅ Each adapter encapsulates source-specific logic
- ✅ Consistent interface via `MetricsAdapter` interface
- ✅ Config-driven registration via factory
- ✅ Easy to add new sources
- ✅ Shared retry logic in base class
- ⚠️ Slight abstraction overhead

## ADR-003: Channel Pattern for Alert Delivery

**Status**: Accepted
**Date**: 2025-06-07

### Context
Need to deliver alerts to multiple channels (Slack, Telegram, Webhook) with different formats.

### Decision
Implement channel pattern with `BaseAlertChannel` abstract class and registry.

### Consequences
- ✅ Each channel handles its own formatting and delivery
- ✅ Shared retry logic and idempotency via base class
- ✅ Config-driven registration via factory
- ✅ HMAC signing for webhook security
- ⚠️ Slight abstraction overhead

## ADR-004: Configuration Layering (TypeScript + KV)

**Status**: Accepted
**Date**: 2025-06-07

### Context
Need configuration that supports deploy-time defaults and runtime overrides without redeploy.

### Decision
Layered config: TypeScript file (deploy-time) → KV overrides (runtime) → Zod validation.

### Consequences
- ✅ Type-safe defaults in code
- ✅ Runtime overrides without redeploy
- ✅ Validation with clear error paths
- ✅ 5-minute in-memory cache
- ⚠️ KV reads add latency (mitigated by cache)
- ⚠️ No hot-reload (requires redeploy for TS changes)

## ADR-005: D1 + Drizzle ORM for Persistence

**Status**: Accepted
**Date**: 2025-06-07

### Context
Need durable storage for alert history with query performance.

### Decision
Use Cloudflare D1 (SQLite) with Drizzle ORM for type-safe queries.

### Consequences
- ✅ Type-safe database access
- ✅ SQLite compatibility
- ✅ Migration system built-in
- ✅ Indexes for query performance
- ⚠️ SQLite limitations (no concurrent writes)
- ⚠️ 5GB free tier limit

## ADR-006: KV for Idempotency and Config

**Status**: Accepted
**Date**: 2025-06-07

### Context
Need deduplication for alert delivery and runtime config overrides.

### Decision
Use Cloudflare KV with 24-hour TTL for idempotency keys; separate namespace for config.

### Consequences
- ✅ Automatic expiration via TTL
- ✅ Global replication
- ✅ Low latency reads
- ✅ Separate namespaces for isolation
- ⚠️ Eventual consistency
- ⚠️ 1GB free tier limit

## ADR-007: Single Cron Dispatcher Pattern

**Status**: Accepted
**Date**: 2025-06-07

### Context
Free tier allows max 5 cron triggers; need to run 3 source workflows every 15 minutes.

### Decision
Single cron trigger (`*/15 * * * *`) fans out to source-specific workflows.

### Consequences
- ✅ Uses only 1 of 5 free cron triggers
- ✅ Deterministic instance IDs prevent duplicates
- ✅ Error isolation per source
- ✅ Sequential execution (simpler for v1)
- ⚠️ Sources run sequentially (not parallel)

## ADR-008: AnyRouter as LLM Provider

**Status**: Accepted
**Date**: 2025-06-07

### Context
Need LLM capabilities for future features (alert summarization, anomaly detection).

### Decision
Integrate AnyRouter as unified LLM gateway via OpenAI-compatible API.

### Consequences
- ✅ Single API key for 150+ models
- ✅ Built-in fallback and routing
- ✅ BYOK support for enterprise
- ✅ OpenAI SDK compatible
- ⚠️ Additional dependency
- ⚠️ Cost per request via AnyRouter credits

## ADR-009: Observability Stack

**Status**: Accepted
**Date**: 2025-06-07

### Context
Need structured logging, metrics, and tracing for debugging.

### Decision
Custom structured JSON logger + in-memory metrics + W3C trace context.

### Consequences
- ✅ No external dependencies
- ✅ Works with wrangler observability
- ✅ Trace context propagation across steps
- ⚠️ In-memory metrics lost on restart (Workers are ephemeral)
- ⚠️ No built-in visualization (use Cloudflare dashboard)

## ADR-010: Testing Strategy

**Status**: Accepted
**Date**: 2025-06-07

### Context
Need reliable testing for workflows and adapters.

### Decision
Vitest + @cloudflare/vitest-pool-workers (miniflare) for unit and integration tests.

### Consequences
- ✅ Real Workers runtime in tests
- ✅ D1, KV, R2 bindings available
- ✅ Workflow step mocking via miniflare
- ⚠️ Miniflare setup complexity
- ⚠️ No real HTTP calls (mocked)

---

*Generated as part of docs-driven design for onewf*