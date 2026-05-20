import type { ReactNode } from "react";

import { Toaster } from "sonner";

export function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40">
      {children}
      <Toaster position="top-center" richColors />
    </div>
  );
}
