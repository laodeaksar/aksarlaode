import type { LoginInput, RegisterInput } from "@/schemas/forms"

import { apiFetch } from "./client"

export type AuthResponse = {
  user: { id: string; name: string; email: string; role: string }
  accessToken: string
}

export const authApi = {
  login: (body: LoginInput) =>
    apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  register: (body: RegisterInput) =>
    apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: (cookie: string) =>
    apiFetch<AuthResponse["user"]>("/auth/me", { cookie }),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
}
