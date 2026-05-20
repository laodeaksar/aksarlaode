import { env } from "@repo/env/admin";

// FIX ADM-05: Expanded role type to include OWNER and FINANCE
// (FINANCE was added via migration 006; OWNER via migration 002).
export type UserRole = "CUSTOMER" | "ADMIN" | "OWNER" | "FINANCE";

export type Session = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

/**
 * @deprecated Gunakan `getSessionFn` dari `@/server/auth` sebagai gantinya.
 *
 * Fungsi ini menggunakan `credentials: "include"` yang hanya bekerja di browser.
 * Saat dipanggil di server (SSR / beforeLoad), Node.js tidak punya cookie jar
 * sehingga request ke /auth/me selalu gagal dan mengembalikan null.
 *
 * `getSessionFn` adalah `createServerFn` yang memakai `getCookies()` dari H3
 * untuk mem-forward cookie request asli browser — bekerja di kedua environment.
 */
export async function getSession(): Promise<Session | null> {
  try {
    const res = await fetch(`${env.PUBLIC_API_URL}/auth/me`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data ?? body ?? null;
  } catch {
    return null;
  }
}
