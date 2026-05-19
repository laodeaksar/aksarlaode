import type { APIRoute } from "astro";

import { apiFetch } from "@/lib/api/client";
import { AppRuntime } from "@/lib/effect/runtime";

// Thin proxy: forwards the browser cookie to the auth service so the server-
// side session is invalidated.  Always returns 200 — the client clears its
// localStorage regardless of whether the upstream call succeeds.
export const POST: APIRoute = async ({ request }) => {
  const cookie = request.headers.get("cookie") ?? "";

  await AppRuntime.runPromiseExit(
    apiFetch<void>("/auth/logout", { method: "POST", cookie })
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
