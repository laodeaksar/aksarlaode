import { lazy } from "react";

import { createFileRoute } from "@tanstack/react-router";

const UsersPage = lazy(() => import("./-page"));

export const Route = createFileRoute("/users/")({
  component: UsersPage,
});
