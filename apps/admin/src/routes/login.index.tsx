import { lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

const LoginPage = lazy(() => import("./login-page"))

export const Route = createFileRoute("/login/")({
  component: LoginPage,
})
