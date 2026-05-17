import { useState } from "react"
import { useForm } from "react-hook-form"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { env } from "@repo/env/admin"

import { hasAnyAdminRole } from "@/lib/rbac"
import type { UserRole } from "@/lib/auth"

export const Route = createFileRoute("/login/")({
  component: LoginPage,
})

type LoginFields = {
  email: string
  password: string
}

function LoginPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFields>()

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null)
    try {
      const res = await fetch(`${env.PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setServerError(data.error ?? "Login failed")
        return
      }

      const role = data?.user?.role as UserRole | undefined
      if (!role || !hasAnyAdminRole(role)) {
        setServerError("Admin access required")
        return
      }

      navigate({ to: "/dashboard" })
    } catch {
      setServerError("Network error")
    }
  })

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Login</h1>

        {serverError && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">
            {serverError}
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              {...register("email", { required: true })}
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              {...register("password", { required: true })}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gray-900 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  )
}
