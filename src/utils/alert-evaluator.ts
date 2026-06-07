import type { MetricData, ThresholdConfig, Alert, AlertSeverity } from "../config/types";

export function evaluateAlerts(
  metrics: MetricData[],
  thresholds: ThresholdConfig[],
  sourceId: string
): Alert[] {
  const alerts: Alert[] = [];

  for (const threshold of thresholds) {
    const matchingMetrics = metrics.filter((m) => m.name === threshold.metric);

    for (const metric of matchingMetrics) {
      const triggered = checkThreshold(metric.value, threshold.operator, threshold.value);

      if (triggered) {
        alerts.push({
          id: `${sourceId}-${threshold.metric}-${threshold.severity}-${Date.now()}`,
          sourceId,
          severity: threshold.severity,
          title: `${threshold.metric} ${threshold.operator} ${threshold.value}`,
          description: `Metric ${threshold.metric} (${metric.value} ${metric.unit}) ${getOperatorText(threshold.operator)} threshold ${threshold.value}`,
          timestamp: Date.now(),
          metrics: [metric],
        });
      }
    }
  }

  return alerts;
}

function checkThreshold(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
    default:
      return false;
  }
}

function getOperatorText(operator: string): string {
  switch (operator) {
    case "gt":
      return "exceeds";
    case "gte":
      return "meets or exceeds";
    case "lt":
      return "is below";
    case "lte":
      return "is at or below";
    case "eq":
      return "equals";
    default:
      return operator;
  }
}