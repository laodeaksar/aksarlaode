import type { ReactNode } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";

// ── ModuleEmptyState ───────────────────────────────────────────────────────
// Thin wrapper around @repo/ui Empty primitives with a consistent visual
// treatment for all list / table pages in the admin panel.
//
// Usage:
//   <DataTable
//     ...
//     emptyState={
//       <ModuleEmptyState
//         icon={<PackageIcon />}
//         title="Belum ada produk"
//         description="Tambah produk pertama untuk memulai."
//       />
//     }
//   />

type Props = {
  icon: ReactNode;
  title: string;
  description?: string;
  /** Optional CTA button / link rendered below the description. */
  action?: ReactNode;
};

export function ModuleEmptyState({ icon, title, description, action }: Props) {
  return (
    <Empty className="border-0 py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
