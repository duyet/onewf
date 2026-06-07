import type { MetricsAdapter, SourceType } from "../adapters/types";
import type { Env } from "../index";

export class AdapterRegistry {
  private adapters = new Map<string, MetricsAdapter>();

  register(adapter: MetricsAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): MetricsAdapter | undefined {
    return this.adapters.get(name);
  }

  getAll(): MetricsAdapter[] {
    return Array.from(this.adapters.values()).sort((a, b) => b.priority - a.priority);
  }

  getEnabled(configs: { name: string; enabled: boolean }[]): MetricsAdapter[] {
    const enabledNames = new Set(configs.filter((c) => c.enabled).map((c) => c.name));
    return this.getAll().filter((adapter) => enabledNames.has(adapter.name));
  }

  getByType(type: SourceType): MetricsAdapter[] {
    return this.getAll().filter((adapter) => adapter.type === type);
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  size(): number {
    return this.adapters.size;
  }

  clear(): void {
    this.adapters.clear();
  }
}

export const adapterRegistry = new AdapterRegistry();