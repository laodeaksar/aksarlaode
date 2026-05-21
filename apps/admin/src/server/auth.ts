// ── server/auth.ts — LAYER-01 ──────────────────────────────────────────────
//
// Server functions untuk login, logout, dan session check.
//
// Aturan definitif setelah LAYER-01:
//   login / logout       → sini (server function + cookie forwarding)
//   session check (SSR)  → sini (getSessionFn, pakai getCookies())
//   silent token refresh → lib/api.ts (butuh window.location + client-side)
//   semua data lainnya   → src/server/*.ts (Effect + ApiClientService)

import { createServerFn } from "@tanstack/react-start";
import { getCookies, setResponseHeader } from "@tanstack/react-start/server";

import { Schema } from "effect";

import type { Session } from "@/lib/auth";

import { decodeOrThrow } from "./_utils";

// ── Config ─────────────────────────────────────────────────────────────────

const apiUrl = () => process.env["PUBLIC_API_URL"] ?? "http://localhost:3000";

// ── Runtime validation schemas ─────────────────────────────────────────────
// All responses from the auth service are validated before being trusted.
// This prevents type confusion when the backend schema drifts or returns
// unexpected payloads.

const SessionSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.minLength(1)),
  name: Schema.String,
  role: Schema.Literal("CUSTOMER", "ADMIN", "OWNER", "FINANCE"),
});

const LoginResultSchema = Schema.Struct({
  accessToken: Schema.String.pipe(Schema.minLength(1)),
  user: Schema.Struct({
    id: Schema.String,
    email: Schema.String,
    name: Schema.String,
    role: Schema.String,
  }),
});

// ── Input schema ───────────────────────────────────────────────────────────

const LoginInputSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.minLength(1)),
  password: Schema.String.pipe(Schema.minLength(1)),
});

// ── Cookie forwarding helper (shared) ──────────────────────────────────────
// Builds a Cookie header string from the current request's cookies so that
// server-side fetches to the backend carry the session tokens.

function buildCookieHeader(): string {
  const cookies = getCookies();
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("; ");
}

// ── Types ──────────────────────────────────────────────────────────────────

export type LoginResult = Schema.Schema.Type<typeof LoginResultSchema>;

// ── Cookie forwarding helper ───────────────────────────────────────────────
// Forward semua Set-Cookie header dari backend response ke browser.
// Menggunakan Headers#getSetCookie() (tersedia sejak Node 18.14 / undici 5.x)
// untuk menangani beberapa Set-Cookie header dan koma dalam nilai cookie
// dengan benar — Headers#get("set-cookie") tidak aman untuk kasus ini.

function forwardSetCookie(headers: Headers): void {
  const values: string[] =
    typeof (headers as unknown as { getSetCookie?: () => string[] })
      .getSetCookie === "function"
      ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [];
  if (values.length > 0) {
    setResponseHeader("set-cookie", values);
  }
}

// ── loginFn ────────────────────────────────────────────────────────────────

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      LoginInputSchema,
      raw as Schema.Schema.Encoded<typeof LoginInputSchema>
    )
  )
  .handler(async ({ data }): Promise<LoginResult> => {
    const res = await fetch(`${apiUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    forwardSetCookie(res.headers);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error ?? "Login gagal");
    }

    // ── PATCH 2: validate login response before trusting its shape ──────
    const json: unknown = await res.json();
    const parsed = Schema.decodeUnknownEither(LoginResultSchema)(json);
    if (parsed._tag === "Left") {
      throw new Error("Server returned an invalid login response.");
    }
    return parsed.right;
  });

// ── logoutFn ───────────────────────────────────────────────────────────────

export const logoutFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<void> => {
    const cookieHeader = buildCookieHeader();

    const res = await fetch(`${apiUrl()}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    forwardSetCookie(res.headers);
  }
);

// ── getSessionFn ───────────────────────────────────────────────────────────
// Server function untuk mengecek session yang aktif.
//
// Kenapa server function dan bukan plain fetch di client?
//   - Saat beforeLoad berjalan di server (SSR), Node.js tidak punya cookie
//     jar — `credentials: "include"` pada browser fetch tidak berpengaruh.
//   - createServerFn memberikan akses ke getCookies() yang membaca cookie
//     dari request H3 yang sedang aktif, baik saat SSR maupun saat dipanggil
//     dari browser (TanStack Start meneruskan cookie via HTTP ke endpoint
//     server function).

export const getSessionFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Session | null> => {
    const cookieHeader = buildCookieHeader();
    try {
      const res = await fetch(`${apiUrl()}/auth/me`, {
        headers: cookieHeader ? { Cookie: cookieHeader } : {},
      });
      if (!res.ok) return null;

      const body: unknown = await res.json();
      const raw =
        (body as { data?: unknown } | null)?.data ?? body;

      // ── PATCH 2: validate session shape before trusting it ──────────
      // Prevents type confusion if the auth service returns unexpected data.
      const parsed = Schema.decodeUnknownEither(SessionSchema)(raw);
      if (parsed._tag === "Left") return null;
      return parsed.right;
    } catch {
      return null;
    }
  }
);
