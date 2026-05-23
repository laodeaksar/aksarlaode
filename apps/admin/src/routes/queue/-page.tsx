import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon } from "lucide-react";

import {
  getFailedJobsFn,
  getLiveJobsFn,
  getQueueActivityFn,
  getQueueStatsFn,
} from "@/server/queue";
import { can } from "@/lib/rbac";
import { useSession } from "@/lib/session-context";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/shared";
import {
  buildFailedJobColumns,
  LiveJobsTracker,
  QueueActivityLog,
  QueueStatsCards,
  ResendEmailDialog,
  RetryAllButton,
} from "@/components/queue";
import { useFilteredNavigation, useRouteSearch } from "@/lib";

import { Route } from "./route";

// ── Shared select style ─────────────────────────────────────────────────────
const SELECT_CLS =
  "rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs " +
  "focus:outline-none focus:ring-2 focus:ring-ring";

const JOB_TYPES = [
  "order-created",
  "order-confirmation",
  "order-cancelled",
  "password-reset",
  "shipping-update",
  "staff-invite",
] as const;

// ── Page ────────────────────────────────────────────────────────────────────

export default function QueuePage() {
  const { session } = useSession();
  const canManage = can(session?.role ?? "CUSTOMER", "queue:manage");

  const jobType = useRouteSearch(Route, (s) => s.jobType);
  const { setFilter, clearFilters } = useFilteredNavigation("/queue");

  // Stats — auto-refresh every 15 s
  const {
    data: stats,
    dataUpdatedAt,
    isFetching,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["queue-stats"],
    queryFn: () => getQueueStatsFn({}),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  // Failed jobs — auto-refresh every 15 s
  const { data: failedData, isLoading: failedLoading } = useQuery({
    queryKey: ["queue-failed-jobs"],
    queryFn: () => getFailedJobsFn({}),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  // Live delivery status — active + recently completed, tight 5 s poll
  const { data: liveData, isLoading: liveLoading } = useQuery({
    queryKey: ["queue-live-jobs"],
    queryFn: () => getLiveJobsFn({}),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  // Queue activity log — recent manual retries & resends
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["queue-activity"],
    queryFn: () => getQueueActivityFn({}),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // Client-side filter by job type
  const filteredJobs = useMemo(() => {
    const jobs = failedData?.jobs ?? [];
    if (!jobType) return jobs;
    return jobs.filter((j) => j.name === jobType);
  }, [failedData, jobType]);

  const columns = useMemo(
    () => buildFailedJobColumns({ canManage }),
    [canManage]
  );

  const failedJobsEmptyState = (
    <ModuleEmptyState
      icon={<CheckCircle2Icon />}
      title={
        jobType
          ? `Tidak ada job "${jobType}" yang gagal`
          : "Tidak ada job yang gagal"
      }
      description={
        jobType
          ? "Coba pilih tipe job lain atau hapus filter."
          : "Queue sehat — semua email terkirim tanpa masalah."
      }
      action={
        jobType ? (
          <button
            onClick={() => clearFilters("jobType")}
            className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
          >
            Hapus filter
          </button>
        ) : undefined
      }
    />
  );

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Email Queue"
          subtitle="BullMQ job queue health — failed jobs, retry actions, and real-time counters."
        />
        {canManage && <ResendEmailDialog />}
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <QueueStatsCards
        stats={stats}
        lastUpdated={dataUpdatedAt}
        onRefresh={() => void refetchStats()}
        isRefreshing={isFetching}
      />

      {/* ── Live delivery status ─────────────────────────────────────────── */}
      <div className="border-border border-t pt-6">
        <LiveJobsTracker
          active={liveData?.active ?? []}
          completed={liveData?.completed ?? []}
          isLoading={liveLoading}
        />
      </div>

      {/* ── Failed jobs ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs font-medium">
                Job type
              </label>
              <select
                className={SELECT_CLS}
                value={jobType ?? ""}
                onChange={(e) => setFilter("jobType", e.target.value)}
                aria-label="Filter by job type"
              >
                <option value="">All types</option>
                {JOB_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {jobType && (
              <button
                onClick={() => clearFilters("jobType")}
                className="text-muted-foreground hover:text-foreground self-end pb-2 text-sm underline"
              >
                Clear
              </button>
            )}
          </div>

          {canManage && (
            <RetryAllButton failedCount={failedData?.jobs.length ?? 0} />
          )}
        </div>

        <DataTable
          columns={columns}
          data={filteredJobs}
          isLoading={failedLoading}
          emptyState={failedJobsEmptyState}
        />
      </div>

      {/* ── Activity log ─────────────────────────────────────────────────── */}
      <div className="border-border border-t pt-6">
        <QueueActivityLog
          items={activityData?.items ?? []}
          isLoading={activityLoading}
        />
      </div>
    </div>
  );
}
