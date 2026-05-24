"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/ui/components/chart";
import type { ChartConfig } from "@repo/ui/components/chart";

import type { QueueJobTypeStats } from "@/types";

// ── Chart config ─────────────────────────────────────────────────────────────

const chartConfig = {
  completed: {
    label: "Delivered",
    color: "var(--color-emerald-500, #10b981)",
  },
  failed: {
    label: "Failed",
    color: "var(--color-red-500, #ef4444)",
  },
} satisfies ChartConfig;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Shorten job type names for the Y-axis label. */
function shortLabel(name: string): string {
  return name
    .replace("order-", "ord-")
    .replace("password-", "pwd-")
    .replace("shipping-", "ship-")
    .replace("staff-", "stf-");
}

// ── Chart component ──────────────────────────────────────────────────────────

type Props = {
  stats: QueueJobTypeStats[];
  isLoading: boolean;
};

export function JobTypeFailureChart({ stats, isLoading }: Props) {
  const hasData = stats.length > 0;

  const chartData = stats.map((s) => ({
    ...s,
    label: shortLabel(s.name),
  }));

  // Dynamic height: 52px per row, minimum 200px
  const chartHeight = Math.max(200, stats.length * 52);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Failure Rate by Email Type
        </CardTitle>
        <CardDescription>
          Delivered vs. failed — based on jobs retained in Redis (up to 500
          failed, 100 completed). Sorted by failure rate.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading && !hasData ? (
          <div className="bg-muted/40 flex h-40 items-center justify-center rounded-lg">
            <span className="text-muted-foreground text-sm">Loading…</span>
          </div>
        ) : !hasData ? (
          <div className="bg-muted/40 flex h-40 items-center justify-center rounded-lg">
            <span className="text-muted-foreground text-sm">
              No job history retained yet — data will appear after the first
              emails are processed.
            </span>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="w-full"
            style={{ height: chartHeight }}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
              barCategoryGap="30%"
              barGap={4}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />

              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                width={72}
                tick={{ fontSize: 11 }}
              />

              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11 }}
              />

              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const row = item.payload as QueueJobTypeStats & {
                        label: string;
                      };
                      const total = row.completed + row.failed;
                      const rate =
                        total > 0
                          ? Math.round((row.failed / total) * 100)
                          : 0;
                      // Only append failure-rate annotation on the "failed" bar
                      if (name === "failed" && total > 0) {
                        return (
                          <span>
                            {value}{" "}
                            <span className="text-muted-foreground">
                              ({rate}% failure rate)
                            </span>
                          </span>
                        );
                      }
                      return <span>{value}</span>;
                    }}
                  />
                }
              />

              <ChartLegend content={<ChartLegendContent />} />

              <Bar
                dataKey="completed"
                fill="var(--color-completed)"
                radius={[0, 3, 3, 0]}
              />
              <Bar
                dataKey="failed"
                fill="var(--color-failed)"
                radius={[0, 3, 3, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
