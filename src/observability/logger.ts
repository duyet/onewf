export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  traceId?: string;
  spanId?: string;
}

class Logger {
  protected minLevel: LogLevel = "info";
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  setLevel(level: LogLevel) {
    this.minLevel = level;
  }

  getLevel(): LogLevel {
    return this.minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.minLevel];
  }

  private formatEntry(level: LogLevel, message: string, context: LogContext = {}): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
  }

  private write(entry: LogEntry) {
    console.log(JSON.stringify(entry));
  }

  debug(message: string, context: LogContext = {}) {
    if (this.shouldLog("debug")) {
      this.write(this.formatEntry("debug", message, context));
    }
  }

  info(message: string, context: LogContext = {}) {
    if (this.shouldLog("info")) {
      this.write(this.formatEntry("info", message, context));
    }
  }

  warn(message: string, context: LogContext = {}) {
    if (this.shouldLog("warn")) {
      this.write(this.formatEntry("warn", message, context));
    }
  }

  error(message: string, context: LogContext = {}) {
    if (this.shouldLog("error")) {
      this.write(this.formatEntry("error", message, context));
    }
  }

  withTrace(traceId: string, spanId: string) {
    return {
      debug: (message: string, context: LogContext = {}) =>
        this.debug(message, { ...context, traceId, spanId }),
      info: (message: string, context: LogContext = {}) =>
        this.info(message, { ...context, traceId, spanId }),
      warn: (message: string, context: LogContext = {}) =>
        this.warn(message, { ...context, traceId, spanId }),
      error: (message: string, context: LogContext = {}) =>
        this.error(message, { ...context, traceId, spanId }),
    };
  }
}

export const logger = new Logger();

export function createChildLogger(baseContext: LogContext): Logger {
  const child = new Logger();
  child.setLevel(logger.getLevel());
  return child;
}