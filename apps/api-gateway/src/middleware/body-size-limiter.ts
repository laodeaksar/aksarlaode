import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "@/types/context";

// ── Per-prefix size limits ────────────────────────────────────────────────────
// Auth and payment payloads are tiny (tokens, amounts, emails).
// Product payloads may include base64 images or rich content in the future.
const SIZE_LIMITS: ReadonlyArray<{ prefix: string; maxBytes: number }> = [
  { prefix: "/auth", maxBytes: 64 * 1024 }, //  64 KB
  { prefix: "/payments", maxBytes: 64 * 1024 }, //  64 KB
  { prefix: "/orders", maxBytes: 512 * 1024 }, // 512 KB
  { prefix: "/products", maxBytes: 10 * 1024 * 1024 }, // 10 MB
];
const DEFAULT_MAX_BYTES = 1 * 1024 * 1024; // 1 MB

// Methods that can carry a body worth checking
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

// ── Helpers ───────────────────────────────────────────────────────────────────
function limitForPath(path: string): number {
  for (const { prefix, maxBytes } of SIZE_LIMITS) {
    if (path.startsWith(prefix)) return maxBytes;
  }
  return DEFAULT_MAX_BYTES;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

// ── Middleware ────────────────────────────────────────────────────────────────
export const bodySizeLimiter: MiddlewareHandler<AppEnv> = async (c, next) => {
  // Only POST / PUT / PATCH carry meaningful bodies
  if (!BODY_METHODS.has(c.req.method)) return next();

  const maxBytes = limitForPath(c.req.path);

  // ── Fast path: Content-Length header is present ───────────────────────────
  // Most well-behaved HTTP clients set this; check it without reading the body.
  const contentLengthHeader = c.req.header("content-length");
  if (contentLengthHeader !== undefined) {
    const declaredSize = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(declaredSize) && declaredSize > maxBytes) {
      console.warn(
        JSON.stringify({
          event: "body_too_large",
          requestId: c.var.requestId,
          path: c.req.path,
          declared: declaredSize,
          limit: maxBytes,
        })
      );
      return c.json(
        {
          error: `Request body exceeds the ${formatBytes(maxBytes)} limit for this endpoint`,
          code: "PAYLOAD_TOO_LARGE",
          requestId: c.var.requestId,
        },
        413
      );
    }
    // Content-Length is within bounds — proceed without buffering the body.
    return next();
  }

  // ── Slow path: no Content-Length header — read a clone to measure ─────────
  // Clone the request so the original stream is preserved for the proxy layer.
  const bytes = await c.req.raw.clone().arrayBuffer();
  if (bytes.byteLength > maxBytes) {
    console.warn(
      JSON.stringify({
        event: "body_too_large",
        requestId: c.var.requestId,
        path: c.req.path,
        actual: bytes.byteLength,
        limit: maxBytes,
      })
    );
    return c.json(
      {
        error: `Request body exceeds the ${formatBytes(maxBytes)} limit for this endpoint`,
        code: "PAYLOAD_TOO_LARGE",
        requestId: c.var.requestId,
      },
      413
    );
  }

  return next();
};
