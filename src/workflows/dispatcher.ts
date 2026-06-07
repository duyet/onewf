import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { Env } from "../index";
import { loadConfig } from "../config/loader";
import { createAdapter } from "../registry/adapter-factory";

export interface DispatcherParams {
  scheduledTime: number;
}

export class CronDispatcherWorkflow extends WorkflowEntrypoint<Env, DispatcherParams> {
  override async run(event: WorkflowEvent<DispatcherParams>, step: WorkflowStep): Promise<void> {
    const { scheduledTime } = event.payload;

    const config = await loadConfig(this.env);

    for (const sourceConfig of config.sources) {
      if (!sourceConfig.enabled) continue;

      try {
        const adapter = createAdapter(sourceConfig, this.env);
        const instanceId = `${sourceConfig.id}-${scheduledTime}`;

        await step.do(`trigger-${sourceConfig.id}`, async () => {
          switch (sourceConfig.type) {
            case "cloudflare-billing":
              await this.env.CF_BILLING.create({ id: instanceId, params: { sourceId: sourceConfig.id, scheduledTime } });
              break;
            case "anyrouter":
              await this.env.ANYROUTER.create({ id: instanceId, params: { sourceId: sourceConfig.id, scheduledTime } });
              break;
            case "gcp-billing":
              await this.env.GCP_BILLING.create({ id: instanceId, params: { sourceId: sourceConfig.id, scheduledTime } });
              break;
          }
        });
      } catch (error) {
        console.error(`Failed to trigger workflow for ${sourceConfig.id}:`, error);
      }
    }
  }
}