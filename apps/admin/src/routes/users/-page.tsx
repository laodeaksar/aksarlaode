import { useQuery } from "@tanstack/react-query";

import { listAdminUsersFn } from "@/server/users";
import { userColumns } from "@/components/users";
import { DataTable, PaginationBar } from "@/components/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared";
import { useDebouncedInput, useFilteredNavigation, useRouteSearch } from "@/lib";

import { Route } from "./route";

export default function UsersPage() {
  const page   = useRouteSearch(Route, (s) => s.page);
  const search = useRouteSearch(Route, (s) => s.search);

  const currentPage = page ?? 1;

  const { setFilter } = useFilteredNavigation("/users");
  const searchInput = useDebouncedInput(search, (v) => setFilter("search", v));

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", { page: currentPage, search }],
    queryFn: () =>
      listAdminUsersFn({
        data: { page: currentPage, ...(search ? { search } : {}) },
      }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        subtitle="Manage staff and admin accounts"
      />

      <SearchInput placeholder="Search by name or email..." {...searchInput} />

      <div className="space-y-3">
        <DataTable
          columns={userColumns}
          data={data?.items ?? []}
          isLoading={isLoading}
        />
        <PaginationBar route={Route} to="/users" total={data?.total ?? 0} />
      </div>
    </div>
  );
}
