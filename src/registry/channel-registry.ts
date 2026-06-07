import type { AlertChannel, ChannelType } from "../channels/types";
import type { Env } from "../index";

export class ChannelRegistry {
  private channels = new Map<string, AlertChannel>();

  register(channel: AlertChannel): void {
    this.channels.set(channel.name, channel);
  }

  get(name: string): AlertChannel | undefined {
    return this.channels.get(name);
  }

  getAll(): AlertChannel[] {
    return Array.from(this.channels.values());
  }

  getEnabled(configs: { name: string; enabled: boolean }[]): AlertChannel[] {
    const enabledNames = new Set(configs.filter((c) => c.enabled).map((c) => c.name));
    return this.getAll().filter((channel) => enabledNames.has(channel.name));
  }

  getByType(type: ChannelType): AlertChannel[] {
    return this.getAll().filter((channel) => channel.type === type);
  }

  has(name: string): boolean {
    return this.channels.has(name);
  }

  size(): number {
    return this.channels.size;
  }

  clear(): void {
    this.channels.clear();
  }
}

export const channelRegistry = new ChannelRegistry();