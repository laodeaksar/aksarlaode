import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

export function NotFound({ children }: { children?: ReactNode }) {
  return (
    <div className="space-y-2 p-2">
      <div className="text-muted-foreground">
        {children || <p>The page you are looking for does not exist.</p>}
      </div>
      <p className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => window.history.back()}
          className="rounded-sm bg-emerald-500 px-2 py-1 text-sm font-black text-white uppercase"
        >
          Go back
        </button>
        <Link
          to="/dashboard"
          className="rounded-sm bg-cyan-600 px-2 py-1 text-sm font-black text-white uppercase"
        >
          Go to Dashboard
        </Link>
      </p>
    </div>
  );
}
