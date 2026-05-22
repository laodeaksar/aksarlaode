import { Link } from "@tanstack/react-router";

import { ShieldOffIcon } from "lucide-react";

export function Forbidden() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="bg-card flex w-full max-w-md flex-col items-center gap-6 rounded-xl border p-10 text-center shadow-sm">
        <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
          <ShieldOffIcon className="text-destructive h-8 w-8" />
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            403 Forbidden
          </p>
          <h1 className="text-foreground text-2xl font-semibold">
            Access Denied
          </h1>
          <p className="text-muted-foreground text-sm">
            You don't have permission to view this page. Contact your
            administrator if you think this is a mistake.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-colors"
          >
            Go back
          </button>
          <Link
            to="/dashboard"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
