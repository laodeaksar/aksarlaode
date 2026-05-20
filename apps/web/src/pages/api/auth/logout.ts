import type { APIRoute } from "astro";

import { apiFetch } from "@/lib/api/client";
import { AppRuntime } from "@/lib/effect/runtime";
import { getCookieHeader } from "@/lib/request";

// Thin proxy: forwards the browser cookie to the auth service so the server-
// side session is invalidated.  Always returns 200 — the client clears its
// localStorage regardless of whether the upstream call succeeds.
export const POST: APIRoute = async ({ request }) => {
  const cookie = getCookieHeader(request);

  await AppRuntime.runPromiseExit(
    apiFetch<void>("/auth/logout", { method: "POST", cookie })
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
