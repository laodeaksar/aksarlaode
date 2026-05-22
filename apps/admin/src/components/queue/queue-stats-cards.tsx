import { RefreshCwIcon } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import type { QueueStats } from "@/types";

type Props = {
  stats: QueueStats | undefined;
  lastUpdated: number;
  onRefresh: () => void;
  isRefreshing: boolean;
};

type StatConfig = {
  key: keyof QueueStats;
  label: string;
  valueClass: string;
  dotClass: string;
};

const STATS: StatConfig[] = [
  {
    key: "waiting",
    label: "Waiting",
    valueClass: "text-blue-600 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  {
    key: "active",
    label: "Active",
    valueClass: "text-yellow-600 dark:text-yellow-400",
    dotClass: "bg-yellow-500",
  },
  {
    key: "completed",
    label: "Completed",
    valueClass: "text-green-600 dark:text-green-400",
    dotClass: "bg-green-500",
  },
  {
    key: "failed",
    label: "Failed",
    valueClass: "text-red-600 dark:text-red-400",
    dotClass: "bg-red-500",
  },
  {
    key: "delayed",
    label: "Delayed",
    valueClass: "text-orange-600 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
];

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

export function QueueStatsCards({
  stats,
  lastUpdated,
  onRefresh,
  isRefreshing,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Refresh bar */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {lastUpdated > 0
            ? `Updated ${relativeTime(lastUpdated)} · auto-refreshes every 15s`
            : "Loading…"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-1.5"
        >
          <RefreshCwIcon
            className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STATS.map(({ key, label, valueClass, dotClass }) => (
          <Card key={String(key)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                <span className={`inline-block size-2 rounded-full ${dotClass}`} />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats ? (
                <p className={`text-3xl font-bold tabular-nums ${valueClass}`}>
                  {stats[key].toLocaleString()}
                </p>
              ) : (
                <div className="bg-muted h-8 w-16 animate-pulse rounded" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
