// ── Structured server-side logger ─────────────────────────────────────────
//
// Emits newline-delimited JSON to stdout (INFO) / stderr (ERROR).
// JSON format is compatible with Datadog, Logtail, and most log aggregators
// that parse structured log streams.
//
// In development `NODE_ENV !== "production"` the output is also pretty-printed
// via the `prettyDev` formatter so it is readable in the Vinxi console.
//
// Fields included in every entry:
//   timestamp  ISO-8601 string
//   level      "INFO" | "WARN" | "ERROR"
//   service    "admin-ssr" (constant — identifies this app in multi-service logs)
//   ...fields  caller-supplied key/value pairs

export type LogLevel = "INFO" | "WARN" | "ERROR"

export type LogEntry = {
  timestamp:  string
  level:      LogLevel
  service:    "admin-ssr"
  [key: string]: unknown
}

const IS_DEV = process.env["NODE_ENV"] !== "production"

/** Emit a single structured log line. */
export function log(level: LogLevel, fields: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service:   "admin-ssr",
    ...fields,
  }

  const line = IS_DEV
    ? prettyDev(entry)
    : JSON.stringify(entry)

  if (level === "ERROR" || level === "WARN") {
    process.stderr.write(line + "\n")
  } else {
    process.stdout.write(line + "\n")
  }
}

// Convenience wrappers
export const logInfo  = (fields: Record<string, unknown>) => log("INFO",  fields)
export const logWarn  = (fields: Record<string, unknown>) => log("WARN",  fields)
export const logError = (fields: Record<string, unknown>) => log("ERROR", fields)

// ── Dev pretty-printer ─────────────────────────────────────────────────────
// Renders a colourised, human-readable line in development so the Vinxi
// console is easy to scan. Falls back to JSON in production.
//
// Example output:
//   [INFO ] 12:34:56.789  listProductsFn  (src/server/products.ts)  42ms
//   [ERROR] 12:34:56.789  getProductFn    (src/server/products.ts)  5ms  NotFoundError: Product 999 not found

const COLOURS: Record<LogLevel, string> = {
  INFO:  "\x1b[32m",   // green
  WARN:  "\x1b[33m",   // yellow
  ERROR: "\x1b[31m",   // red
}
const RESET = "\x1b[0m"
const DIM   = "\x1b[2m"

function prettyDev(entry: LogEntry): string {
  const { level, timestamp, service: _svc, fn, file, durationMs, error, ...rest } = entry

  const colour   = COLOURS[level] ?? ""
  const time     = timestamp.slice(11, 23)           // HH:MM:SS.mmm
  const tag      = `${colour}[${level.padEnd(5)}]${RESET}`
  const fnStr    = fn         ? ` ${String(fn).padEnd(28)}` : ""
  const fileStr  = file       ? ` ${DIM}(${file})${RESET}`  : ""
  const durStr   = durationMs !== undefined ? ` ${String(durationMs)}ms` : ""
  const errStr   = error      ? `  ${colour}${formatError(error)}${RESET}` : ""

  const extraKeys = Object.keys(rest)
  const extraStr  = extraKeys.length
    ? "  " + extraKeys.map((k) => `${k}=${JSON.stringify(rest[k])}`).join(" ")
    : ""

  return `${tag} ${time}${fnStr}${fileStr}${durStr}${errStr}${extraStr}`
}

function formatError(err: unknown): string {
  if (typeof err !== "object" || err === null) return String(err)
  const e = err as Record<string, unknown>
  const tag = typeof e["_tag"] === "string" ? e["_tag"] : "Error"
  const msg = typeof e["message"] === "string" ? e["message"] : JSON.stringify(err)
  return `${tag}: ${msg}`
}
