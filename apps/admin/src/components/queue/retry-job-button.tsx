"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@repo/ui/components/button";

import { retryAllFn, retryJobFn } from "@/server/queue";
import { queryKeys, toast } from "@/lib";

// ── Retry single job ────────────────────────────────────────────────────────

type RetryJobButtonProps = {
  jobId: string;
};

export function RetryJobButton({ jobId }: RetryJobButtonProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => retryJobFn({ data: { jobId } }),
    onSuccess: () => {
      toast.persistent("Job queued for retry");
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.failedJobs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.activity });
    },
    onError: (err) => {
      toast.error("Failed to retry job", err);
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? "Retrying…" : "Retry"}
    </Button>
  );
}

// ── Retry all failed jobs ───────────────────────────────────────────────────

type RetryAllButtonProps = {
  failedCount: number;
};

export function RetryAllButton({ failedCount }: RetryAllButtonProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => retryAllFn({}),
    onSuccess: (result) => {
      toast.persistent(`${result.retriedCount} job(s) queued for retry`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.failedJobs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.activity });
    },
    onError: (err) => {
      toast.error("Failed to retry jobs", err);
    },
  });

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending || failedCount === 0}
    >
      {mutation.isPending ? "Retrying…" : `Retry All Failed (${failedCount})`}
    </Button>
  );
}
