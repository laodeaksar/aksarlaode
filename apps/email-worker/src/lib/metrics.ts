// FIX EML-09: Lightweight Prometheus text-format metrics for the email worker.
//
// No external dependency — uses only in-memory counters + a simple text
// serialiser.  The metrics are exposed via GET /metrics (see index.ts) on the
// same port as the health endpoint so a single scrape config covers both.
//
// Counters:
//   email_sent_total{job_type}     — successfully delivered emails
//   email_failed_total{job_type}   — transient failures (will be retried)
//   email_retry_total{job_type}    — permanent failures after all retries
//
// Gauge (informational):
//   email_worker_up                — always 1 while the process is alive

type LabelSet = Record<string, string>

interface CounterEntry {
  labels: LabelSet
  value: number
}

const counters: Record<string, CounterEntry[]> = {}

function getOrCreate(name: string, labels: LabelSet): CounterEntry {
  if (!counters[name]) counters[name] = []
  const key = JSON.stringify(labels)
  let entry = counters[name].find((e) => JSON.stringify(e.labels) === key)
  if (!entry) {
    entry = { labels, value: 0 }
    counters[name].push(entry)
  }
  return entry
}

export function incrementCounter(name: string, labels: LabelSet = {}): void {
  getOrCreate(name, labels).value++
}

// ── Prometheus text format serialiser ─────────────────────────────────────────
function labelsToString(labels: LabelSet): string {
  const pairs = Object.entries(labels).map(
    ([k, v]) =>
      `${k}="${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
  )
  return pairs.length > 0 ? `{${pairs.join(",")}}` : ""
}

export function renderMetrics(): string {
  const lines: string[] = []

  // Static gauge — worker is alive
  lines.push("# HELP email_worker_up 1 if the email worker process is running")
  lines.push("# TYPE email_worker_up gauge")
  lines.push("email_worker_up 1")

  const HELP: Record<string, string> = {
    email_sent_total: "Total number of emails successfully sent",
    email_failed_total:
      "Total number of transient email send failures (will be retried)",
    email_retry_total:
      "Total number of emails permanently failed after all retry attempts",
  }
  const TYPE: Record<string, string> = {
    email_sent_total: "counter",
    email_failed_total: "counter",
    email_retry_total: "counter",
  }

  for (const [name, entries] of Object.entries(counters)) {
    if (HELP[name]) {
      lines.push(`# HELP ${name} ${HELP[name]}`)
      lines.push(`# TYPE ${name} ${TYPE[name] ?? "counter"}`)
    }
    for (const entry of entries) {
      lines.push(`${name}${labelsToString(entry.labels)} ${entry.value}`)
    }
  }

  return lines.join("\n") + "\n"
}
