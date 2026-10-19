"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardDailyPoint } from "../service";

/** Grafik batang output packing & unit cacat per hari (Recharts). */
export function OutputChart({ data }: { data: DashboardDailyPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            allowDecimals={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            labelStyle={{ color: "var(--muted-foreground)", marginBottom: 4 }}
            formatter={(value, name) => [
              Number(value).toLocaleString("id-ID"),
              name === "output" ? "Output packing" : "Cacat",
            ]}
          />
          <Bar
            dataKey="output"
            name="output"
            fill="var(--chart-1)"
            radius={[3, 3, 0, 0]}
            maxBarSize={24}
          />
          <Bar
            dataKey="rejected"
            name="rejected"
            fill="var(--chart-4)"
            radius={[3, 3, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
