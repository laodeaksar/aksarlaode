import { defineMiddleware } from "astro:middleware"
import { AppRuntime }       from "./lib/effect/runtime"
import { authApi }          from "./lib/api/auth"

const PROTECTED = ["/checkout", "/account/orders", "/orders"]

export const onRequest = defineMiddleware(async (ctx, next) => {
  const isProtected = PROTECTED.some(p => ctx.url.pathname.startsWith(p))
  if (!isProtected) return next()

  const cookie = ctx.request.headers.get("cookie") ?? ""

  const exit = await AppRuntime.runPromiseExit(authApi.me(cookie))

  if (exit._tag === "Failure") {
    const redirect = encodeURIComponent(ctx.url.pathname)
    return ctx.redirect(`/account/login?redirect=${redirect}`)
  }

  ctx.locals.user = exit.value
  return next()
})
