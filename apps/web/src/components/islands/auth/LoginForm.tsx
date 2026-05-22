import { useState } from "react";

import { Form, Field as FormField, setErrors, useForm } from "@formisch/react";

import { authApi } from "@/lib/api/auth";
import { AuthError } from "@/lib/effect/errors";
import { AppRuntime } from "@/lib/effect/runtime";
import { Field, inputCls } from "@/lib/form-ui";
import { loginSchema, type LoginInput } from "@/lib/schemas/forms";

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm({ schema: loginSchema });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);

    // W-19: call authApi.login directly — no redundant Effect.gen wrapper
    const exit = await AppRuntime.runPromiseExit(authApi.login(values));

    if (exit._tag === "Failure") {
      const err = exit.cause.error;

      if (err instanceof AuthError) {
        setErrors(form, {
          path: ["password"] as const,
          errors: ["Invalid email or password"],
        });
        return;
      }

      setServerError("Login failed. Please try again.");
      return;
    }

    // W-11: persist display name so Navbar can show "Hi, {name}" without an API call
    try {
      localStorage.setItem(
        "ec_user",
        JSON.stringify({ name: exit.value.user.name })
      );
    } catch {
      /* storage unavailable — non-critical */
    }

    setIsSuccess(true);

    // Honour the ?redirect= param, but validate it's a same-origin path to
    // prevent open-redirect attacks
    const raw = new URLSearchParams(window.location.search).get("redirect");
    let dest = "/";
    if (raw) {
      try {
        const url = new URL(raw, window.location.origin);
        if (url.origin === window.location.origin) dest = url.pathname;
      } catch {
        /* malformed — fall back to "/" */
      }
    }
    window.location.href = dest;
  };

  if (isSuccess) {
    return (
      <div className="py-8 text-center font-medium text-green-600">
        Logged in! Redirecting…
      </div>
    );
  }

  return (
    <Form of={form} onSubmit={onSubmit} className="space-y-4">
      {serverError && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <FormField of={form} path={["email"] as const}>
        {(emailField) => (
          <Field label="Email" error={emailField.errors?.[0]}>
            <input
              {...emailField.props}
              type="email"
              autoComplete="email"
              className={inputCls(!!emailField.errors)}
              placeholder="you@example.com"
            />
          </Field>
        )}
      </FormField>

      <FormField of={form} path={["password"] as const}>
        {(passwordField) => (
          <Field label="Password" error={passwordField.errors?.[0]}>
            <input
              {...passwordField.props}
              type="password"
              autoComplete="current-password"
              className={inputCls(!!passwordField.errors)}
              placeholder="••••••••"
            />
          </Field>
        )}
      </FormField>

      <button
        type="submit"
        disabled={form.isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {form.isSubmitting ? "Signing in…" : "Sign In"}
      </button>

      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <a href="/account/register" className="text-blue-600 hover:underline">
          Register
        </a>
      </p>
    </Form>
  );
}
