// ── server/auth.ts — LAYER-01 ──────────────────────────────────────────────
//
// Server functions untuk login dan logout.
// Menggantikan authApi.login dan authApi.logout yang sebelumnya ada di lib/api.ts.
//
// Kenapa server function (bukan client-side fetch)?
//   - Konsistensi dengan semua server calls lain di src/server/*.ts
//   - Cookie handling: Set-Cookie dari backend di-forward ke browser via
//     appendResponseHeader sehingga browser menyimpan/menghapus cookies
//     secara otomatis tanpa perlu akses window pada sisi klien.
//
// Aturan definitif setelah LAYER-01:
//   login / logout       → sini (server function + cookie forwarding)
//   silent token refresh → lib/api.ts (butuh window.location + client-side)
//   semua data lainnya   → src/server/*.ts (Effect + ApiClientService)

import { createServerFn } from "@tanstack/react-start";
import { appendResponseHeader, getCookies } from "@tanstack/react-start/server";

import { Schema } from "effect";

import { decodeOrThrow } from "./_utils";

// ── Config ─────────────────────────────────────────────────────────────────

const apiUrl = () => process.env["PUBLIC_API_URL"] ?? "http://localhost:3000";

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
  for (const v of values) {
    appendResponseHeader("set-cookie", v);
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
    const cookies = getCookies();
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("; ");

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
