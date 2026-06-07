import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWebhook } from "../../src/webhooks/handler";
import type { Env } from "../../src/index";

vi.mock("../../src/db/client", () => ({
  createDbClient: vi.fn(() => ({})),
}));

vi.mock("../../src/db/queries", () => ({
  createWebhookEvent: vi.fn().mockResolvedValue(undefined),
  markWebhookEventProcessed: vi.fn().mockResolvedValue(undefined),
}));

describe("Webhook Handler", () => {
  let mockEnv: Env;
  let mockReq: Request;

  beforeEach(() => {
    vi.resetAllMocks();
    mockEnv = {
      DB: {} as any,
      CONFIG_KV: {} as any,
      IDEMPOTENCY_KV: {} as any,
      R2: {} as any,
      CRON_DISPATCHER: {} as any,
      CF_BILLING: {} as any,
      ANYROUTER: {} as any,
      GCP_BILLING: {} as any,
      ALERT_DISPATCH: {} as any,
      CLERK_WEBHOOK_SECRET: "test-clerk-secret",
      GCP_WEBHOOK_SECRET: "test-gcp-secret",
      GENERIC_WEBHOOK_SECRET: "test-generic-secret",
    };
  });

  it("returns 400 for unknown webhook source", async () => {
    mockReq = new Request("https://example.com/webhooks/unknown", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
    });

    const response = await handleWebhook(mockReq, mockEnv, "unknown");
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Unknown webhook source");
  });

  it("returns 400 for missing source in path", async () => {
    mockReq = new Request("https://example.com/webhooks/", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
    });

    const response = await handleWebhook(mockReq, mockEnv, "");
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Webhook source required");
  });

  it("returns 401 for invalid Clerk signature", async () => {
    mockReq = new Request("https://example.com/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-signature": "invalid-signature",
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "user.created", data: { id: "user_123" } }),
    });

    const response = await handleWebhook(mockReq, mockEnv, "clerk");
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Invalid signature");
  });

  it("accepts valid GCP webhook with Bearer token", async () => {
    mockReq = new Request("https://example.com/webhooks/gcp", {
      method: "POST",
      headers: {
        "authorization": "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: { attributes: { eventType: "billing.updated" } } }),
    });

    const response = await handleWebhook(mockReq, mockEnv, "gcp");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; eventId: string };
    expect(body.success).toBe(true);
    expect(body.eventId).toBeDefined();
  });

  it("accepts valid generic webhook with HMAC", async () => {
    const secret = "test-generic-secret";
    const payload = JSON.stringify({ eventType: "test.event", data: { key: "value" } });

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, payloadData);
    const sigHex = "sha256=" + Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    mockReq = new Request("https://example.com/webhooks/generic", {
      method: "POST",
      headers: {
        "x-webhook-signature": sigHex,
        "content-type": "application/json",
      },
      body: payload,
    });

    const response = await handleWebhook(mockReq, mockEnv, "generic");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; eventId: string };
    expect(body.success).toBe(true);
    expect(body.eventId).toBeDefined();
  });

  it("extracts event type from Clerk payload", async () => {
    const { extractEventType } = await import("../../src/webhooks/handler");
    const payload = JSON.stringify({ type: "user.created", data: {} });
    expect(extractEventType(payload, "clerk")).toBe("user.created");
  });

  it("extracts event type from GCP payload", async () => {
    const { extractEventType } = await import("../../src/webhooks/handler");
    const payload = JSON.stringify({ message: { attributes: { eventType: "billing.updated" } } });
    expect(extractEventType(payload, "gcp")).toBe("billing.updated");
  });

  it("extracts event type from generic payload", async () => {
    const { extractEventType } = await import("../../src/webhooks/handler");
    const payload = JSON.stringify({ eventType: "custom.event", data: {} });
    expect(extractEventType(payload, "generic")).toBe("custom.event");
  });

  it("falls back to unknown for invalid JSON", async () => {
    const { extractEventType } = await import("../../src/webhooks/handler");
    expect(extractEventType("invalid json", "clerk")).toBe("unknown");
  });
});