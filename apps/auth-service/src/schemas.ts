import { t } from "elysia"

export const LoginBody = t.Object({
  email:    t.String({ format: "email" }),
  password: t.String({ minLength: 1 }),
})

export const RegisterBody = t.Object({
  email:    t.String({ format: "email" }),
  name:     t.String({ minLength: 2, maxLength: 100 }),
  password: t.String({ minLength: 8, maxLength: 72 }),
})

export const UpdateProfileBody = t.Object({
  name:      t.Optional(t.String({ minLength: 2, maxLength: 100 })),
  phone:     t.Optional(t.String({ minLength: 7, maxLength: 20 })),
  avatarUrl: t.Optional(t.String({ format: "uri",  maxLength: 500 })),
})

export const ChangePasswordBody = t.Object({
  currentPassword: t.String({ minLength: 1 }),
  newPassword:     t.String({ minLength: 8, maxLength: 72 }),
})

export const ForgotPasswordBody = t.Object({
  email: t.String({ format: "email" }),
})

export const ResetPasswordBody = t.Object({
  token:       t.String({ minLength: 1 }),
  newPassword: t.String({ minLength: 8, maxLength: 72 }),
})

export const SessionQuery = t.Object({
  page:  t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
})
