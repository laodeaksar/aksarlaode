import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { Skeleton } from "@repo/ui/components/skeleton";
import { Badge } from "@repo/ui/components/badge";

import { getCustomerFn } from "@/server/customers";
import { PageHeader } from "@/components/layout/page-header";
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

// ── Skeleton ───────────────────────────────────────────────────────────────

function CustomerDetailSkeleton() {
  return (
    <div className="space-y-4 max-w-xl">
      <Skeleton className="h-8 w-40" />
      <div className="bg-card rounded-xl border border-border p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-44" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface CustomerDetailProps {
  userId: string;
}

export function CustomerDetail({ userId }: CustomerDetailProps) {
  const router = useRouter();
  const { session } = useSession();
  const canWrite = session ? can(session.role, "users:manage") : false;

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", userId],
    queryFn: () => getCustomerFn({ data: { id: userId } }),
  });

  if (isLoading && !customer) return <CustomerDetailSkeleton />;
  if (!customer) return <p className="p-6 text-red-500">Customer tidak ditemukan.</p>;

  const formattedCreatedAt = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="Detail Customer" />

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Nama</span>
          <span className="font-medium text-foreground">{customer.name}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Email</span>
          <span className="font-medium text-foreground">{customer.email}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Role</span>
          <Badge variant={ROLE_VARIANTS[customer.role] ?? "outline"}>
            {customer.role}
          </Badge>
        </div>
        {customer.phone && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Telepon</span>
            <span className="font-medium text-foreground">{customer.phone}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Bergabung</span>
          <span className="text-sm text-muted-foreground">{formattedCreatedAt}</span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-border">
          <span className="text-muted-foreground text-sm">ID</span>
          <span className="font-mono text-xs text-muted-foreground">
            {customer.id}
          </span>
        </div>
      </div>

      {canWrite && customer.role !== "OWNER" && (
        <div className="flex gap-2">
          <EditCustomerRoleDialog
            customerId={customer.id}
            customerName={customer.name}
            currentRole={customer.role}
          />
          <DeleteCustomerButton
            customerId={customer.id}
            customerName={customer.name}
            onSuccess={() => router.navigate({ to: "/customers" })}
          />
        </div>
      )}
    </div>
  );
}
