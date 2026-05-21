import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";

import { MoreHorizontal } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import type { User } from "@/effect/Services";
import { useSession } from "@/lib/session-context";
import { can } from "@/lib";

import { DeleteCustomerButton } from "./delete-customer-button";
import { EditCustomerRoleDialog } from "./edit-customer-role-dialog";

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  OWNER: "default",
  ADMIN: "default",
  FINANCE: "secondary",
  CUSTOMER: "outline",
};

// ── Actions cell — uses hooks, must be its own component ──────────────────

function CustomerActions({ row }: { row: { original: User } }) {
  const { session } = useSession();
  const canWrite = session ? can(session.role, "users:manage") : false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
        <span className="sr-only">Buka menu</span>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link
              to="/customers/$userId"
              params={{ userId: row.original.id }}
              className="w-full cursor-pointer"
            />
          }
        >
          Lihat Detail
        </DropdownMenuItem>
        {canWrite && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <EditCustomerRoleDialog
                customerId={row.original.id}
                customerName={row.original.name}
                currentRole={row.original.role}
              />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <DeleteCustomerButton
                customerId={row.original.id}
                customerName={row.original.name}
              />
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Column definitions ─────────────────────────────────────────────────────

export const customerColumns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "Nama",
    cell: ({ getValue }) => (
      <span className="text-foreground font-medium">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ getValue }) => {
      const role = getValue() as string;
      return <Badge variant={ROLE_VARIANTS[role] ?? "outline"}>{role}</Badge>;
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <CustomerActions row={row} />,
  },
];
