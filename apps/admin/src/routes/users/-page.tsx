import { useQuery } from "@tanstack/react-query";
import { ShieldCheckIcon } from "lucide-react";

import { listAdminUsersFn } from "@/server/users";
import { DataTable, PaginationBar } from "@/components/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState, SearchInput } from "@/components/shared";
import { InviteUserDialog, userColumns } from "@/components/users";
import {
  useDebouncedInput,
  useFilteredNavigation,
  useRouteSearch,
} from "@/lib";

import { Route } from "./route";

export default function UsersPage() {
  const page = useRouteSearch(Route, (s) => s.page);
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

  const emptyState = (
    <ModuleEmptyState
      icon={<ShieldCheckIcon />}
      title={search ? "Pengguna tidak ditemukan" : "Belum ada pengguna admin"}
      description={
        search
          ? `Tidak ada pengguna yang cocok dengan "${search}".`
          : "Undang anggota tim pertama untuk mulai mengelola toko bersama."
      }
      action={search ? undefined : <InviteUserDialog />}
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Users" subtitle="Manage staff and admin accounts" />

      <div className="flex items-center justify-between gap-3">
        <SearchInput
          placeholder="Search by name or email..."
          {...searchInput}
        />
        <InviteUserDialog />
      </div>

      <div className="space-y-3">
        <DataTable
          columns={userColumns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyState={emptyState}
        />
        <PaginationBar route={Route} to="/users" total={data?.total ?? 0} />
      </div>
    </div>
  );
}
