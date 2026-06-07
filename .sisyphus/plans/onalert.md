# onalert - Cloudflare Workflows Alerting Platform

## TL;DR

> **Quick Summary**: Build "onalert" - a production-grade Cloudflare Workflows-based multi-source metrics collection and alerting platform. Single Worker with adapter pattern for plug-and-play sources (Cloudflare billing, GCP billing, AnyRouter admin) and alert channels (Slack, Telegram, webhook). Single cron dispatcher with branching to fan out to source-specific workflows. TDD throughout with Vitest + miniflare.
>
> **Deliverables**:
> - TypeScript Cloudflare Worker project with Workflows bindings
> - Adapter framework + registry (interface-based, config-driven)
> - 3 source adapters: Cloudflare billing, GCP billing, AnyRouter admin
> - 3 alert channels: Slack, Telegram, generic webhook
> - Single cron dispatcher with granularity branching
> - Configuration system (TypeScript config + KV + D1)
> - D1 schema for alert history with indexes
> - CLI tool for management and testing
> - Complete TDD test suite (unit + integration)
> - Cost-optimized: step.sleep, short retention, R2 for large data
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 5 → Task 8 → Task 15 → Task 22 → F1-F4

---

## Context

### Original Request
Build "onalert" - a Cloudflare Workflows (Durable Workflows) based project that:
- Collects metrics/alerts from multiple sources as templates
- Is configurable and cost-efficient
- Uses Workflow state for execution persistence
- Triggers alerts via Slack, webhook, Telegram
- Supports different cron schedule templates (free tier max 5, so trigger at most granularly + if/else to route to right workflow branch)
- Supports all Cloudflare Workflow features
- Use cases: Cloudflare usage billing threshold alerts, GCP billing alerts, AnyRouter admin usage, etc.
- Plug-and-play adapter design for easy extension
- Quality standard: ultraplan, ultraworker

### Interview Summary
**Key Discussions**:
- **Project name**: onalert (confirmed)
- **Architecture**: Single Worker entrypoint, TypeScript config files
- **Secrets**: Cloudflare Workers Secrets (native)
- **Persistence**: D1 for alert history/audit, KV for config, Workflow built-in state
- **Deployment**: Single Worker with multiple Workflow definitions
- **MVP Scope**: Core engine + 3 adapters (CF billing, GCP billing, AnyRouter) + 3 channels (Slack, Telegram, webhook)
- **Testing**: TDD (RED-GREEN-REFACTOR) with Vitest + miniflare
- **Deduplication**: KV-based with 24h TTL idempotency keys
- **Rate limiting**: Per-adapter via step.sleep() + step retry config (no built-in rate limiter)
- **Tenancy**: Single tenant for v1
- **Observability**: wrangler observability + structured JSON logs

**Research Findings** (from librarian & explore agents):
- Cloudflare Workflows: single cron dispatcher pattern, state via step returns, cost optimization via sleep/short retention
- Sleeping/waiting workflow instances do NOT count toward concurrency - critical for cost efficiency
- Step returns are the ONLY way to persist state across hibernation
- Network I/O, DB queries, step.sleep() do NOT count toward CPU limit
- Adapter registry pattern with template method base class
- Alert channels: HMAC signatures, idempotency keys, exponential backoff
- Configuration layers: wrangler.jsonc + Secrets + KV + D1

### Metis Review
**Identified Gaps** (addressed in plan):
- **Gap 1 - Workflow state testing**: Need miniflare setup for workflow integration tests - Task 3 includes this
- **Gap 2 - Secret rotation**: Workers secrets require redeploy - addressed with config-driven secret references
- **Gap 3 - Alert routing complexity**: v1 uses simple per-source channel mapping; complex routing deferred to v2
- **Gap 4 - D1 migrations**: Need migration system from start - Task 6 includes Drizzle ORM + migrations
- **Gap 5 - CLI scope**: CLI should be minimal (deploy, logs, test) - not a full management UI
- **Gap 6 - Error alerting**: Workflow failures need visibility - Task 19 includes error channel routing

---

## Work Objectives

### Core Objective
Build a production-grade Cloudflare Workflows alerting platform with pluggable adapter architecture for multi-source metrics collection and multi-channel alert delivery, optimized for cost efficiency on the free tier.

### Concrete Deliverables
- `wrangler.jsonc` with Workflow bindings, D1, KV, R2, cron triggers
- `src/index.ts` - Worker entrypoint with cron dispatcher
- `src/workflows/` - 4 Workflow classes (dispatcher, CF billing, GCP billing, AnyRouter, alert-dispatch)
- `src/adapters/` - Base interface + 3 concrete adapters
- `src/channels/` - Base interface + 3 concrete channels
- `src/registry/` - Adapter and channel registries
- `src/config/` - TypeScript config system
- `src/db/` - D1 schema, migrations, queries
- `src/cli/` - CLI tool (deploy, logs, test)
- `test/` - Vitest + miniflare test suite
- `README.md` - Setup, configuration, extension guide

### Definition of Done
- [ ] All 4 Workflows defined and bound in wrangler.jsonc
- [ ] 3 adapters implement base interface and registered
- [ ] 3 channels implement base interface and registered
- [ ] Cron dispatcher creates workflow instances based on config
- [ ] D1 migrations applied, schema with indexes
- [ ] All tests pass (RED-GREEN-REFACTOR cycle completed)
- [ ] wrangler deploy succeeds
- [ ] CLI can deploy, view logs, run tests
- [ ] Cost analysis documented (invocations, duration, storage)

### Must Have
- TypeScript strict mode, no `any` in public APIs
- All state persisted via step returns
- Idempotency for all alert sends
- HMAC signature for webhooks
- Exponential backoff for all retries
- Structured JSON logging
- Cost-optimized: step.sleep for rate limits, short retention
- Adapter registration via config (not hardcoded)

### Must NOT Have (Guardrails)
- No web dashboard (v2)
- No multi-org/multi-tenant (v2)
- No complex alert routing rules (v2)
- No historical analytics/aggregation (v2)
- No external secret managers (Workers Secrets only)
- No centralized rate limiter (per-adapter only)
- No UI for config editing (TypeScript config files only)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: YES (TDD)
- **Framework**: Vitest + @cloudflare/vitest-pool-workers (miniflare)
- **If TDD**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **API/Backend**: Use Bash (curl) - Send requests, assert status + response fields
- **Library/Module**: Use Bash (bun/node REPL) - Import, call functions, compare output
- **Workflow**: Use Vitest with miniflare - Mock external APIs, assert workflow state
- **CLI**: Use Bash - Run commands, assert output, capture exit codes

---

## Execution Strategy

### Parallel Execution Waves

> Maximize throughput by grouping independent tasks into parallel waves.
> Each wave completes before the next begins.
> Target: 5-8 tasks per wave.

```
Wave 1 (Start Immediately - foundation + scaffolding):
├── Task 1: Project scaffolding + wrangler config
├── Task 2: TypeScript config system
├── Task 3: Vitest + miniflare test setup
├── Task 4: Core type definitions (adapter/channel interfaces)
├── Task 5: Adapter registry + base class
├── Task 6: D1 schema + migrations
└── Task 7: Logger + observability utilities

Wave 2 (After Wave 1 - core framework, MAX PARALLEL):
├── Task 8: Channel registry + base class
├── Task 9: Slack channel adapter
├── Task 10: Telegram channel adapter
├── Task 11: Webhook channel adapter (with HMAC)
├── Task 12: Cloudflare billing source adapter
└── Task 13: Config loader (TypeScript + KV merge)

Wave 3 (After Wave 2 - workflows + remaining adapters):
├── Task 14: AnyRouter source adapter
├── Task 15: GCP billing source adapter
├── Task 16: Cron dispatcher Workflow
├── Task 17: Source-specific Workflow (CF billing)
├── Task 18: Source-specific Workflow (AnyRouter)

Wave 4 (After Wave 3 - integration + alert dispatch):
├── Task 19: Source-specific Workflow (GCP billing)
├── Task 20: Alert dispatch Workflow (fan-out to channels)
├── Task 21: D1 alert history writer
├── Task 22: Worker entrypoint + cron handler
├── Task 23: CLI tool (deploy, logs, test)
└── Task 24: README + extension guide

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── F1: Plan compliance audit
├── F2: Code quality review
├── F3: Real manual QA
└── F4: Scope fidelity check
```

### Dependency Matrix (abbreviated)
- **Task 1**: - (foundation)
- **Tasks 2-7**: Task 1 - independent of each other
- **Task 8**: Task 5 (needs registry pattern)
- **Tasks 9-11**: Task 8 (need channel base)
- **Task 12**: Tasks 5, 6 (needs registry + DB)
- **Task 13**: Task 2 (needs config system)
- **Task 14**: Tasks 5, 6 (needs registry + DB)
- **Task 15**: Tasks 5, 6 (needs registry + DB)
- **Task 16**: Tasks 4, 12, 13, 14, 15 (needs adapters + config)
- **Tasks 17-19**: Task 16 (dispatcher pattern)
- **Task 20**: Tasks 8-11, 21 (channels + history)
- **Task 21**: Task 6 (D1 schema)
- **Task 22**: Tasks 16-20, 23 (wires everything)
- **Task 23**: Task 22 (CLI wraps entrypoint)
- **Task 24**: All (documentation)

### Agent Dispatch Summary
- **Wave 1**: 7 tasks - Foundation work
- **Wave 2**: 6 tasks - Core framework + 3 channels
- **Wave 3**: 5 tasks - Workflows + adapters
- **Wave 4**: 6 tasks - Integration + CLI
- **FINAL**: 4 parallel reviews

---

## TODOs

- [ ] 1. **Project scaffolding + wrangler config**

  **What to do**:
  - Initialize bun project: `bun init`, add dependencies (wrangler, @cloudflare/workers-types, typescript)
  - Create `wrangler.jsonc` with: name, main, compatibility_date, observability, triggers (1 cron: `*/15 * * * *`), workflow bindings, KV/D1/R2 bindings, limits
  - Create `tsconfig.json` with strict mode, Workers types
  - Create directory structure: `src/{adapters,channels,workflows,registry,config,db,cli}`, `test/`
  - Create minimal `src/index.ts` (Worker handler skeleton)
  - Add `.gitignore`, `.editorconfig`
  - **TDD**: First write test asserting wrangler.jsonc has required bindings, cron, observability
  - **TDD**: Test that src/index.ts exports a Worker with fetch and scheduled handlers

  **Must NOT do**:
  - No business logic yet
  - No actual workflow code (just structure)
  - No external dependencies beyond wrangler + types

  **Recommended Agent Profile**:
  - **Category**: `quick` - Straightforward project setup
  - **Skills**: `[]` - No specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-7)
  - **Blocks**: All other tasks
  - **Blocked By**: None (can start immediately)

  **References**:
  - **External**: `https://developers.cloudflare.com/workers/wrangler/configuration/` - wrangler.jsonc schema
  - **External**: `https://developers.cloudflare.com/workflows/build/workers-api/` - Workflow binding config

  **Acceptance Criteria**:
  - [ ] `bunx tsc --noEmit` passes
  - [ ] `wrangler dev` starts without error
  - [ ] `wrangler deploy --dry-run` succeeds
  - [ ] `bun test` passes (scaffold tests)
  - [ ] Test file: `test/scaffold.test.ts` validates wrangler.jsonc structure

  **QA Scenarios**:
  ```
  Scenario: wrangler.jsonc structure validation
    Tool: Bash
    Preconditions: Project initialized
    Steps:
      1. Read wrangler.jsonc and assert it has: name="onalert", main="src/index.ts"
      2. Assert triggers.crons contains "*/15 * * * *"
      3. Assert workflows array has at least 1 binding
      4. Assert observability.enabled is true
    Expected Result: All assertions pass
    Evidence: .sisyphus/evidence/task-1-wrangler-config.json

  Scenario: TypeScript strict mode
    Tool: Bash
    Preconditions: tsconfig.json created
    Steps:
      1. Run `bunx tsc --noEmit`
      2. Assert exit code 0
    Expected Result: No type errors
    Evidence: .sisyphus/evidence/task-1-tsc-output.txt
  ```

  **Commit**: YES - `feat(scaffold): initialize worker project with wrangler config`

---

- [ ] 2. **TypeScript config system**

  **What to do**:
  - Create `src/config/types.ts` with: `AppConfig`, `SourceConfig`, `ChannelConfig`, `AlertRule`
  - Create `src/config/schema.ts` with Zod schemas for runtime validation
  - Create `src/config/defaults.ts` with sensible defaults
  - **TDD**: Test config type inference and Zod validation
  - **TDD**: Test that invalid configs throw descriptive errors

  **Must NOT do**:
  - No KV loading yet (separate task)
  - No environment variable handling yet
  - No config file reading (just types and schemas)

  **Recommended Agent Profile**:
  - **Category**: `quick` - Type definitions + Zod schemas
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-7)
  - **Blocks**: Task 13 (config loader)
  - **Blocked By**: Task 1

  **References**:
  - **External**: `https://zod.dev/` - Zod documentation
  - **Pattern**: TypeScript discriminated unions for source/channel types

  **Acceptance Criteria**:
  - [ ] `AppConfig` type includes: `sources: SourceConfig[]`, `channels: ChannelConfig[]`, `rules: AlertRule[]`
  - [ ] Zod schema validates all config shapes
  - [ ] Invalid config throws with field path in error message
  - [ ] Test file: `test/config/types.test.ts` covers all valid/invalid cases

  **QA Scenarios**:
  ```
  Scenario: Config type validation
    Tool: Bash (bun REPL)
    Preconditions: Config types and schemas defined
    Steps:
      1. Import AppConfigSchema from src/config/schema.ts
      2. Parse valid config JSON, assert success
      3. Parse invalid config (missing required field), assert throws with field path
    Expected Result: Valid configs pass, invalid configs throw with clear errors
    Evidence: .sisyphus/evidence/task-2-config-validation.txt

  Scenario: Zod error messages include field paths
    Tool: Bash
    Steps:
      1. Parse { sources: [{ type: 'invalid-type' }] }
      2. Assert error message includes "sources.0.type"
    Expected Result: Error path clearly identifies invalid field
    Evidence: .sisyphus/evidence/task-2-zod-error-path.txt
  ```

  **Commit**: YES - `feat(config): add type definitions and Zod schemas`

---

- [ ] 3. **Vitest + miniflare test setup**

  **What to do**:
  - Install: `vitest`, `@cloudflare/vitest-pool-workers`, `miniflare`
  - Create `vitest.config.ts` with Workers pool, miniflare config
  - Create `test/setup.ts` for global test utilities
  - **TDD**: Test that vitest can run a simple Worker test
  - **TDD**: Test that miniflare provides D1, KV, R2, Workflow bindings in test environment

  **Must NOT do**:
  - No actual workflow tests yet
  - No D1/KV test data fixtures yet (separate tasks)

  **Recommended Agent Profile**:
  - **Category**: `quick` - Test infrastructure setup
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4-7)
  - **Blocks**: All test-writing tasks
  - **Blocked By**: Task 1

  **References**:
  - **External**: `https://developers.cloudflare.com/workers/testing/vitest/` - Vitest with Workers
  - **External**: `https://vitest.dev/config/` - Vitest configuration

  **Acceptance Criteria**:
  - [ ] `bun test` runs successfully
  - [ ] Test can import from `cloudflare:workers` and `cloudflare:workflows`
  - [ ] Test can access `env.DB`, `env.CONFIG_KV` bindings
  - [ ] Test file: `test/setup.test.ts` validates test environment

  **QA Scenarios**:
  ```
  Scenario: Vitest discovers and runs tests
    Tool: Bash
    Preconditions: vitest.config.ts created
    Steps:
      1. Run `bun test`
      2. Assert exit code 0
      3. Assert at least 1 test ran
    Expected Result: Test suite executes successfully
    Evidence: .sisyphus/evidence/task-3-vitest-run.txt

  Scenario: Worker bindings available in test
    Tool: Bash
    Steps:
      1. Run test that accesses env.DB, env.CONFIG_KV
      2. Assert bindings are defined and usable
    Expected Result: All bindings accessible in test environment
    Evidence: .sisyphus/evidence/task-3-bindings-available.txt
  ```

  **Commit**: YES - `chore(test): add vitest and miniflare configuration`

---

- [ ] 4. **Core type definitions (adapter/channel interfaces)**

  **What to do**:
  - Create `src/adapters/types.ts` with: `MetricsAdapter<TConfig>`, `MetricData`, `FetchParams`, `SourceType`
  - Create `src/channels/types.ts` with: `AlertChannel<TConfig>`, `Alert`, `AlertSeverity`, `ChannelType`
  - Create `src/types/common.ts` with shared types: `Timestamp`, `CostValue`, `Threshold`
  - **TDD**: Test that adapter/channel interfaces enforce required methods
  - **TDD**: Test that Alert type includes all required fields

  **Must NOT do**:
  - No implementations yet
  - No concrete adapters/channels
  - No registry logic

  **Recommended Agent Profile**:
  - **Category**: `quick` - Type definitions
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-7)
  - **Blocks**: Tasks 5, 8, 9-11, 12, 14, 15
  - **Blocked By**: Task 1

  **References**:
  - **Pattern**: Strategy/Adapter pattern with generic config types
  - **Pattern**: Discriminated unions for source/channel types

  **Acceptance Criteria**:
  - [ ] `MetricsAdapter` interface has: `name`, `type`, `fetchMetrics()`, `validateConfig()`
  - [ ] `AlertChannel` interface has: `name`, `type`, `send()`, `formatMessage()`
  - [ ] `Alert` type includes: `id`, `source`, `severity`, `title`, `description`, `timestamp`, `metrics`
  - [ ] Test file: `test/types/interfaces.test.ts` validates type contracts

  **QA Scenarios**:
  ```
  Scenario: Adapter interface contract
    Tool: Bash (bun REPL)
    Preconditions: Types defined
    Steps:
      1. Create mock adapter implementing MetricsAdapter
      2. Assert all required properties/methods present
      3. Assert TypeScript compilation succeeds
    Expected Result: Mock adapter satisfies interface
    Evidence: .sisyphus/evidence/task-4-adapter-contract.txt

  Scenario: Alert type completeness
    Tool: Bash
    Steps:
      1. Create Alert object with all required fields
      2. Assert all fields accessible and typed correctly
    Expected Result: Alert type enforces all required fields
    Evidence: .sisyphus/evidence/task-4-alert-type.txt
  ```

  **Commit**: YES - `feat(types): add core adapter and channel interfaces`

---

- [ ] 5. **Adapter registry + base class**

  **What to do**:
  - Create `src/adapters/base.ts` with abstract `BaseMetricsAdapter<TConfig>` class implementing template method
  - Create `src/registry/adapter-registry.ts` with `AdapterRegistry` class (register, get, getAll, getEnabled)
  - Create `src/registry/factory.ts` with `createAdapter(config, env)` factory function
  - **TDD**: Test registry registration, retrieval, priority sorting
  - **TDD**: Test that disabled adapters are filtered out
  - **TDD**: Test factory creates correct adapter type from config

  **Must NOT do**:
  - No concrete adapter implementations yet
  - No actual API calls
  - No KV loading in registry

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Registry pattern with generics
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6-7)
  - **Blocks**: Tasks 8, 12, 14, 15
  - **Blocked By**: Tasks 1, 4

  **References**:
  - **Pattern**: Registry pattern with priority sorting
  - **Pattern**: Factory pattern for config-driven instantiation
  - **Pattern**: Template method pattern in base class

  **Acceptance Criteria**:
  - [ ] `AdapterRegistry.register()` stores adapter by name
  - [ ] `AdapterRegistry.getAll()` returns sorted by priority (desc)
  - [ ] `AdapterRegistry.getEnabled()` filters out disabled adapters
  - [ ] `createAdapter()` returns correct concrete type from config
  - [ ] Test file: `test/registry/adapter-registry.test.ts` covers all methods

  **QA Scenarios**:
  ```
  Scenario: Adapter registration and retrieval
    Tool: Bash
    Preconditions: Registry implemented
    Steps:
      1. Create mock adapters with different priorities
      2. Register them in registry
      3. Call getAll(), assert sorted by priority desc
      4. Call getEnabled(), assert disabled filtered out
    Expected Result: Registry behaves correctly per spec
    Evidence: .sisyphus/evidence/task-5-registry-behavior.txt

  Scenario: Factory creates correct adapter type
    Tool: Bash
    Steps:
      1. Create config with type='cloudflare-billing'
      2. Call createAdapter(config, mockEnv)
      3. Assert returned adapter is CloudflareBillingAdapter
    Expected Result: Factory dispatches to correct implementation
    Evidence: .sisyphus/evidence/task-5-factory-dispatch.txt
  ```

  **Commit**: YES - `feat(registry): add adapter registry and factory`

---

- [ ] 6. **D1 schema + migrations**

  **What to do**:
  - Create `src/db/schema.ts` with Drizzle ORM schema: `alertHistory`, `alertChannels`, `sourceConfig` tables
  - Create `migrations/0001_initial.sql` with CREATE TABLE statements and indexes
  - Create `src/db/client.ts` with Drizzle client factory
  - Create `src/db/queries.ts` with type-safe query functions
  - **TDD**: Test schema migration applies successfully
  - **TDD**: Test insert/select queries work
  - **TDD**: Test indexes exist on `alertHistory(source)`, `alertHistory(sent_at)`

  **Must NOT do**:
  - No D1 writes from workflows yet (separate task)
  - No D1 migrations runner (use wrangler d1 migrations)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Database schema design
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7)
  - **Blocks**: Tasks 12, 14, 15, 21
  - **Blocked By**: Task 1

  **References**:
  - **External**: `https://developers.cloudflare.com/d1/` - D1 documentation
  - **External**: `https://orm.drizzle.team/docs/get-started-sqlite` - Drizzle ORM
  - **Pattern**: SQLite schema with indexes for query performance

  **Acceptance Criteria**:
  - [ ] Migration creates `alert_history`, `alert_channels`, `source_config` tables
  - [ ] Indexes on `alert_history(source)`, `alert_history(sent_at)`, `alert_channels(type)`
  - [ ] Drizzle schema types match SQL schema
  - [ ] Test file: `test/db/schema.test.ts` validates migration and queries

  **QA Scenarios**:
  ```
  Scenario: D1 migration applies successfully
    Tool: Bash (wrangler d1)
    Preconditions: D1 database created
    Steps:
      1. Run `wrangler d1 migrations apply onalert-db --local`
      2. Assert exit code 0
      3. Query sqlite_master, assert all 3 tables exist
    Expected Result: Migration applied, tables created
    Evidence: .sisyphus/evidence/task-6-migration-applied.txt

  Scenario: Indexes exist for query performance
    Tool: Bash
    Steps:
      1. Query sqlite_master for indexes
      2. Assert idx_alert_history_source, idx_alert_history_sent_at exist
    Expected Result: All required indexes present
    Evidence: .sisyphus/evidence/task-6-indexes-exist.txt
  ```

  **Commit**: YES - `feat(db): add D1 schema and initial migration`

---

- [ ] 7. **Logger + observability utilities**

  **What to do**:
  - Create `src/observability/logger.ts` with structured JSON logger (info, warn, error, debug)
  - Create `src/observability/metrics.ts` with workflow metrics tracking (invocations, duration, errors)
  - Create `src/observability/tracing.ts` with trace context propagation
  - **TDD**: Test logger outputs valid JSON with required fields
  - **TDD**: Test metrics counter increments correctly
  - **TDD**: Test trace context propagates across step boundaries

  **Must NOT do**:
  - No external logging service integration
  - No PII logging
  - No log level configuration from env (hardcoded for v1)

  **Recommended Agent Profile**:
  - **Category**: `quick` - Utility functions
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6)
  - **Blocks**: All tasks that need logging
  - **Blocked By**: Task 1

  **References**:
  - **Pattern**: Structured logging with JSON output
  - **Pattern**: OpenTelemetry-style trace context

  **Acceptance Criteria**:
  - [ ] Logger outputs valid JSON with: timestamp, level, message, context
  - [ ] Metrics counter is thread-safe (for parallel steps)
  - [ ] Trace context includes: traceId, spanId, parentSpanId
  - [ ] Test file: `test/observability/logger.test.ts` validates output format

  **QA Scenarios**:
  ```
  Scenario: Logger outputs valid JSON
    Tool: Bash
    Preconditions: Logger implemented
    Steps:
      1. Call logger.info('test', { key: 'value' })
      2. Capture stdout
      3. Parse as JSON, assert required fields present
    Expected Result: Valid JSON with all required fields
    Evidence: .sisyphus/evidence/task-7-logger-json.txt

  Scenario: Trace context propagation
    Tool: Bash
    Steps:
      1. Create parent trace context
      2. Create child trace context with parent reference
      3. Assert child has correct parentSpanId
    Expected Result: Trace context propagates correctly
    Evidence: .sisyphus/evidence/task-7-trace-context.txt
  ```

  **Commit**: YES - `feat(observability): add logger and metrics utilities`

---

- [ ] 8. **Channel registry + base class**

  **What to do**:
  - Create `src/channels/base.ts` with abstract `BaseAlertChannel<TConfig>` class
  - Create `src/registry/channel-registry.ts` with `ChannelRegistry` class
  - Create `src/registry/channel-factory.ts` with `createChannel(config, env)` factory
  - **TDD**: Test channel registration and retrieval
  - **TDD**: Test factory creates correct channel type from config
  - **TDD**: Test idempotency check via KV (24h TTL)

  **Must NOT do**:
  - No concrete channel implementations yet
  - No actual message sending
  - No webhook URL validation (channels handle their own)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Registry pattern with channel-specific idempotency
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-11, 12, 13)
  - **Blocks**: Tasks 9-11, 20
  - **Blocked By**: Tasks 1, 4

  **References**:
  - **Pattern**: Registry pattern (mirrors adapter registry)
  - **Pattern**: Idempotency via KV with TTL

  **Acceptance Criteria**:
  - [ ] `ChannelRegistry` mirrors `AdapterRegistry` API
  - [ ] `createChannel()` dispatches to correct concrete type
  - [ ] Idempotency check uses KV with 24h TTL
  - [ ] Test file: `test/registry/channel-registry.test.ts` covers all methods

  **QA Scenarios**:
  ```
  Scenario: Channel registration and retrieval
    Tool: Bash
    Preconditions: Registry implemented
    Steps:
      1. Create mock channels
      2. Register in registry
      3. Retrieve by name, assert correct instance
    Expected Result: Registry works correctly
    Evidence: .sisyphus/evidence/task-8-channel-registry.txt

  Scenario: Idempotency via KV
    Tool: Bash
    Steps:
      1. Mark alert as sent (KV put with TTL)
      2. Check idempotency, assert returns true
      3. Wait for TTL expiry (mock), assert returns false
    Expected Result: Idempotency prevents duplicate sends
    Evidence: .sisyphus/evidence/task-8-idempotency.txt
  ```

  **Commit**: YES - `feat(registry): add channel registry and factory`

---

- [ ] 9. **Slack channel adapter**

  **What to do**:
  - Create `src/channels/slack.ts` with `SlackChannel` class
  - Implement `send()`: POST to Slack webhook URL with blocks formatting
  - Implement `formatMessage()`: severity emoji, title, fields, metrics
  - **TDD**: Test message formatting produces valid Slack blocks
  - **TDD**: Test HTTP POST with correct payload (mock fetch)
  - **TDD**: Test error handling for non-2xx responses
  - **TDD**: Test retry with exponential backoff in step config

  **Must NOT do**:
  - No Slack API token auth (webhook URL only for v1)
  - No file uploads
  - No interactive messages (buttons, modals)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Third-party API integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 10, 11, 12, 13)
  - **Blocks**: Task 20
  - **Blocked By**: Task 8

  **References**:
  - **External**: `https://api.slack.com/messaging/webhooks` - Slack webhook API
  - **External**: `https://api.slack.com/block-kit` - Block Kit reference

  **Acceptance Criteria**:
  - [ ] `SlackChannel.send()` POSTs to webhook URL with valid blocks
  - [ ] `formatMessage()` includes: severity emoji, title, source, cost, timestamp
  - [ ] Non-2xx response throws error for retry
  - [ ] Test file: `test/channels/slack.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: Slack message format validation
    Tool: Bash
    Preconditions: SlackChannel implemented
    Steps:
      1. Create alert with all fields
      2. Call formatMessage(alert)
      3. Assert output is valid Slack blocks JSON
      4. Assert includes severity emoji, title, fields
    Expected Result: Valid Slack blocks format
    Evidence: .sisyphus/evidence/task-9-slack-format.txt

  Scenario: HTTP POST with correct payload
    Tool: Bash (mock fetch)
    Steps:
      1. Mock fetch to capture request
      2. Call SlackChannel.send(alert)
      3. Assert fetch called with correct URL, method, headers, body
    Expected Result: Correct HTTP request sent
    Evidence: .sisyphus/evidence/task-9-slack-payload.txt

  Scenario: Retry on 500 error
    Tool: Bash
    Steps:
      1. Mock fetch to return 500
      2. Call send(), assert throws NonRetryableError or retries
    Expected Result: Error handled correctly for retry
    Evidence: .sisyphus/evidence/task-9-slack-retry.txt
  ```

  **Commit**: YES - `feat(channel): add slack channel with blocks formatting`

---

- [ ] 10. **Telegram channel adapter**

  **What to do**:
  - Create `src/channels/telegram.ts` with `TelegramChannel` class
  - Implement `send()`: POST to `https://api.telegram.org/bot{token}/sendMessage`
  - Implement `formatMessage()`: Markdown formatting with severity emoji
  - **TDD**: Test message formatting produces valid Markdown
  - **TDD**: Test HTTP POST with correct payload
  - **TDD**: Test disable_notification for info severity
  - **TDD**: Test error handling for invalid chat_id

  **Must NOT do**:
  - No inline keyboards
  - No file uploads
  - No webhook setup (polling only via TelegramChannel)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Third-party API integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 9, 11, 12, 13)
  - **Blocks**: Task 20
  - **Blocked By**: Task 8

  **References**:
  - **External**: `https://core.telegram.org/bots/api#sendmessage` - Telegram Bot API

  **Acceptance Criteria**:
  - [ ] `TelegramChannel.send()` POSTs to correct API endpoint
  - [ ] `formatMessage()` includes: emoji, title, severity, source, timestamp
  - [ ] `disable_notification: true` for severity=info
  - [ ] Test file: `test/channels/telegram.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: Telegram message format validation
    Tool: Bash
    Preconditions: TelegramChannel implemented
    Steps:
      1. Create alert
      2. Call formatMessage(alert)
      3. Assert valid Markdown with required fields
    Expected Result: Valid Telegram Markdown
    Evidence: .sisyphus/evidence/task-10-telegram-format.txt

  Scenario: HTTP POST to Telegram API
    Tool: Bash (mock fetch)
    Steps:
      1. Mock fetch
      2. Call send()
      3. Assert URL includes bot token, body has chat_id and text
    Expected Result: Correct API call
    Evidence: .sisyphus/evidence/task-10-telegram-api.txt

  Scenario: Disable notification for info alerts
    Tool: Bash
    Steps:
      1. Create info-level alert
      2. Call send()
      3. Assert body includes disable_notification: true
    Expected Result: Info alerts don't trigger notification sound
    Evidence: .sisyphus/evidence/task-10-telegram-quiet.txt
  ```

  **Commit**: YES - `feat(channel): add telegram channel with markdown formatting`

---

- [ ] 11. **Webhook channel adapter (with HMAC)**

  **What to do**:
  - Create `src/channels/webhook.ts` with `WebhookChannel` class
  - Implement `send()`: POST to webhook URL with HMAC signature
  - Implement HMAC signature: `crypto.subtle.sign('HMAC', key, payload)`
  - Implement `formatMessage()`: JSON payload with alert + metadata
  - **TDD**: Test HMAC signature generation
  - **TDD**: Test HTTP POST with signature header
  - **TDD**: Test payload structure includes alert + metadata
  - **TDD**: Test retry on 5xx errors

  **Must NOT do**:
  - No webhook signature verification (receiver-side)
  - No webhook URL validation
  - No payload size limits (assume reasonable)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Cryptographic signature + HTTP integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 9, 10, 12, 13)
  - **Blocks**: Task 20
  - **Blocked By**: Task 8

  **References**:
  - **External**: `https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries` - HMAC pattern
  - **Pattern**: HMAC-SHA256 signature with shared secret

  **Acceptance Criteria**:
  - [ ] `WebhookChannel.send()` POSTs with `X-Webhook-Signature` header
  - [ ] HMAC signature is valid SHA-256 hex digest
  - [ ] Payload includes: alert, metadata (instanceId, workflowName, timestamp)
  - [ ] Test file: `test/channels/webhook.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: HMAC signature generation
    Tool: Bash
    Preconditions: WebhookChannel implemented
    Steps:
      1. Create payload object
      2. Generate signature with known secret
      3. Assert signature is valid hex SHA-256
    Expected Result: Valid HMAC signature
    Evidence: .sisyphus/evidence/task-11-hmac-signature.txt

  Scenario: HTTP POST with signature header
    Tool: Bash (mock fetch)
    Steps:
      1. Mock fetch
      2. Call send()
      3. Assert headers include X-Webhook-Signature
      4. Assert body is valid JSON
    Expected Result: Webhook sent with signature
    Evidence: .sisyphus/evidence/task-11-webhook-payload.txt

  Scenario: Payload includes metadata
    Tool: Bash
    Steps:
      1. Call send() with instanceId and workflowName
      2. Parse request body
      3. Assert metadata.workflowInstanceId and metadata.workflowName present
    Expected Result: Metadata included for receiver verification
    Evidence: .sisyphus/evidence/task-11-webhook-metadata.txt
  ```

  **Commit**: YES - `feat(channel): add webhook channel with HMAC signature`

---

- [ ] 12. **Cloudflare billing source adapter**

  **What to do**:
  - Create `src/adapters/cloudflare-billing.ts` with `CloudflareBillingAdapter` class
  - Implement `fetchMetrics()`: GET Cloudflare billing API endpoint
  - Implement `normalize()`: Convert API response to `MetricData` format
  - Implement rate limiting: `step.sleep()` before requests
  - **TDD**: Test API request with correct auth header
  - **TDD**: Test response normalization to MetricData
  - **TDD**: Test rate limiting via step.sleep()
  - **TDD**: Test error handling for 401/403/429

  **Must NOT do**:
  - No billing data caching (always fetch fresh)
  - No historical aggregation
  - No cost projection (only current billing)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Third-party API + rate limiting
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-11, 13)
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 1, 4, 5, 6

  **References**:
  - **External**: `https://developers.cloudflare.com/api/operations/billing-history-list` - CF billing API
  - **Pattern**: Per-adapter rate limiting via step.sleep()

  **Acceptance Criteria**:
  - [ ] `fetchMetrics()` calls correct API endpoint with auth
  - [ ] `normalize()` converts to MetricData with: cost, timestamp, currency
  - [ ] Rate limiting via `step.sleep('1s')` before requests
  - [ ] Test file: `test/adapters/cloudflare-billing.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: API request with authentication
    Tool: Bash (mock fetch)
    Preconditions: CloudflareBillingAdapter implemented
    Steps:
      1. Mock fetch to return sample billing response
      2. Call fetchMetrics()
      3. Assert fetch called with correct URL, Authorization header
    Expected Result: Authenticated API request
    Evidence: .sisyphus/evidence/task-12-cf-api-request.txt

  Scenario: Response normalization
    Tool: Bash
    Steps:
      1. Provide sample API response
      2. Call normalize(response)
      3. Assert output is MetricData with cost, timestamp, currency
    Expected Result: Normalized metric data
    Evidence: .sisyphus/evidence/task-12-cf-normalize.txt

  Scenario: Rate limiting via step.sleep
    Tool: Bash (mock step)
    Steps:
      1. Mock step.do and step.sleep
      2. Call fetchMetrics()
      3. Assert step.sleep called with '1 second' or similar
    Expected Result: Rate limit enforced
    Evidence: .sisyphus/evidence/task-12-cf-rate-limit.txt
  ```

  **Commit**: YES - `feat(adapter): add cloudflare billing source adapter`

---

- [ ] 13. **Config loader (TypeScript + KV merge)**

  **What to do**:
  - Create `src/config/loader.ts` with `loadConfig(env)` function
  - Load TypeScript config from `config/app.config.ts` (compile-time)
  - Merge with runtime overrides from KV
  - Validate with Zod schema
  - **TDD**: Test loading from TypeScript config
  - **TDD**: Test merging with KV overrides
  - **TDD**: Test validation errors with clear messages
  - **TDD**: Test caching loaded config (avoid re-parsing)

  **Must NOT do**:
  - No hot-reload of config (requires redeploy)
  - No config file watching
  - No env variable support (Workers Secrets only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Config system with validation
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-12)
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 1, 2

  **References**:
  - **Pattern**: Layered config (static + runtime overrides)
  - **External**: `https://zod.dev/` - Zod validation

  **Acceptance Criteria**:
  - [ ] `loadConfig(env)` returns validated `AppConfig`
  - [ ] KV overrides take precedence over TypeScript config
  - [ ] Invalid config throws with field path
  - [ ] Test file: `test/config/loader.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: Load config from TypeScript
    Tool: Bash
    Preconditions: config/app.config.ts exists
    Steps:
      1. Call loadConfig(mockEnv)
      2. Assert returns AppConfig with sources, channels, rules
    Expected Result: Config loaded successfully
    Evidence: .sisyphus/evidence/task-13-config-load.txt

  Scenario: KV overrides take precedence
    Tool: Bash
    Steps:
      1. Mock KV with override values
      2. Call loadConfig()
      3. Assert KV values override TypeScript defaults
    Expected Result: KV overrides applied
    Evidence: .sisyphus/evidence/task-13-config-override.txt

  Scenario: Validation errors include field path
    Tool: Bash
    Steps:
      1. Provide invalid config
      2. Call loadConfig()
      3. Assert throws with field path in error message
    Expected Result: Clear validation error
    Evidence: .sisyphus/evidence/task-13-config-validation.txt
  ```

  **Commit**: YES - `feat(config): add config loader with KV override`

---

- [ ] 14. **AnyRouter source adapter**

  **What to do**:
  - Create `src/adapters/anyrouter.ts` with `AnyRouterAdapter` class
  - Implement `fetchMetrics()`: GET AnyRouter admin API endpoint
  - Implement `normalize()`: Convert response to `MetricData` format
  - Use `mcp__anyrouter__admin_overview` and related MCP tools (or direct API)
  - **TDD**: Test API request with API key
  - **TDD**: Test response normalization
  - **TDD**: Test error handling for 401/429/500
  - **TDD**: Test retry with exponential backoff

  **Must NOT do**:
  - No usage data aggregation
  - No cost calculation (AnyRouter provides pre-calculated)
  - No historical tracking (current snapshot only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Third-party API integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15-18)
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 1, 4, 5, 6

  **References**:
  - **External**: AnyRouter admin API documentation (via MCP tools)
  - **Pattern**: Same as Cloudflare billing adapter

  **Acceptance Criteria**:
  - [ ] `fetchMetrics()` calls AnyRouter admin API
  - [ ] `normalize()` converts to MetricData
  - [ ] Rate limiting via `step.sleep()`
  - [ ] Test file: `test/adapters/anyrouter.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: AnyRouter API request
    Tool: Bash (mock fetch)
    Preconditions: AnyRouterAdapter implemented
    Steps:
      1. Mock fetch with sample admin response
      2. Call fetchMetrics()
      3. Assert correct API endpoint and auth header
    Expected Result: Authenticated API request
    Evidence: .sisyphus/evidence/task-14-anyrouter-request.txt

  Scenario: Response normalization
    Tool: Bash
    Steps:
      1. Provide sample admin response
      2. Call normalize()
      3. Assert MetricData with cost, usage, timestamp
    Expected Result: Normalized data
    Evidence: .sisyphus/evidence/task-14-anyrouter-normalize.txt

  Scenario: Error handling
    Tool: Bash
    Steps:
      1. Mock fetch to return 429
      2. Call fetchMetrics()
      3. Assert retries with backoff
    Expected Result: Rate limit error handled
    Evidence: .sisyphus/evidence/task-14-anyrouter-error.txt
  ```

  **Commit**: YES - `feat(adapter): add anyrouter admin source adapter`

---

- [ ] 15. **GCP billing source adapter**

  **What to do**:
  - Create `src/adapters/gcp-billing.ts` with `GcpBillingAdapter` class
  - Implement `fetchMetrics()`: GET GCP Cloud Billing API
  - Implement OAuth2 authentication: Service account JWT → access token
  - Implement `normalize()`: Convert to `MetricData` format
  - **TDD**: Test JWT generation for service account
  - **TDD**: Test access token exchange
  - **TDD**: Test API request with Bearer token
  - **TDD**: Test response normalization
  - **TDD**: Test error handling for 401/403/429

  **Must NOT do**:
  - No billing data caching
  - No cost projection
  - No multi-project aggregation (single project per adapter instance)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - OAuth2 + JWT + API integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 14, 16-18)
  - **Blocks**: Task 19
  - **Blocked By**: Tasks 1, 4, 5, 6

  **References**:
  - **External**: `https://cloud.google.com/billing/docs/apis` - GCP Billing API
  - **External**: `https://developers.google.com/identity/protocols/oauth2/service-account` - Service account auth
  - **Pattern**: JWT signing with crypto.subtle

  **Acceptance Criteria**:
  - [ ] JWT generated with correct claims (iss, sub, aud, scope, iat, exp)
  - [ ] Access token exchanged via token endpoint
  - [ ] `fetchMetrics()` calls GCP Billing API with Bearer token
  - [ ] `normalize()` converts to MetricData
  - [ ] Test file: `test/adapters/gcp-billing.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: JWT generation for service account
    Tool: Bash
    Preconditions: GcpBillingAdapter implemented
    Steps:
      1. Provide service account JSON
      2. Generate JWT
      3. Assert JWT has correct header (alg: RS256) and claims
    Expected Result: Valid JWT
    Evidence: .sisyphus/evidence/task-15-gcp-jwt.txt

  Scenario: Access token exchange
    Tool: Bash (mock fetch)
    Steps:
      1. Mock token endpoint
      2. Exchange JWT for access token
      3. Assert token stored and used in subsequent requests
    Expected Result: Access token obtained
    Evidence: .sisyphus/evidence/task-15-gcp-token.txt

  Scenario: API request with Bearer token
    Tool: Bash
    Steps:
      1. Mock billing API
      2. Call fetchMetrics()
      3. Assert Authorization: Bearer {token} header
    Expected Result: Authenticated request
    Evidence: .sisyphus/evidence/task-15-gcp-request.txt
  ```

  **Commit**: YES - `feat(adapter): add GCP billing source adapter with OAuth2`

---

- [ ] 16. **Cron dispatcher Workflow**

  **What to do**:
  - Create `src/workflows/dispatcher.ts` with `CronDispatcherWorkflow` class
  - Triggered by cron: `*/15 * * * *` (1 of 5 free crons)
  - Load config via `loadConfig(env)`
  - For each enabled source, create source-specific Workflow instance
  - Use deterministic instance IDs: `${sourceId}-${scheduledTime}`
  - **TDD**: Test dispatcher creates workflow instances
  - **TDD**: Test instance ID format is deterministic
  - **TDD**: Test disabled sources are skipped
  - **TDD**: Test error handling (one source failure doesn't block others)

  **Must NOT do**:
  - No parallel source processing (sequential is fine for v1)
  - No aggregation of results
  - No retry logic at dispatcher level (source workflows handle their own)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Workflow orchestration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 14, 15, 17, 18)
  - **Blocks**: Tasks 17-19, 22
  - **Blocked By**: Tasks 1, 4, 12, 13, 14, 15

  **References**:
  - **External**: `https://developers.cloudflare.com/workflows/build/trigger-workflows/` - Trigger patterns
  - **Pattern**: Single cron dispatcher with fan-out

  **Acceptance Criteria**:
  - [ ] `CronDispatcherWorkflow` triggered by cron
  - [ ] Creates source-specific workflow instance for each enabled source
  - [ ] Instance ID format: `${sourceId}-${scheduledTime}`
  - [ ] Errors isolated per source (one failure doesn't block others)
  - [ ] Test file: `test/workflows/dispatcher.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: Dispatcher creates workflow instances
    Tool: Bash (miniflare)
    Preconditions: CronDispatcherWorkflow implemented
    Steps:
      1. Mock env with 3 sources (2 enabled, 1 disabled)
      2. Trigger workflow
      3. Assert 2 workflow instances created
      4. Assert disabled source skipped
    Expected Result: Correct instances created
    Evidence: .sisyphus/evidence/task-16-dispatcher-instances.txt

  Scenario: Deterministic instance IDs
    Tool: Bash
    Steps:
      1. Trigger dispatcher twice with same scheduledTime
      2. Assert same instance IDs generated
    Expected Result: Deterministic IDs
    Evidence: .sisyphus/evidence/task-16-dispatcher-ids.txt

  Scenario: Error isolation
    Tool: Bash
    Steps:
      1. Mock one source to throw error
      2. Trigger dispatcher
      3. Assert other sources still create instances
    Expected Result: Errors don't block other sources
    Evidence: .sisyphus/evidence/task-16-dispatcher-error-isolation.txt
  ```

  **Commit**: YES - `feat(workflow): add cron dispatcher with source fan-out`

---

- [ ] 17. **Source-specific Workflow (CF billing)**

  **What to do**:
  - Create `src/workflows/cf-billing.ts` with `CfBillingWorkflow` class
  - Step 1: Fetch metrics via `CloudflareBillingAdapter.fetchMetrics()`
  - Step 2: Evaluate thresholds via `evaluateAlerts(metrics, config)`
  - Step 3: If alerts exist, trigger `AlertDispatchWorkflow` for each
  - **TDD**: Test workflow executes steps in order
  - **TDD**: Test alert evaluation against thresholds
  - **TDD**: Test conditional trigger of alert dispatch
  - **TDD**: Test error handling (fetch failure → retry, threshold error → fail)

  **Must NOT do**:
  - No state persistence beyond step returns
  - No manual approval flow
  - No alert acknowledgment (v1 is fire-and-forget)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Workflow + adapter integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 14, 15, 16, 18)
  - **Blocks**: Task 22
  - **Blocked By**: Tasks 1, 12, 16

  **References**:
  - **External**: `https://developers.cloudflare.com/workflows/build/workers-api/` - Workflow API
  - **Pattern**: Multi-step workflow with conditional branching

  **Acceptance Criteria**:
  - [ ] `CfBillingWorkflow` calls CloudflareBillingAdapter
  - [ ] Evaluates metrics against configured thresholds
  - [ ] Triggers AlertDispatchWorkflow if alerts exist
  - [ ] Test file: `test/workflows/cf-billing.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: Workflow executes steps in order
    Tool: Bash (miniflare)
    Preconditions: CfBillingWorkflow implemented
    Steps:
      1. Mock adapter to return metrics
      2. Trigger workflow
      3. Assert step.do called in correct order
    Expected Result: Steps execute sequentially
    Evidence: .sisyphus/evidence/task-17-cf-workflow-steps.txt

  Scenario: Alert evaluation
    Tool: Bash
    Steps:
      1. Provide metrics exceeding threshold
      2. Run workflow
      3. Assert AlertDispatchWorkflow triggered
    Expected Result: Alerts trigger dispatch
    Evidence: .sisyphus/evidence/task-17-cf-alert-eval.txt

  Scenario: No alerts when below threshold
    Tool: Bash
    Steps:
      1. Provide metrics below threshold
      2. Run workflow
      3. Assert no dispatch triggered
    Expected Result: No false alerts
    Evidence: .sisyphus/evidence/task-17-cf-no-alert.txt
  ```

  **Commit**: YES - `feat(workflow): add Cloudflare billing source workflow`

---

- [ ] 18. **Source-specific Workflow (AnyRouter)**

  **What to do**:
  - Create `src/workflows/anyrouter.ts` with `AnyRouterWorkflow` class
  - Same pattern as CfBillingWorkflow but uses `AnyRouterAdapter`
  - Step 1: Fetch metrics
  - Step 2: Evaluate thresholds
  - Step 3: Trigger AlertDispatchWorkflow
  - **TDD**: Test workflow with AnyRouter adapter
  - **TDD**: Test threshold evaluation
  - **TDD**: Test alert dispatch trigger

  **Must NOT do**:
  - No AnyRouter-specific logic beyond adapter usage
  - No state beyond step returns
  - No manual approval

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Workflow + adapter integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 14, 15, 16, 17)
  - **Blocks**: Task 22
  - **Blocked By**: Tasks 1, 14, 16

  **References**:
  - **External**: `https://developers.cloudflare.com/workflows/build/workers-api/` - Workflow API
  - **Pattern**: Same as CfBillingWorkflow

  **Acceptance Criteria**:
  - [ ] `AnyRouterWorkflow` calls AnyRouterAdapter
  - [ ] Evaluates metrics against thresholds
  - [ ] Triggers AlertDispatchWorkflow
  - [ ] Test file: `test/workflows/anyrouter.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: Workflow with AnyRouter adapter
    Tool: Bash (miniflare)
    Preconditions: AnyRouterWorkflow implemented
    Steps:
      1. Mock AnyRouterAdapter
      2. Trigger workflow
      3. Assert metrics fetched, evaluated, alerts dispatched
    Expected Result: Workflow completes successfully
    Evidence: .sisyphus/evidence/task-18-anyrouter-workflow.txt
  ```

  **Commit**: YES - `feat(workflow): add AnyRouter source workflow`

---

- [ ] 19. **Source-specific Workflow (GCP billing)**

  **What to do**:
  - Create `src/workflows/gcp-billing.ts` with `GcpBillingWorkflow` class
  - Same pattern as CfBillingWorkflow but uses `GcpBillingAdapter`
  - Step 1: Fetch metrics
  - Step 2: Evaluate thresholds
  - Step 3: Trigger AlertDispatchWorkflow
  - **TDD**: Test workflow with GCP adapter
  - **TDD**: Test OAuth2 token refresh
  - **TDD**: Test alert evaluation and dispatch

  **Must NOT do**:
  - No GCP-specific logic beyond adapter usage
  - No state beyond step returns
  - No manual approval

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Workflow + adapter integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 20-24)
  - **Blocks**: Task 22
  - **Blocked By**: Tasks 1, 15, 16

  **References**:
  - **External**: `https://developers.cloudflare.com/workflows/build/workers-api/` - Workflow API
  - **Pattern**: Same as CfBillingWorkflow

  **Acceptance Criteria**:
  - [ ] `GcpBillingWorkflow` calls GcpBillingAdapter
  - [ ] Evaluates metrics against thresholds
  - [ ] Triggers AlertDispatchWorkflow
  - [ ] Test file: `test/workflows/gcp-billing.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: Workflow with GCP adapter
    Tool: Bash (miniflare)
    Preconditions: GcpBillingWorkflow implemented
    Steps:
      1. Mock GcpBillingAdapter
      2. Trigger workflow
      3. Assert metrics fetched, evaluated, alerts dispatched
    Expected Result: Workflow completes successfully
    Evidence: .sisyphus/evidence/task-19-gcp-workflow.txt
  ```

  **Commit**: YES - `feat(workflow): add GCP billing source workflow`

---

- [ ] 20. **Alert dispatch Workflow (fan-out to channels)**

  **What to do**:
  - Create `src/workflows/alert-dispatch.ts` with `AlertDispatchWorkflow` class
  - Fan-out: For each alert, send to all configured channels
  - Step 1: Write alert to D1 history
  - Step 2: For each channel, call `channel.send(alert)` with idempotency check
  - Step 3: Update D1 history with delivery status
  - **TDD**: Test fan-out to multiple channels
  - **TDD**: Test D1 history writing
  - **TDD**: Test idempotency prevents duplicate sends
  - **TDD**: Test partial failure handling (some channels fail)

  **Must NOT do**:
  - No alert acknowledgment
  - No alert resolution tracking
  - No alert aggregation

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Workflow + channel fan-out
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19, 21-24)
  - **Blocks**: Task 22
  - **Blocked By**: Tasks 1, 8, 9, 10, 11, 21

  **References**:
  - **External**: `https://developers.cloudflare.com/workflows/build/workers-api/` - Workflow API
  - **Pattern**: Fan-out workflow with idempotency

  **Acceptance Criteria**:
  - [ ] `AlertDispatchWorkflow` fans out to all configured channels
  - [ ] Writes alert to D1 history before sending
  - [ ] Idempotency check via KV (24h TTL)
  - [ ] Partial failures don't block other channels
  - [ ] Test file: `test/workflows/alert-dispatch.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: Fan-out to multiple channels
    Tool: Bash (miniflare)
    Preconditions: AlertDispatchWorkflow implemented
    Steps:
      1. Configure 3 channels (slack, telegram, webhook)
      2. Trigger workflow with alert
      3. Assert all 3 channels receive alert
    Expected Result: All channels notified
    Evidence: .sisyphus/evidence/task-20-dispatch-fanout.txt

  Scenario: Idempotency prevents duplicate
    Tool: Bash
    Steps:
      1. Trigger workflow with same alert twice
      2. Assert second send skipped (KV check)
    Expected Result: No duplicate sends
    Evidence: .sisyphus/evidence/task-20-dispatch-idempotency.txt

  Scenario: Partial failure handling
    Tool: Bash
    Steps:
      1. Mock one channel to fail
      2. Trigger workflow
      3. Assert other channels still receive alert
    Expected Result: Failures isolated
    Evidence: .sisyphus/evidence/task-20-dispatch-partial-fail.txt
  ```

  **Commit**: YES - `feat(workflow): add alert dispatch with channel fan-out`

---

- [ ] 21. **D1 alert history writer**

  **What to do**:
  - Create `src/db/history.ts` with `writeAlertHistory(alert, env)` and `updateDeliveryStatus(alertId, channel, status, env)`
  - Use Drizzle ORM for type-safe queries
  - Insert into `alert_history` table with: id, source, severity, cost, threshold, channels, sent_at
  - **TDD**: Test insert query
  - **TDD**: Test update query for delivery status
  - **TDD**: Test query with indexes (performance)
  - **TDD**: Test transaction handling for atomicity

  **Must NOT do**:
  - No history aggregation/analytics
  - No history retention policy (manual cleanup)
  - No history export

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Database operations
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19, 20, 22-24)
  - **Blocks**: Task 20
  - **Blocked By**: Task 6

  **References**:
  - **External**: `https://orm.drizzle.team/docs/get-started-sqlite` - Drizzle ORM
  - **Pattern**: Repository pattern for data access

  **Acceptance Criteria**:
  - [ ] `writeAlertHistory()` inserts alert with all fields
  - [ ] `updateDeliveryStatus()` updates delivery result
  - [ ] Queries use indexes for performance
  - [ ] Test file: `test/db/history.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: Insert alert history
    Tool: Bash (miniflare D1)
    Preconditions: writeAlertHistory implemented
    Steps:
      1. Call writeAlertHistory(sampleAlert, mockEnv)
      2. Query D1, assert record exists
    Expected Result: Alert stored
    Evidence: .sisyphus/evidence/task-21-history-insert.txt

  Scenario: Update delivery status
    Tool: Bash
    Steps:
      1. Write alert
      2. Call updateDeliveryStatus with success
      3. Query D1, assert status updated
    Expected Result: Status tracked
    Evidence: .sisyphus/evidence/task-21-history-update.txt

  Scenario: Query uses index
    Tool: Bash
    Steps:
      1. Run EXPLAIN QUERY PLAN on indexed query
      2. Assert index is used
    Expected Result: Index utilized
    Evidence: .sisyphus/evidence/task-21-history-index.txt
  ```

  **Commit**: YES - `feat(db): add alert history writer with Drizzle`

---

- [ ] 22. **Worker entrypoint + cron handler**

  **What to do**:
  - Update `src/index.ts` with full Worker implementation
  - Export default object with `fetch` and `scheduled` handlers
  - `scheduled()`: Trigger `CronDispatcherWorkflow`
  - `fetch()`: Health check endpoint (GET /) and workflow status (GET /workflows/:id)
  - Register all workflows in wrangler.jsonc
  - **TDD**: Test scheduled handler triggers dispatcher
  - **TDD**: Test fetch handler returns health check
  - **TDD**: Test fetch handler returns workflow status
  - **TDD**: Test error handling (invalid route, workflow not found)

  **Must NOT do**:
  - No API for manual workflow triggering (v1 is cron-only)
  - No authentication on fetch endpoints (internal use only)
  - No CORS handling

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - Worker integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19-21, 23, 24)
  - **Blocks**: Task 23
  - **Blocked By**: Tasks 1, 16, 17, 18, 19, 20

  **References**:
  - **External**: `https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/` - Scheduled handler
  - **Pattern**: Worker entrypoint with multiple handlers

  **Acceptance Criteria**:
  - [ ] `scheduled()` triggers `CronDispatcherWorkflow`
  - [ ] `fetch()` handles GET / (health check)
  - [ ] `fetch()` handles GET /workflows/:id (status)
  - [ ] All 5 workflows registered in wrangler.jsonc
  - [ ] Test file: `test/index.test.ts` covers all cases

  **QA Scenarios**:
  ```
  Scenario: Scheduled handler triggers dispatcher
    Tool: Bash (miniflare)
    Preconditions: Worker entrypoint implemented
    Steps:
      1. Mock scheduled controller
      2. Call scheduled(controller, env)
      3. Assert CronDispatcherWorkflow.create() called
    Expected Result: Dispatcher triggered
    Evidence: .sisyphus/evidence/task-22-scheduled-trigger.txt

  Scenario: Health check endpoint
    Tool: Bash
    Steps:
      1. Send GET / request
      2. Assert response 200 with { status: 'ok' }
    Expected Result: Health check works
    Evidence: .sisyphus/evidence/task-22-health-check.txt

  Scenario: Workflow status endpoint
    Tool: Bash
    Steps:
      1. Create workflow instance
      2. Send GET /workflows/:id
      3. Assert returns workflow status
    Expected Result: Status retrievable
    Evidence: .sisyphus/evidence/task-22-workflow-status.txt
  ```

  **Commit**: YES - `feat(worker): add entrypoint with scheduled and fetch handlers`

---

- [ ] 23. **CLI tool (deploy, logs, test)**

  **What to do**:
  - Create `src/cli/index.ts` with CLI entrypoint using `bun run` or `node --experimental-strip-types`
  - Commands: `deploy`, `dev`, `logs`, `test`, `migrate`
  - Use simple argument parsing (no external CLI framework)
  - **TDD**: Test CLI argument parsing
  - **TDD**: Test `deploy` command runs `wrangler deploy`
  - **TDD**: Test `logs` command runs `wrangler tail`
  - **TDD**: Test `migrate` command runs D1 migrations

  **Must NOT do**:
  - No interactive prompts (v1 is command-only)
  - No config editing via CLI
  - No workflow triggering via CLI

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - CLI tooling
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19-22, 24)
  - **Blocks**: None
  - **Blocked By**: Task 22

  **References**:
  - **External**: `https://developers.cloudflare.com/workers/wrangler/commands/` - wrangler commands
  - **Pattern**: Thin CLI wrapper around wrangler

  **Acceptance Criteria**:
  - [ ] `bun run cli deploy` runs `wrangler deploy`
  - [ ] `bun run cli dev` runs `wrangler dev`
  - [ ] `bun run cli logs` runs `wrangler tail`
  - [ ] `bun run cli test` runs `vitest`
  - [ ] `bun run cli migrate` runs D1 migrations
  - [ ] Test file: `test/cli/index.test.ts` covers all commands

  **QA Scenarios**:
  ```
  Scenario: Deploy command
    Tool: Bash
    Preconditions: CLI implemented
    Steps:
      1. Run `bun run cli deploy --dry-run`
      2. Assert wrangler deploy --dry-run executed
    Expected Result: Deploy command works
    Evidence: .sisyphus/evidence/task-23-cli-deploy.txt

  Scenario: Test command
    Tool: Bash
    Steps:
      1. Run `bun run cli test`
      2. Assert vitest executed
      3. Assert exit code 0
    Expected Result: Test command works
    Evidence: .sisyphus/evidence/task-23-cli-test.txt

  Scenario: Invalid command
    Tool: Bash
    Steps:
      1. Run `bun run cli invalid-command`
      2. Assert error message + non-zero exit code
    Expected Result: Clear error for invalid command
    Evidence: .sisyphus/evidence/task-23-cli-error.txt
  ```

  **Commit**: YES - `feat(cli): add deploy/dev/logs/test/migrate commands`

---

- [ ] 24. **README + extension guide**

  **What to do**:
  - Create `README.md` with: project overview, architecture diagram, setup instructions
  - Create `docs/EXTENDING.md` with: how to add a new source adapter, how to add a new alert channel
  - Create `docs/COST.md` with: cost analysis (invocations, duration, storage)
  - Create `docs/CONFIG.md` with: configuration reference
  - **TDD**: Test that README code examples are valid (syntax check)
  - **TDD**: Test that extension guide templates compile

  **Must NOT do**:
  - No API reference (generated from types)
  - No tutorial (focus on extension)
  - No marketing copy

  **Recommended Agent Profile**:
  - **Category**: `writing` - Documentation
  - **Skills**: `documentation`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19-23)
  - **Blocks**: None
  - **Blocked By**: All implementation tasks

  **References**:
  - **External**: `https://developers.cloudflare.com/workflows/` - Workflow docs
  - **Pattern**: README with quick start + architecture + extension

  **Acceptance Criteria**:
  - [ ] README has: overview, architecture, setup, usage
  - [ ] EXTENDING.md has: adapter template, channel template, step-by-step
  - [ ] COST.md has: invocation costs, storage costs, optimization tips
  - [ ] CONFIG.md has: all config fields with examples
  - [ ] Test file: `test/docs/syntax.test.ts` validates code examples

  **QA Scenarios**:
  ```
  Scenario: README setup instructions work
    Tool: Bash
    Preconditions: README written
    Steps:
      1. Follow README setup steps in clean directory
      2. Assert project initializes successfully
    Expected Result: Setup works
    Evidence: .sisyphus/evidence/task-24-readme-setup.txt

  Scenario: Extension guide template compiles
    Tool: Bash
    Steps:
      1. Copy adapter template from EXTENDING.md
      2. Replace placeholders
      3. Assert tsc --noEmit passes
    Expected Result: Template is valid
    Evidence: .sisyphus/evidence/task-24-extension-template.txt
  ```

  **Commit**: YES - `docs: add README, extension guide, cost analysis, config reference`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run test). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `vitest run`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (workflows triggering, channels receiving, D1 history writing). Test edge cases: empty config, invalid credentials, rate limits, D1 unavailable. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

Each task commits independently with semantic message format:
- `feat(scaffold): initialize worker project with wrangler config`
- `test(config): add TDD tests for TypeScript config loader`
- `feat(config): implement TypeScript config loader`
- `refactor(config): simplify config validation`
- `feat(adapter): add base adapter interface and registry`
- `feat(channel): add slack channel with idempotency`
- `feat(workflow): add cron dispatcher with granularity branching`
- `feat(source): add cloudflare billing adapter`
- `feat(db): add D1 schema and migrations`
- `feat(cli): add deploy/logs/test commands`
- `docs: add README and extension guide`

---

## Success Criteria

### Verification Commands
```bash
# Type check
bunx tsc --noEmit  # Expected: 0 errors

# Run tests
bun test  # Expected: all pass

# Lint
bunx biome check .  # Expected: 0 issues

# Local dev
wrangler dev  # Expected: Worker starts, cron triggers work

# Deploy
wrangler deploy  # Expected: deployment succeeds

# D1 migrations
wrangler d1 migrations apply onalert-db --remote  # Expected: migrations applied

# KV namespace
wrangler kv:namespace create CONFIG_KV  # Expected: namespace created
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (TDD cycle completed)
- [ ] Type check passes
- [ ] Lint passes
- [ ] Local dev works
- [ ] wrangler deploy succeeds
- [ ] D1 migrations applied
- [ ] All 3 adapters functional
- [ ] All 3 channels functional
- [ ] Cron dispatcher works
- [ ] Alert history in D1
- [ ] README documents extension
- [ ] Cost analysis documented
