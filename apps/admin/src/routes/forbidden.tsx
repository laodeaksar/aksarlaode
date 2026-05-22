import { createFileRoute } from "@tanstack/react-router";

import { Forbidden } from "@/components/shared";

export const Route = createFileRoute("/forbidden")({
  head: () => ({
    meta: [{ title: "Access Denied — Admin" }],
  }),
  component: Forbidden,
});
