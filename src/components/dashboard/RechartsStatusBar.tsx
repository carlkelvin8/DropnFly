"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  RECEIVED: "#8b5cf6",
  IN_STORAGE: "#6366f1",
  OUT_FOR_DELIVERY: "#f97316",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
  NO_SHOW: "#6b7280",
};

const STATUS_ORDER = [
  "PENDING",
  "CONFIRMED",
  "RECEIVED",
  "IN_STORAGE",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "NO_SHOW",
];

function makeLabel(name: string): string {
  return name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RechartsStatusBar({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const sorted = [...data].sort(
    (a, b) => STATUS_ORDER.indexOf(a.name) - STATUS_ORDER.indexOf(b.name)
  );

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            tickFormatter={(label) => makeLabel(label).split(" ").map((w) => w[0]).join("")}
            interval={0}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            formatter={(value) => [
              `${value} booking${Number(value) !== 1 ? "s" : ""}${total > 0 ? ` (${((Number(value) / total) * 100).toFixed(1)}%)` : ""}`,
              "Count",
            ]}
            labelFormatter={(label) => makeLabel(String(label))}
            contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px" }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {sorted.map((entry) => (
              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#9ca3af"} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(value) => Number(value)}
              style={{ fontSize: 11, fontWeight: 600, fill: "currentColor" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {sorted.map((entry) => (
          <span key={entry.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[entry.name] || "#9ca3af" }} />
            {makeLabel(entry.name)}
          </span>
        ))}
      </div>
    </div>
  );
}