import type { ReactNode } from "react";

import { Toaster } from "sonner";

export function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/40 min-h-screen">
      {children}
      <Toaster position="top-center" richColors />
    </div>
  );
}
