import { useState } from "react";

import { Form, Field as FormField, setErrors, useForm } from "@formisch/react";

import { authApi } from "@/lib/api/auth";
import { HttpError } from "@/lib/effect/errors";
import { AppRuntime } from "@/lib/effect/runtime";
import { Field, inputCls } from "@/lib/form-ui";
import { registerSchema, type RegisterInput } from "@/lib/schemas/forms";

export function RegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // validate: "blur" preserves the original mode: "onBlur" UX —
  // fields are validated when the user leaves them, and revalidated on blur too.
  const form = useForm({
    schema: registerSchema,
    validate: "blur",
    revalidate: "blur",
  });

  const onSubmit = async (values: RegisterInput) => {
    setServerError(null);

    const exit = await AppRuntime.runPromiseExit(authApi.register(values));

    if (exit._tag === "Failure") {
      const err = exit.cause.error;

      if (err instanceof HttpError && err.status === 409) {
        setErrors(form, {
          path: ["email"] as const,
          errors: ["This email is already registered"],
        });
        return;
      }

      setServerError("Registration failed. Please try again.");
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
    // prevent open-redirect attacks. Fall back to "/" if absent or invalid.
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
        Account created! Redirecting…
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

      <FormField of={form} path={["name"] as const}>
        {(nameField) => (
          <Field label="Full Name" error={nameField.errors?.[0]}>
            <input
              {...nameField.props}
              className={inputCls(!!nameField.errors)}
              placeholder="Budi Santoso"
              autoComplete="name"
            />
          </Field>
        )}
      </FormField>

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
              autoComplete="new-password"
              className={inputCls(!!passwordField.errors)}
              placeholder="Min 8 characters"
            />
          </Field>
        )}
      </FormField>

      <FormField of={form} path={["confirmPassword"] as const}>
        {(confirmField) => (
          <Field label="Confirm Password" error={confirmField.errors?.[0]}>
            <input
              {...confirmField.props}
              type="password"
              autoComplete="new-password"
              className={inputCls(!!confirmField.errors)}
              placeholder="Repeat password"
            />
          </Field>
        )}
      </FormField>

      <button
        type="submit"
        disabled={form.isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {form.isSubmitting ? "Creating account…" : "Create Account"}
      </button>
    </Form>
  );
}
