import { useState } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { authApi } from "@/lib/api/auth";
import { HttpError } from "@/lib/effect/errors";
import { AppRuntime } from "@/lib/effect/runtime";
import { registerSchema, type RegisterInput } from "@/lib/schemas/forms";
import { Field, inputCls } from "@/lib/form-ui";

export function RegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
  });

  const onSubmit = async (values: RegisterInput) => {
    setServerError(null);

    const exit = await AppRuntime.runPromiseExit(authApi.register(values));

    if (exit._tag === "Failure") {
      const err = exit.cause.error;

      if (err instanceof HttpError && err.status === 409) {
        setError("email", { message: "This email is already registered" });
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
    } catch { /* storage unavailable — non-critical */ }

    setIsSuccess(true);

    // Honour the ?redirect= param, but validate it's a same-origin path to
    // prevent open-redirect attacks. Fall back to "/" if absent or invalid.
    const raw = new URLSearchParams(window.location.search).get("redirect");
    let dest = "/";
    if (raw) {
      try {
        const url = new URL(raw, window.location.origin);
        if (url.origin === window.location.origin) dest = url.pathname;
      } catch { /* malformed — fall back to "/" */ }
    }
    window.location.href = dest;
  };

  if (isSuccess) {
    return (
      <div className="text-center text-green-600 font-medium py-8">
        Account created! Redirecting…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <Field label="Full Name" error={errors.name?.message}>
        <input
          {...register("name")}
          className={inputCls(!!errors.name)}
          placeholder="Budi Santoso"
          autoComplete="name"
        />
      </Field>

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
          autoComplete="new-password"
          className={inputCls(!!errors.password)}
          placeholder="Min 8 characters"
        />
      </Field>

      <Field label="Confirm Password" error={errors.confirmPassword?.message}>
        <input
          {...register("confirmPassword")}
          type="password"
          autoComplete="new-password"
          className={inputCls(!!errors.confirmPassword)}
          placeholder="Repeat password"
        />
      </Field>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white
                   hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {isSubmitting ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );
}
