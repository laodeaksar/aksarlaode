import { CheckCircle2, Loader2 } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";

import type { QueueActiveJob, QueueCompletedJob } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("id-ID", { timeStyle: "medium" });
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ActiveJobRow({ job }: { job: QueueActiveJob }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
      <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="text-xs">
            {job.name}
          </Badge>
          {job.orderId && (
            <span className="text-muted-foreground font-mono text-xs">
              {job.orderId}
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Started {job.processedOn ? fmtTime(job.processedOn) : "just now"}
          {job.attemptsMade > 0 && ` · attempt ${job.attemptsMade + 1}`}
        </p>
      </div>
    </div>
  );
}

function CompletedJobRow({ job }: { job: QueueCompletedJob }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {job.name}
          </Badge>
          {job.orderId && (
            <span className="text-muted-foreground font-mono text-xs">
              {job.orderId}
            </span>
          )}
          <span className="text-muted-foreground text-xs">
            {fmtDuration(job.durationMs)}
          </span>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Delivered {job.finishedOn ? fmtTime(job.finishedOn) : "—"}
        </p>
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

function Panel({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {count > 0 && (
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
            {count}
          </span>
        )}
      </div>
      {count === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  active: QueueActiveJob[];
  completed: QueueCompletedJob[];
  isLoading: boolean;
};

export function LiveJobsTracker({ active, completed, isLoading }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          Delivery Status
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Live view of emails currently being sent and recently delivered.
          Refreshes every 5 seconds.
        </p>
      </div>

      {isLoading && active.length === 0 && completed.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="In Progress"
            count={active.length}
            empty="No emails currently being processed."
          >
            {active.map((job) => (
              <ActiveJobRow key={job.id} job={job} />
            ))}
          </Panel>

          <Panel
            title="Recently Delivered"
            count={completed.length}
            empty="No completed jobs retained yet."
          >
            {completed.map((job) => (
              <CompletedJobRow key={job.id} job={job} />
            ))}
          </Panel>
        </div>
      )}
    </div>
  );
}
