// Shared styled wrappers for native <select> and <input> elements used in
// page-level filter bars.  Ensures a consistent visual style without
// duplicating the Tailwind class string across route files.

import { cn } from "@repo/ui/lib/utils";

const FILTER_CLS =
  "rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs " +
  "focus:outline-none focus:ring-2 focus:ring-ring";

export function FilterSelect({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"select">) {
  return <select className={cn(FILTER_CLS, className)} {...props} />;
}

export function FilterInput({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input">) {
  return <input className={cn(FILTER_CLS, className)} {...props} />;
}
