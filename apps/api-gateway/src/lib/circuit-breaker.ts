// ── Circuit Breaker ───────────────────────────────────────────────────────────
//
// State machine per upstream service:
//
//   CLOSED ──(failures ≥ threshold)──► OPEN ──(cooldown elapsed)──► HALF_OPEN
//     ▲                                                                  │
//     └────────────────(probe succeeds)─────────────────────────────────┘
//                       probe fails → back to OPEN
//
// All state is in-memory. For multi-instance deployments, swap the Maps for
// an Upstash Redis client using the same allow/success/failure interface.

type State = "CLOSED" | "OPEN" | "HALF_OPEN"

interface Config {
  /** Number of failures within `windowMs` that trips the breaker. */
  failureThreshold: number
  /** Rolling window for counting failures (ms). */
  windowMs: number
  /** How long the breaker stays OPEN before allowing one probe (ms). */
  cooldownMs: number
}

// ── Per-service config overrides ──────────────────────────────────────────────
// Payment uses a looser threshold because Midtrans (external) can be transiently
// slow. Auth failures are treated more seriously — they affect every request.
const SERVICE_CONFIGS: Record<string, Partial<Config>> = {
  AUTH:    { failureThreshold: 3, cooldownMs: 20_000 },
  PAYMENT: { failureThreshold: 8, windowMs: 120_000, cooldownMs: 60_000 },
}

const DEFAULT_CONFIG: Config = {
  failureThreshold: 5,
  windowMs:         60_000,   // 1 min rolling window
  cooldownMs:       30_000,   // 30 s cooldown
}

// ── CircuitBreaker class ──────────────────────────────────────────────────────
export class CircuitBreaker {
  private state:        State    = "CLOSED"
  private failures:     number[] = []   // timestamps of failures in current window
  private lastOpenedAt: number   = 0
  private probeInFlight: boolean = false
  readonly config:      Config

  constructor(public readonly name: string, overrides: Partial<Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...overrides }
  }

  /**
   * Returns true if this request is allowed to reach the upstream.
   * Call this BEFORE making the upstream request.
   */
  allow(): boolean {
    const now = Date.now()

    switch (this.state) {
      case "CLOSED":
        return true

      case "OPEN":
        if (now - this.lastOpenedAt < this.config.cooldownMs) return false
        // Cooldown elapsed — move to HALF_OPEN and admit one probe
        this.state        = "HALF_OPEN"
        this.probeInFlight = true
        console.info(JSON.stringify({ event: "circuit_half_open", service: this.name }))
        return true

      case "HALF_OPEN":
        // Only one probe at a time — queue the rest
        return false
    }
  }

  /**
   * Record a successful response. Call this after a 2xx/3xx/4xx response
   * (4xx is the client's fault, not the service's).
   */
  success(): void {
    if (this.state === "HALF_OPEN" || this.state === "OPEN") {
      this.state         = "CLOSED"
      this.failures      = []
      this.probeInFlight = false
      console.info(JSON.stringify({ event: "circuit_closed", service: this.name }))
    }
    // In CLOSED state, a success is a no-op (no need to reset the window)
  }

  /**
   * Record a failure. Call this on 5xx responses, timeouts, or connection errors.
   */
  failure(): void {
    const now = Date.now()

    // Slide the window — discard stale timestamps
    this.failures = this.failures.filter(ts => now - ts < this.config.windowMs)
    this.failures.push(now)

    if (this.state === "HALF_OPEN") {
      // Probe failed — immediately reopen
      this.trip(now)
      return
    }

    if (this.state === "CLOSED" && this.failures.length >= this.config.failureThreshold) {
      this.trip(now)
    }
  }

  /** Current snapshot — used by the health endpoint. */
  status(): { name: string; state: State; failures: number; config: Config } {
    return {
      name:     this.name,
      state:    this.state,
      failures: this.failures.length,
      config:   this.config,
    }
  }

  private trip(now: number): void {
    this.state         = "OPEN"
    this.lastOpenedAt  = now
    this.probeInFlight = false
    console.error(JSON.stringify({
      event:    "circuit_open",
      service:  this.name,
      failures: this.failures.length,
      cooldownMs: this.config.cooldownMs,
    }))
  }
}

// ── Singleton registry ────────────────────────────────────────────────────────
const registry = new Map<string, CircuitBreaker>()

export function getBreaker(service: string): CircuitBreaker {
  let breaker = registry.get(service)
  if (!breaker) {
    breaker = new CircuitBreaker(service, SERVICE_CONFIGS[service] ?? {})
    registry.set(service, breaker)
  }
  return breaker
}

export function getAllBreakerStatus() {
  return Array.from(registry.values()).map(b => b.status())
}
