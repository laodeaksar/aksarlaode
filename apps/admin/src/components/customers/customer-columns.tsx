import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@repo/ui/components/badge";

import type { User } from "@/effect/Services";

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  OWNER: "default",
  ADMIN: "default",
  CUSTOMER: "outline",
};

export const customerColumns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ getValue }) => (
      <span className="font-medium text-foreground">
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
    cell: ({ row }) => (
      <Link
        to="/customers/$userId"
        params={{ userId: row.original.id }}
        className="text-sm text-blue-600 hover:underline"
      >
        View
      </Link>
    ),
  },
];
