import type { MetricsAdapter } from "../adapters/types";
import type { SourceConfig } from "../config/types";
import { CloudflareBillingAdapter, type CloudflareBillingConfig } from "../adapters/cloudflare-billing";
import { AnyRouterAdapter, type AnyRouterConfig } from "../adapters/anyrouter";
import { GcpBillingAdapter, type GcpBillingConfig } from "../adapters/gcp-billing";
import type { Env } from "../index";

export function createAdapter(config: SourceConfig, env: Env): MetricsAdapter {
  switch (config.type) {
    case "cloudflare-billing":
      return new CloudflareBillingAdapter(config.config as CloudflareBillingConfig, env);
    case "anyrouter":
      return new AnyRouterAdapter(config.config as AnyRouterConfig, env);
    case "gcp-billing":
      return new GcpBillingAdapter(config.config as GcpBillingConfig, env);
    default:
      throw new Error(`Unknown source type: ${config.type}`);
  }
}