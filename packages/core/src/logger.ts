/**
 * Structured JSON logger with secret redaction. One line per event, suitable for any log drain.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACT = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|hash|ssn|card/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  return out;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export function createLogger(
  base: Record<string, unknown> = {},
  opts: { level?: LogLevel; sink?: (line: string) => void; now?: () => Date } = {},
): Logger {
  const min = ORDER[opts.level ?? ((process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info')] ?? ORDER.info;
  const sink = opts.sink ?? ((l: string) => process.stdout.write(l + '\n'));
  const now = opts.now ?? (() => new Date());
  const emit = (level: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[level] < min) return;
    sink(JSON.stringify({ ts: now().toISOString(), level, msg, ...(redact({ ...base, ...fields }) as object) }));
  };
  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    child: (f) => createLogger({ ...base, ...f }, opts),
  };
}
