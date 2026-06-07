import { CronDispatcherWorkflow } from "./workflows/dispatcher";
import { CfBillingWorkflow } from "./workflows/cf-billing";
import { AnyRouterWorkflow } from "./workflows/anyrouter";
import { GcpBillingWorkflow } from "./workflows/gcp-billing";
import { AlertDispatchWorkflow } from "./workflows/alert-dispatch";
import { handleWebhook } from "./webhooks/handler";

export interface Env {
  DB: D1Database;
  CONFIG_KV: KVNamespace;
  IDEMPOTENCY_KV: KVNamespace;
  R2: R2Bucket;
  CRON_DISPATCHER: Workflow;
  CF_BILLING: Workflow;
  ANYROUTER: Workflow;
  GCP_BILLING: Workflow;
  ALERT_DISPATCH: Workflow;
  CLERK_WEBHOOK_SECRET: string;
  GCP_WEBHOOK_SECRET: string;
  GENERIC_WEBHOOK_SECRET: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/") {
      return Response.json({ status: "ok", service: "onewf" });
    }

    if (req.method === "GET" && url.pathname.startsWith("/workflows/")) {
      const workflowId = url.pathname.split("/workflows/")[1];
      if (!workflowId) {
        return Response.json({ error: "Workflow ID required" }, { status: 400 });
      }
      try {
        const instance = await env.CRON_DISPATCHER.get(workflowId);
        if (!instance) {
          return Response.json({ error: "Workflow not found" }, { status: 404 });
        }
        const status = await instance.status();
        return Response.json(status);
      } catch {
        return Response.json({ error: "Workflow not found" }, { status: 404 });
      }
    }

    if (req.method === "POST" && url.pathname.startsWith("/webhooks/")) {
      const source = url.pathname.split("/webhooks/")[1];
      if (!source) {
        return Response.json({ error: "Webhook source required" }, { status: 400 });
      }
      return handleWebhook(req, env, source);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const instanceId = `cron-dispatcher-${controller.scheduledTime}`;
    await env.CRON_DISPATCHER.create({ id: instanceId, params: { scheduledTime: controller.scheduledTime } });
  },
} satisfies ExportedHandler<Env>;

export { CronDispatcherWorkflow, CfBillingWorkflow, AnyRouterWorkflow, GcpBillingWorkflow, AlertDispatchWorkflow };