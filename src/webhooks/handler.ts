import type { Env } from "../index";
import { createDbClient } from "../db/client";
import { createWebhookEvent as createWebhookEventQuery } from "../db/queries";
import type { NewWebhookEvent } from "../db/schema";

export interface WebhookSourceConfig {
  source: string;
  secret?: string;
  headerName?: string;
  verifySignature?: (payload: string, signature: string, secret: string) => Promise<boolean>;
}

const DEFAULT_SOURCES: Record<string, WebhookSourceConfig> = {
  clerk: {
    source: "clerk",
    secret: "",
    headerName: "svix-signature",
    verifySignature: async (payload: string, signature: string, secret: string) => {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const payloadData = encoder.encode(payload);
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const sigBytes = new Uint8Array(
        signature.split(",").map((s) => {
          const parts = s.split("=");
          const v = parts[1] ?? "0";
          return parseInt(v, 16);
        })
      );
      return crypto.subtle.verify("HMAC", key, sigBytes, payloadData);
    },
  },
  gcp: {
    source: "gcp",
    secret: "",
    headerName: "authorization",
    verifySignature: async (payload: string, signature: string, secret: string) => {
      return signature.startsWith("Bearer ");
    },
  },
  generic: {
    source: "generic",
    secret: "",
    headerName: "x-webhook-signature",
    verifySignature: async (payload: string, signature: string, secret: string) => {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const payloadData = encoder.encode(payload);
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const sigBytes = new Uint8Array(
        signature.replace("sha256=", "").split("").map((c) => c.charCodeAt(0))
      );
      return crypto.subtle.verify("HMAC", key, sigBytes, payloadData);
    },
  },
};

export async function handleWebhook(req: Request, env: Env, source: string): Promise<Response> {
  const sourceConfig = DEFAULT_SOURCES[source];
  if (!sourceConfig) {
    return Response.json({ error: "Unknown webhook source" }, { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  const signatureHeader = sourceConfig.headerName?.toLowerCase();
  const signature = signatureHeader ? (headers[signatureHeader] ?? "") : "";

  const secret = getSecretForSource(env, source);
  if (secret && sourceConfig.verifySignature) {
    const valid = await sourceConfig.verifySignature(payload, signature || "", secret);
    if (!valid) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const db = createDbClient(env.DB);
  const event: NewWebhookEvent = {
    id: crypto.randomUUID(),
    source: sourceConfig.source,
    eventType: extractEventType(payload, source),
    payload,
    headers: JSON.stringify(headers),
    signature: signature || null,
    verified: !!secret,
    processed: false,
    error: null,
    receivedAt: Date.now(),
    processedAt: null,
  };

  await createWebhookEventQuery(db, event);

  await processWebhookEvent(db, env, event, payload);

  return Response.json({ success: true, eventId: event.id });
}

function getSecretForSource(env: Env, source: string): string {
  switch (source) {
    case "clerk":
      return env.CLERK_WEBHOOK_SECRET || "";
    case "gcp":
      return env.GCP_WEBHOOK_SECRET || "";
    case "generic":
      return env.GENERIC_WEBHOOK_SECRET || "";
    default:
      return "";
  }
}

function extractEventType(payload: string, source: string): string {
  try {
    const data = JSON.parse(payload);
    switch (source) {
      case "clerk":
        return data.type || "unknown";
      case "gcp":
        return data.message?.attributes?.eventType || "unknown";
      default:
        return data.eventType || data.type || "unknown";
    }
  } catch {
    return "unknown";
  }
}

async function processWebhookEvent(db: ReturnType<typeof createDbClient>, env: Env, event: any, payload: string) {
  try {
    const data = JSON.parse(payload);

    await import("../db/queries").then(({ markWebhookEventProcessed }) =>
      markWebhookEventProcessed(db, event.id)
    );
  } catch (error) {
    await import("../db/queries").then(({ markWebhookEventProcessed }) =>
      markWebhookEventProcessed(db, event.id, String(error))
    );
  }
}