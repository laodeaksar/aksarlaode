import * as React from "react";

import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";

import { ErrorBoundary } from "@/components/shared";

import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { SiteHeader } from "./site-header";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = React.useState(false);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader onOpenCommand={() => setCommandOpen(true)} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <ErrorBoundary>
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                    Loading…
                  </div>
                }
              >
                {children}
              </React.Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </SidebarInset>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </SidebarProvider>
  );
}
