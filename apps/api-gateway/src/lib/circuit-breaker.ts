// ── Circuit Breaker with Redis-backed state persistence ───────────────────────
//
// State machine per upstream service:
//
//   CLOSED ──(failures ≥ threshold)──► OPEN ──(cooldown elapsed)──► HALF_OPEN
//     ▲                                                                  │
//     └────────────────(probe succeeds)─────────────────────────────────┘
//                       probe fails → back to OPEN
//
// FIX GW-02: State is now persisted to Redis on every transition so that a
// gateway restart does not silently reset an OPEN breaker to CLOSED and send
// traffic to a still-failing downstream service.
//
// Persistence contract:
//   • On every CLOSED→OPEN or HALF_OPEN→OPEN or OPEN→CLOSED transition,
//     the breaker snapshots its state to Redis (fire-and-forget).
//   • On startup, `restoreFromRedis()` is called for each breaker so that
//     a recently-tripped circuit survives a rolling restart.
//   • If Redis is unavailable: fail-open (in-memory only). A Redis outage
//     must not block gateway startup or request processing.
//   • TTL: 24 hours — stale states are discarded automatically.

import { getRedis } from "@/lib/redis"

type State = "CLOSED" | "OPEN" | "HALF_OPEN"

interface Config {
  /** Number of failures within `windowMs` that trips the breaker. */
  failureThreshold: number
  /** Rolling window for counting failures (ms). */
  windowMs: number
  /** How long the breaker stays OPEN before allowing one probe (ms). */
  cooldownMs: number
}

interface PersistedState {
  state:        State
  lastOpenedAt: number
  failures:     number[]   // timestamps
  savedAt:      number
}

// ── Per-service config overrides ──────────────────────────────────────────────
const SERVICE_CONFIGS: Record<string, Partial<Config>> = {
  AUTH:    { failureThreshold: 3, cooldownMs: 20_000 },
  PAYMENT: { failureThreshold: 8, windowMs: 120_000, cooldownMs: 60_000 },
}

const DEFAULT_CONFIG: Config = {
  failureThreshold: 5,
  windowMs:         60_000,
  cooldownMs:       30_000,
}

const REDIS_TTL_SEC = 86_400   // 24 hours

function redisKey(service: string) {
  return `breaker:state:${service}`
}

// ── CircuitBreaker class ──────────────────────────────────────────────────────
export class CircuitBreaker {
  private state:         State    = "CLOSED"
  private failures:      number[] = []
  private lastOpenedAt:  number   = 0
  private probeInFlight: boolean  = false
  readonly config:       Config

  constructor(public readonly name: string, overrides: Partial<Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...overrides }
  }

  // ── Restore persisted state from Redis (called once at startup) ──────────
  async restoreFromRedis(): Promise<void> {
    try {
      const raw = await getRedis().get(redisKey(this.name))
      if (!raw) return

      const saved = JSON.parse(raw) as PersistedState

      // Discard stale snapshots older than 2× the cooldown window.
      // If the gateway has been down longer than the cooldown, the breaker
      // should re-evaluate on live traffic rather than staying OPEN forever.
      const age = Date.now() - saved.savedAt
      if (age > this.config.cooldownMs * 2) return

      this.state        = saved.state
      this.lastOpenedAt = saved.lastOpenedAt
      this.failures     = saved.failures.filter(ts =>
        Date.now() - ts < this.config.windowMs
      )

      if (this.state !== "CLOSED") {
        console.info(JSON.stringify({
          event:        "circuit_state_restored",
          service:      this.name,
          state:        this.state,
          ageSec:       Math.round(age / 1000),
        }))
      }
    } catch {
      // Fail-open — Redis unavailable or corrupt snapshot; start from CLOSED.
    }
  }

  // ── Persist current state to Redis (fire-and-forget) ─────────────────────
  private persist(): void {
    const payload: PersistedState = {
      state:        this.state,
      lastOpenedAt: this.lastOpenedAt,
      failures:     this.failures,
      savedAt:      Date.now(),
    }
    getRedis()
      .set(redisKey(this.name), JSON.stringify(payload), "EX", REDIS_TTL_SEC)
      .catch(() => { /* non-critical — degraded to in-memory only */ })
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
        this.state         = "HALF_OPEN"
        this.probeInFlight = true
        console.info(JSON.stringify({ event: "circuit_half_open", service: this.name }))
        this.persist()
        return true

      case "HALF_OPEN":
        return false
    }
  }

  /**
   * Record a successful response. Call this after a 2xx/3xx/4xx response.
   */
  success(): void {
    if (this.state === "HALF_OPEN" || this.state === "OPEN") {
      this.state         = "CLOSED"
      this.failures      = []
      this.probeInFlight = false
      console.info(JSON.stringify({ event: "circuit_closed", service: this.name }))
      this.persist()
    }
  }

  /**
   * Record a failure. Call this on 5xx responses, timeouts, or connection errors.
   */
  failure(): void {
    const now = Date.now()

    this.failures = this.failures.filter(ts => now - ts < this.config.windowMs)
    this.failures.push(now)

    if (this.state === "HALF_OPEN") {
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
      event:      "circuit_open",
      service:    this.name,
      failures:   this.failures.length,
      cooldownMs: this.config.cooldownMs,
    }))
    this.persist()
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

/**
 * Restore all known breaker states from Redis.
 * Call this once at gateway startup, before serving any traffic.
 * Failures are silently ignored — in-memory state is the fallback.
 */
export async function restoreAllBreakers(): Promise<void> {
  const knownServices = ["AUTH", "PRODUCT", "ORDER", "PAYMENT"]
  await Promise.allSettled(
    knownServices.map(name => getBreaker(name).restoreFromRedis())
  )
}
