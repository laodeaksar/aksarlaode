import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@repo/ui/components/skeleton";

import { getCustomerFn } from "@/server/customers";
import { PageHeader } from "@/components/layout/page-header";

// ── Skeleton ───────────────────────────────────────────────────────────────

function CustomerDetailSkeleton() {
  return (
    <div className="space-y-4 max-w-xl">
      <Skeleton className="h-8 w-40" />
      <div className="bg-card rounded-xl border border-border p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-44" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface CustomerDetailProps {
  userId: string;
}

export function CustomerDetail({ userId }: CustomerDetailProps) {
  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", userId],
    queryFn: () => getCustomerFn({ data: { id: userId } }),
  });

  if (isLoading && !customer) return <CustomerDetailSkeleton />;
  if (!customer) return <p className="p-6 text-red-500">Customer not found.</p>;

  return (
    <div className="space-y-4 max-w-xl">
      <PageHeader title="Customer Detail" />
      <div className="bg-card rounded-xl border border-border p-6 space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Name</span>
          <span className="font-medium text-foreground">{customer.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Email</span>
          <span className="font-medium text-foreground">{customer.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Role</span>
          <span className="font-medium text-foreground">{customer.role}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">ID</span>
          <span className="font-mono text-xs text-muted-foreground">
            {customer.id}
          </span>
        </div>
      </div>
    </div>
  );
}
