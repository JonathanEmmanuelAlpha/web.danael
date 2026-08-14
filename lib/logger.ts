/**
 * Structured JSON logger (§23.2).
 * Never logs secrets. Levels: debug | info | warn | error.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLevel(): LogLevel {
  const env = process.env.NODE_ENV;
  return env === "production" ? "info" : "debug";
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel()]) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { ...meta } : {}),
  };

  // Strip sensitive keys defensively.
  const safe = JSON.parse(
    JSON.stringify(entry, (key, value) => {
      if (
        /^(secret|password|token|authorization|cookie|api[_-]?key)$/i.test(key)
      ) {
        return "[REDACTED]";
      }
      return value;
    }),
  );

  if (level === "error") console.error(JSON.stringify(safe));
  else if (level === "warn") console.warn(JSON.stringify(safe));
  else console.log(JSON.stringify(safe));
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
