export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export function generateTraceId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateSpanId(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createTraceContext(parent?: TraceContext): TraceContext {
  return {
    traceId: parent?.traceId || generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: parent?.spanId,
  };
}

export function extractTraceContext(headers: Headers): TraceContext | null {
  const traceId = headers.get("x-trace-id");
  const spanId = headers.get("x-span-id");
  const parentSpanId = headers.get("x-parent-span-id");

  if (!traceId || !spanId) return null;

  return { traceId, spanId, parentSpanId: parentSpanId || undefined };
}

export function injectTraceContext(context: TraceContext, headers: Headers) {
  headers.set("x-trace-id", context.traceId);
  headers.set("x-span-id", context.spanId);
  if (context.parentSpanId) {
    headers.set("x-parent-span-id", context.parentSpanId);
  }
}

export function createTraceHeaders(context: TraceContext): Record<string, string> {
  return {
    "x-trace-id": context.traceId,
    "x-span-id": context.spanId,
    ...(context.parentSpanId ? { "x-parent-span-id": context.parentSpanId } : {}),
  };
}

export interface Span {
  context: TraceContext;
  name: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, string>;
  logs: Array<{ timestamp: number; message: string; fields?: Record<string, unknown> }>;
  finish(): void;
}

export class NoopSpan implements Span {
  context: TraceContext;
  name: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, string> = {};
  logs: Array<{ timestamp: number; message: string; fields?: Record<string, unknown> }> = [];

  constructor(context: TraceContext, name: string) {
    this.context = context;
    this.name = name;
    this.startTime = Date.now();
  }

  finish() {
    this.endTime = Date.now();
  }
}

export function startSpan(context: TraceContext, name: string): Span {
  return new NoopSpan(context, name);
}