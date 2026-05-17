import { Effect } from "effect"
import { ApiConfig } from "@/effect/layers"
import { NetworkError, HttpError, ParseError } from "@/effect/errors"

export type FetchOptions = RequestInit & {
  cookie?: string // SSR: forward browser cookie to api-gateway
}

export const apiFetch = <T>(path: string, options: FetchOptions = {}) =>
  Effect.gen(function* () {
    const config = yield* ApiConfig

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeout)

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    }

    const res = yield* Effect.tryPromise({
      try: () =>
        fetch(`${config.baseUrl}${path}`, {
          ...options,
          headers: {
            ...headers,
            ...((options.headers as Record<string, string>) ?? {}),
          },
          credentials: "include",
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout)),
      catch: (e) => new NetworkError({ message: String(e) }),
    })

    if (res.status === 401) {
      return yield* Effect.fail(
        new (await import("../effect/errors")).AuthError({ reason: "expired" })
      )
    }

    if (res.status === 404) {
      return yield* Effect.fail(
        new (await import("../effect/errors")).NotFoundError({ resource: path })
      )
    }

    if (!res.ok) {
      const msg = yield* Effect.tryPromise({
        try: () => res.json().then((b: any) => b.error ?? res.statusText),
        catch: () => res.statusText,
      })
      return yield* Effect.fail(
        new HttpError({ status: res.status, message: msg as string })
      )
    }

    return yield* Effect.tryPromise({
      try: () => res.json() as Promise<T>,
      catch: (e) => new ParseError({ message: String(e) }),
    })
  })
