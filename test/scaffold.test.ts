import { describe, it, expect } from "vitest";
import wranglerConfig from "../wrangler.jsonc" with { type: "json" };
import indexSource from "../src/index.ts" with { type: "text" };

describe("Project scaffolding", () => {
  it("wrangler.jsonc has required basic fields", () => {
    expect(wranglerConfig.name).toBe("onewf");
    expect(wranglerConfig.main).toBe("src/index.ts");
    expect(wranglerConfig.compatibility_date).toBe("2026-06-01");
  });

  it("wrangler.jsonc has cron trigger", () => {
    expect(wranglerConfig.triggers?.crons).toContain("*/15 * * * *");
  });

  it("wrangler.jsonc has workflow bindings", () => {
    const workflowNames = wranglerConfig.workflows?.map((w: { class_name: string }) => w.class_name) ?? [];
    expect(workflowNames).toContain("CronDispatcherWorkflow");
    expect(workflowNames).toContain("CfBillingWorkflow");
    expect(workflowNames).toContain("AnyRouterWorkflow");
    expect(workflowNames).toContain("GcpBillingWorkflow");
    expect(workflowNames).toContain("AlertDispatchWorkflow");
    const names = wranglerConfig.workflows?.map((w: { name: string }) => w.name) ?? [];
    expect(names).toContain("CRON_DISPATCHER");
    expect(names).toContain("CF_BILLING");
    expect(names).toContain("ANYROUTER");
    expect(names).toContain("GCP_BILLING");
    expect(names).toContain("ALERT_DISPATCH");
  });

  it("wrangler.jsonc has observability enabled", () => {
    expect(wranglerConfig.observability?.enabled).toBe(true);
  });

  it("wrangler.jsonc has D1, KV, R2 bindings", () => {
    expect(wranglerConfig.d1_databases?.[0]?.binding).toBe("DB");
    expect(wranglerConfig.kv_namespaces?.some((k: { binding: string }) => k.binding === "CONFIG_KV")).toBe(true);
    expect(wranglerConfig.kv_namespaces?.some((k: { binding: string }) => k.binding === "IDEMPOTENCY_KV")).toBe(true);
    expect(wranglerConfig.r2_buckets?.[0]?.binding).toBe("R2");
  });

  it("wrangler.jsonc has limits configured", () => {
    expect(wranglerConfig.limits?.cpu_ms).toBe(50);
    expect(wranglerConfig.limits?.memory_mb).toBe(128);
  });
});

describe("Worker entrypoint", () => {
  it("src/index.ts exports fetch and scheduled handlers", () => {
    expect(indexSource).toContain("async fetch");
    expect(indexSource).toContain("async scheduled");
  });

  it("src/index.ts exports all workflow classes", () => {
    expect(indexSource).toContain("export { CronDispatcherWorkflow, CfBillingWorkflow, AnyRouterWorkflow, GcpBillingWorkflow, AlertDispatchWorkflow }");
  });
});