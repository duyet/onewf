import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { Env } from "../index";
import { loadConfig } from "../config/loader";
import { createAdapter } from "../registry/adapter-factory";
import { evaluateAlerts } from "../utils/alert-evaluator";
import { createTraceContext } from "../observability";

export interface GcpBillingParams {
  sourceId: string;
  scheduledTime: number;
}

export class GcpBillingWorkflow extends WorkflowEntrypoint<Env, GcpBillingParams> {
  override async run(event: WorkflowEvent<GcpBillingParams>, step: WorkflowStep): Promise<void> {
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
        await this.env.ALERT_DISPATCH.create({
          id: alert.id,
          params: alert,
        });
      });
    }
  }
}