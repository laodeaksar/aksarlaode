import { ShieldOffIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Forbidden() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border bg-card p-10 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldOffIcon className="h-8 w-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            403 Forbidden
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            Access Denied
          </h1>
          <p className="text-sm text-muted-foreground">
            You don't have permission to view this page. Contact your
            administrator if you think this is a mistake.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Go back
          </button>
          <Link
            to="/dashboard"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
