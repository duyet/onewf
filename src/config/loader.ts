import type { AppConfig, SourceConfig, ChannelConfig, AlertRule } from "./types";
import { validateAppConfig, validateSourceConfig, validateChannelConfig, validateAlertRule } from "./schema";
import type { Env } from "../index";

const CONFIG_CACHE_KEY = "onalert:config:v1";
const CACHE_TTL = 300000; // 5 minutes

let cachedConfig: AppConfig | null = null;
let cacheExpiry = 0;

export async function loadConfig(env: Env): Promise<AppConfig> {
  const now = Date.now();

  if (cachedConfig && now < cacheExpiry) {
    return cachedConfig;
  }

  let tsConfig: AppConfig = { sources: [], channels: [], rules: [] };

  try {
    const configModule = await import("../config/app.config.ts");
    if (configModule.default) {
      tsConfig = configModule.default;
    }
  } catch {
  }

  const kvConfig = await loadKVConfig(env);

  const mergedConfig = mergeConfigs(tsConfig, kvConfig);

  const validated = validateAppConfig(mergedConfig);

  cachedConfig = validated;
  cacheExpiry = now + CACHE_TTL;

  return validated;
}

async function loadKVConfig(env: Env): Promise<Partial<AppConfig>> {
  try {
    const sourcesJson = await env.CONFIG_KV.get("sources");
    const channelsJson = await env.CONFIG_KV.get("channels");
    const rulesJson = await env.CONFIG_KV.get("rules");

    const result: Partial<AppConfig> = {};

    if (sourcesJson) {
      try {
        result.sources = JSON.parse(sourcesJson);
      } catch {
      }
    }

    if (channelsJson) {
      try {
        result.channels = JSON.parse(channelsJson);
      } catch {
      }
    }

    if (rulesJson) {
      try {
        result.rules = JSON.parse(rulesJson);
      } catch {
      }
    }

    return result;
  } catch {
    return {};
  }
}

function mergeConfigs(base: AppConfig, override: Partial<AppConfig>): AppConfig {
  return {
    sources: override.sources?.length ? override.sources : base.sources,
    channels: override.channels?.length ? override.channels : base.channels,
    rules: override.rules?.length ? override.rules : base.rules,
  };
}

export function clearConfigCache() {
  cachedConfig = null;
  cacheExpiry = 0;
}

export async function saveConfigToKV(env: Env, config: Partial<AppConfig>): Promise<void> {
  const promises: Promise<void>[] = [];

  if (config.sources) {
    promises.push(env.CONFIG_KV.put("sources", JSON.stringify(config.sources)));
  }
  if (config.channels) {
    promises.push(env.CONFIG_KV.put("channels", JSON.stringify(config.channels)));
  }
  if (config.rules) {
    promises.push(env.CONFIG_KV.put("rules", JSON.stringify(config.rules)));
  }

  await Promise.all(promises);
  clearConfigCache();
}