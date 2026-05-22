// Queue inspection utilities — used by the HTTP inspection endpoints in index.ts.
// Uses a dedicated Queue instance (not the producer/worker instance) so it can
// be closed independently during shutdown without interrupting in-flight jobs.

import { Queue } from "bullmq";

import { env } from "@repo/env/email-worker";
import { parseRedisUrl } from "@repo/env/utils";

export type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

// PII-safe summary — no email addresses, tokens, or personal data.
export type FailedJobSummary = {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  finishedOn: number | null;
  orderId: string | null;
};

const inspectorQueue = new Queue("email", {
  connection: parseRedisUrl(env.REDIS_URL),
});

export async function getQueueStats(): Promise<QueueStats> {
  const counts = await inspectorQueue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused"
  );
  return {
    waiting: counts["waiting"] ?? 0,
    active: counts["active"] ?? 0,
    completed: counts["completed"] ?? 0,
    failed: counts["failed"] ?? 0,
    delayed: counts["delayed"] ?? 0,
    paused: counts["paused"] ?? 0,
  };
}

export async function getFailedJobs(limit = 50): Promise<FailedJobSummary[]> {
  const jobs = await inspectorQueue.getFailed(0, limit - 1);
  return jobs.map((job) => {
    const raw = job.data as Record<string, unknown>;
    return {
      id: job.id ?? "unknown",
      name: job.name,
      // failedReason is set by BullMQ from the thrown Error message.
      // Our processor only includes structured messages (no PII).
      failedReason: job.failedReason ?? "Unknown error",
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      finishedOn: typeof job.finishedOn === "number" ? job.finishedOn : null,
      // orderId is a safe correlation key — not personal data.
      orderId: typeof raw["orderId"] === "string" ? raw["orderId"] : null,
    };
  });
}

export async function retryJob(jobId: string): Promise<boolean> {
  const job = await inspectorQueue.getJob(jobId);
  if (!job) return false;
  await job.retry();
  return true;
}

export async function retryAllFailed(): Promise<number> {
  const jobs = await inspectorQueue.getFailed(0, -1);
  const results = await Promise.allSettled(jobs.map((j) => j.retry()));
  return results.filter((r) => r.status === "fulfilled").length;
}

export async function closeInspector(): Promise<void> {
  await inspectorQueue.close();
}
