export interface MetricCounter {
  increment(labels?: Record<string, string>): void;
  getValue(): number;
}

export interface MetricHistogram {
  observe(value: number, labels?: Record<string, string>): void;
  getStats(): { count: number; sum: number; min: number; max: number; avg: number };
}

class InMemoryCounter implements MetricCounter {
  private value = 0;
  private labels: Record<string, number> = {};

  increment(labels?: Record<string, string>) {
    this.value++;
    if (labels) {
      const key = JSON.stringify(labels);
      this.labels[key] = (this.labels[key] || 0) + 1;
    }
  }

  getValue(): number {
    return this.value;
  }

  getLabeledValue(labels: Record<string, string>): number {
    const key = JSON.stringify(labels);
    return this.labels[key] || 0;
  }
}

class InMemoryHistogram implements MetricHistogram {
  private values: number[] = [];
  private labels: Record<string, number[]> = {};

  observe(value: number, labels?: Record<string, string>) {
    this.values.push(value);
    if (labels) {
      const key = JSON.stringify(labels);
      if (!this.labels[key]) this.labels[key] = [];
      this.labels[key].push(value);
    }
  }

  getStats() {
    if (this.values.length === 0) {
      return { count: 0, sum: 0, min: 0, max: 0, avg: 0 };
    }
    const sum = this.values.reduce((a, b) => a + b, 0);
    return {
      count: this.values.length,
      sum,
      min: Math.min(...this.values),
      max: Math.max(...this.values),
      avg: sum / this.values.length,
    };
  }
}

class MetricsRegistry {
  private counters = new Map<string, InMemoryCounter>();
  private histograms = new Map<string, InMemoryHistogram>();

  counter(name: string): MetricCounter {
    if (!this.counters.has(name)) {
      this.counters.set(name, new InMemoryCounter());
    }
    return this.counters.get(name)!;
  }

  histogram(name: string): MetricHistogram {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new InMemoryHistogram());
    }
    return this.histograms.get(name)!;
  }

  getAllCounters(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, counter] of this.counters) {
      result[name] = counter.getValue();
    }
    return result;
  }

  getAllHistograms(): Record<string, ReturnType<MetricHistogram["getStats"]>> {
    const result: Record<string, ReturnType<MetricHistogram["getStats"]>> = {};
    for (const [name, histogram] of this.histograms) {
      result[name] = histogram.getStats();
    }
    return result;
  }

  reset() {
    this.counters.clear();
    this.histograms.clear();
  }
}

export const metrics = new MetricsRegistry();

export const workflowMetrics = {
  invocations: () => metrics.counter("workflow_invocations_total"),
  duration: () => metrics.histogram("workflow_duration_seconds"),
  errors: () => metrics.counter("workflow_errors_total"),
  stepDuration: () => metrics.histogram("workflow_step_duration_seconds"),
  stepRetries: () => metrics.counter("workflow_step_retries_total"),
};