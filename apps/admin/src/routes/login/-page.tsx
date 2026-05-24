import { useEffect, useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { Form, useField, useForm } from "@formisch/react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/ui/components/input-group";

import { loginFn } from "@/server/auth";
import { LoginSchema } from "@/schemas/forms";
import { LoginPageSkeleton } from "@/components/login";
import { toast } from "@/lib";

import { Route } from "./route";

// ── LoginPage ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();
  const { logout } = Route.useSearch();
  const [showPassword, setShowPassword] = useState(false);

  // Saat user tiba dengan ?logout=1 (dikirim NavUser setelah logout berhasil):
  //   1. Tampilkan skeleton (form belum di-render — tidak ada flash).
  //   2. useEffect jalan → toast konfirmasi muncul.
  //   3. URL dibersihkan → skeleton diganti form normal.
  useEffect(() => {
    if (!logout) return;
    toast.success("Berhasil keluar dari akun");
    void navigate({ to: "/login", search: {}, replace: true });
  }, [logout, navigate]);

  const form = useForm({
    schema: LoginSchema,
    initialInput: { email: "", password: "" },
  });

  const emailField = useField(form, { path: ["email"] as const });
  const passwordField = useField(form, { path: ["password"] as const });

  const mutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      loginFn({ data }),
    onSuccess: () => {
      navigate({ to: "/dashboard" });
    },
  });

  if (logout) return <LoginPageSkeleton />;

  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          <Form
            of={form}
            onSubmit={(data) => mutation.mutate(data)}
            className="space-y-4"
          >
            <FieldGroup>
              <Field data-invalid={!!emailField.errors}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  {...emailField.props}
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="example@mail.com"
                  aria-invalid={!!emailField.errors}
                  disabled={mutation.isPending}
                />
                {emailField.errors && (
                  <FieldError
                    errors={emailField.errors.map((m) => ({ message: m }))}
                  />
                )}
              </Field>

              <Field data-invalid={!!passwordField.errors}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    {...passwordField.props}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    aria-invalid={!!passwordField.errors}
                    disabled={mutation.isPending}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}

                      <span className="sr-only">
                        {showPassword
                          ? "Sembunyikan password"
                          : "Tampilkan password"}
                      </span>
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {passwordField.errors && (
                  <FieldError
                    errors={passwordField.errors.map((m) => ({ message: m }))}
                  />
                )}
              </Field>
            </FieldGroup>

            {mutation.isError && (
              <p role="alert" className="text-sm text-red-600">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Login gagal. Periksa email dan password."}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Masuk..." : "Masuk"}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
