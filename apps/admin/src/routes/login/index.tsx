import { lazy } from "react";

import { createFileRoute } from "@tanstack/react-router";

const LoginPage = lazy(() => import("./-page"));

export const Route = createFileRoute("/login/")({
  component: LoginPage,
});
