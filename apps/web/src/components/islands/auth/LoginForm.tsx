import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Effect } from "effect"
import { useForm } from "react-hook-form"

import { authApi } from "@/lib/api/auth"
import { AuthError } from "@/lib/effect/errors"
import { AppRuntime } from "@/lib/effect/runtime"
import { loginSchema, type LoginInput } from "@/lib/schemas/forms"

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginInput) => {
    setServerError(null)

    const program = Effect.gen(function* () {
      const result = yield* authApi.login(values)
      return result
    })

    const exit = await AppRuntime.runPromiseExit(program)

    if (exit._tag === "Failure") {
      const err = exit.cause.error

      // Classify error → field error vs server error
      if (err instanceof AuthError) {
        setError("password", { message: "Invalid email or password" })
        return
      }

      setServerError("Login failed. Please try again.")
      return
    }

    setIsSuccess(true)
    // Let Astro middleware handle redirect after cookie is set
    window.location.href = "/"
  }

  if (isSuccess) {
    return (
      <div className="text-center text-green-600 font-medium py-8">
        Logged in! Redirecting...
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <Field label="Email" error={errors.email?.message}>
        <input
          {...register("email")}
          type="email"
          autoComplete="email"
          className={inputCls(!!errors.email)}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <input
          {...register("password")}
          type="password"
          autoComplete="current-password"
          className={inputCls(!!errors.password)}
          placeholder="••••••••"
        />
      </Field>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white
                   hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {isSubmitting ? "Signing in..." : "Sign In"}
      </button>

      <p className="text-center text-sm text-gray-500">
        Don't have an account?{" "}
        <a href="/account/register" className="text-blue-600 hover:underline">
          Register
        </a>
      </p>
    </form>
  )
}
