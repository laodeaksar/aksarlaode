import { timingSafeEqual } from "node:crypto"

import { env } from "@repo/env/auth"

/**
 * Validates the x-service-token header using a constant-time comparison.
 *
 * Standard string inequality (!==/!==) short-circuits on the first differing
 * byte, creating a timing oracle that an attacker on the same network can use
 * to brute-force the token one character at a time.
 *
 * timingSafeEqual always takes the same amount of time regardless of where
 * the strings diverge, eliminating that oracle.
 *
 * Note: timingSafeEqual throws when buffers differ in length, so we check
 * length first. Length is itself O(1) and reveals only whether the caller
 * submitted the right number of bytes — not which bytes are correct.
 */
export const serviceTokenMiddleware = ({
  headers,
  set,
}: {
  headers: Record<string, string | undefined>
  set: { status?: number; headers: Record<string, string> }
}) => {
  const provided = Buffer.from(headers["x-service-token"] ?? "", "utf8")
  const expected = Buffer.from(env.INTERNAL_SERVICE_TOKEN, "utf8")

  const valid =
    provided.length === expected.length && timingSafeEqual(provided, expected)

  if (!valid) {
    set.status = 403
    return { error: "Forbidden" }
  }
}
