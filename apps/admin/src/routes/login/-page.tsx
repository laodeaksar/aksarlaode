import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

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
import { LoginPageSkeleton } from "@/components/login";
import { LoginSchema, type LoginFields } from "@/schemas/forms";
import { effectResolver, toast } from "@/lib";

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
    void navigate({ to: "/login", search: { logout: false }, replace: true });
  }, [logout, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: effectResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: LoginFields) => loginFn({ data }),
    onSuccess: () => {
      navigate({ to: "/dashboard" });
    },
  });

  const onFormSubmit = handleSubmit((data) => mutation.mutate(data));

  if (logout) return <LoginPageSkeleton />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-center">Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onFormSubmit} className="space-y-4">
            <FieldGroup>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  {...register("email")}
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="example@mail.com"
                  aria-invalid={!!errors.email}
                  disabled={mutation.isPending}
                />
                {errors.email && <FieldError errors={[errors.email]} />}
              </Field>

              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    {...register("password")}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                    disabled={mutation.isPending}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="icon-xs" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? (
                        <EyeOffIcon />
                      ) : (
                        <EyeIcon />
                      )}

                      <span className="sr-only">
                        {
                          showPassword
                            ? "Sembunyikan password"
                            : "Tampilkan password"
                        }
                      </span>
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {errors.password && <FieldError errors={[errors.password]} />}
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
