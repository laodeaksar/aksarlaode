import { renderMetrics } from "./lib/metrics";
import { emailWorker } from "./processor/email.processor";
import { emailQueue } from "./queues/email.queue";

console.info(
  JSON.stringify({ event: "worker_started", service: "email-worker" })
);

// P1 FIX: Global unhandledRejection handler.
// Without this, an unhandled rejection in a fire-and-forget promise (e.g.
// a non-awaited fetch) crashes the Bun process with no structured log entry,
// making the failure invisible to alerting systems.
process.on("unhandledRejection", (reason: unknown) => {
  console.error(
    JSON.stringify({
      event: "unhandled_rejection",
      severity: "CRITICAL",
      error: reason instanceof Error ? reason.message : String(reason),
      service: "email-worker",
    })
  );
  // Do NOT call process.exit() here — let BullMQ finish in-flight jobs.
  // The process will exit naturally after the current event loop drains,
  // or the orchestrator will restart it based on the CRITICAL log.
});

process.on("uncaughtException", (err: Error) => {
  console.error(
    JSON.stringify({
      event: "uncaught_exception",
      severity: "CRITICAL",
      error: err.message,
      stack: err.stack,
      service: "email-worker",
    })
  );
  // For uncaught exceptions the process state is undefined — exit immediately
  // so the orchestrator can restart with a clean state.
  process.exit(1);
});

const METRICS_PORT = Number(process.env.METRICS_PORT ?? 9100);

Bun.serve({
  port: METRICS_PORT,
  fetch(req: Request) {
    const { pathname } = new URL(req.url);

    if (pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "email-worker" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (pathname === "/metrics") {
      return new Response(renderMetrics(), {
        headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.info(
  JSON.stringify({
    event: "metrics_server_started",
    service: "email-worker",
    port: METRICS_PORT,
  })
);

// Graceful shutdown — emailWorker.close() waits for the active job to finish
// before the process exits, preventing mid-send interruptions.
const shutdown = async (signal: string) => {
  console.info(
    JSON.stringify({ event: "shutdown", signal, service: "email-worker" })
  );
  await emailWorker.close();
  await emailQueue.close();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
