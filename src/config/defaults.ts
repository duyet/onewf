import type { AppConfig, SourceConfig, ChannelConfig, AlertRule } from "./types";

export const defaultAppConfig: AppConfig = {
  sources: [],
  channels: [],
  rules: [],
};

export function createDefaultSourceConfig(type: SourceConfig["type"], id: string): SourceConfig {
  return {
    id,
    type,
    enabled: true,
    priority: 0,
    config: {},
    thresholds: [],
  };
}

export function createDefaultChannelConfig(type: ChannelConfig["type"], id: string): ChannelConfig {
  return {
    id,
    type,
    enabled: true,
    config: {},
  };
}

export function createDefaultAlertRule(sourceId: string, channelIds: string[]): AlertRule {
  return {
    sourceId,
    channelIds,
  };
}