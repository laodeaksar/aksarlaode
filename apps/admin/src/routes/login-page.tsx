import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { effectResolver } from "@/lib/effect-resolver"
import { authApi } from "@/lib/api"
import { LoginSchema, type LoginFields } from "@/schemas/forms"
import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/ui/components/input-group"

export default function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: effectResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  })

  const mutation = useMutation({
    mutationFn: async (data: LoginFields) => {
      const result = await authApi.login(data)
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      navigate({ to: "/dashboard" })
    },
  })

  const onFormSubmit = handleSubmit((data) => mutation.mutate(data))

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
                {errors.email && (
                  <FieldError errors={[errors.email]} />
                )}
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
                    <button
                      type="button"
                      className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword
                        ? <EyeOffIcon className="h-4 w-4" />
                        : <EyeIcon    className="h-4 w-4" />}
                    </button>
                  </InputGroupAddon>
                </InputGroup>
                {errors.password && (
                  <FieldError errors={[errors.password]} />
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
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
