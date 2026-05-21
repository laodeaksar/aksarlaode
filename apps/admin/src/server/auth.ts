// ── server/auth.ts — LAYER-01 ──────────────────────────────────────────────
//
// Server functions untuk login, logout, dan session check.
// Menggantikan authApi.login dan authApi.logout yang sebelumnya ada di lib/api.ts.
//
// Kenapa server function (bukan client-side fetch)?
//   - Konsistensi dengan semua server calls lain di src/server/*.ts
//   - Cookie handling: Set-Cookie dari backend di-forward ke browser via
//     appendResponseHeader sehingga browser menyimpan/menghapus cookies
//     secara otomatis tanpa perlu akses window pada sisi klien.
//   - SSR safety: getSessionFn menggunakan getCookies() sehingga saat
//     beforeLoad berjalan di server, cookie dari request asli browser
//     di-forward ke API — bukan bergantung pada cookie jar Node.js
//     yang tidak tersedia.
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

export type LoginResult = {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string };
};

// ── Input schema ───────────────────────────────────────────────────────────

const LoginInputSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.minLength(1)),
  password: Schema.String.pipe(Schema.minLength(1)),
});

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
// Meneruskan request login ke backend.
// Set-Cookie header dari backend (auth tokens) di-forward ke browser via
// appendResponseHeader agar browser menyimpannya secara otomatis.

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

    return (await res.json()) as LoginResult;
  });

// ── logoutFn ───────────────────────────────────────────────────────────────
// Meneruskan cookies browser ke backend logout endpoint, lalu meneruskan
// kembali Set-Cookie (clear/expire) header agar browser menghapus session cookies.

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
//   - Hasilnya: satu queryFn yang bekerja identik di kedua environment.

export const getSessionFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Session | null> => {
    const cookieHeader = buildCookieHeader();
    try {
      const res = await fetch(`${apiUrl()}/auth/me`, {
        headers: cookieHeader ? { Cookie: cookieHeader } : {},
      });
      if (!res.ok) return null;
      const body = await res.json();
      return (body?.data ?? body ?? null) as Session | null;
    } catch {
      return null;
    }
  }
);
