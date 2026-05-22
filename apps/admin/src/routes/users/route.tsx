import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { valibotValidator } from "@tanstack/valibot-adapter";

import { listAdminUsersFn } from "@/server/users";
import { usersSearchSchema } from "@/lib/search-schemas";
import { can } from "@/lib";

export const Route = createFileRoute("/users")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session) throw redirect({ to: "/login" });
    if (!can(session.role, "users:manage")) throw redirect({ to: "/forbidden" });
  },

  validateSearch: valibotValidator(usersSearchSchema),

  loaderDeps: ({ search }) => ({
    page: search.page,
    search: search.search,
  }),

  loader: ({ deps, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["admin-users", { page: deps.page ?? 1, search: deps.search }],
      queryFn: () =>
        listAdminUsersFn({
          data: {
            page: deps.page ?? 1,
            ...(deps.search ? { search: deps.search } : {}),
          },
        }),
    });
  },

  head: () => ({
    meta: [{ title: "Users — Admin" }],
  }),

  component: () => <Outlet />,
});
