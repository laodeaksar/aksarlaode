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

import { DeactivateUserButton } from "./deactivate-user-button";
import { EditUserRoleDialog } from "./edit-user-role-dialog";
import { RestoreUserButton } from "./restore-user-button";

const ROLE_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  OWNER: "default",
  ADMIN: "default",
  FINANCE: "secondary",
};

// ── Actions cell — uses hooks, must be its own component ──────────────────

function UserActions({ row }: { row: { original: User } }) {
  const user = row.original;
  const isDeactivated = !!user.deletedAt;
  // OWNER role cannot be reassigned — only deactivated/restored
  const canChangeRole = user.role !== "OWNER";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-8 w-8 p-0" />}
      >
        <span className="sr-only">Open menu</span>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isDeactivated && canChangeRole && (
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <EditUserRoleDialog
              userId={user.id}
              userName={user.name}
              currentRole={user.role}
            />
          </DropdownMenuItem>
        )}
        {!isDeactivated && (
          <>
            {canChangeRole && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <DeactivateUserButton userId={user.id} userName={user.name} />
            </DropdownMenuItem>
          </>
        )}
        {isDeactivated && (
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <RestoreUserButton userId={user.id} userName={user.name} />
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Column definitions ─────────────────────────────────────────────────────

export const userColumns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "Name",
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
    accessorKey: "deletedAt",
    header: "Status",
    cell: ({ getValue }) => {
      const deletedAt = getValue() as string | null | undefined;
      return deletedAt ? (
        <Badge variant="destructive">Deactivated</Badge>
      ) : (
        <Badge variant="outline">Active</Badge>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <UserActions row={row} />,
  },
];
