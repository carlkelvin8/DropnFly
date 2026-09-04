"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

const DEFAULT_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ef4444",
  "#6366f1",
  "#22c55e",
  "#ec4899",
];

const BAG_COLORS: Record<string, string> = {
  "Extra Small": "#9ca3af",
  Small: "#3b7ac7",
  Standard: "#ea7d3d",
  Large: "#1f2937",
};

export default function RechartsHBar({
  data,
  colors,
  unit = "items",
  maxItems = 8,
}: {
  data: { name: string; value: number }[];
  colors?: string[];
  unit?: string;
  maxItems?: number;
}) {
  const palette = colors?.length ? colors : DEFAULT_PALETTE;

  let rows = [...data].sort((a, b) => b.value - a.value);
  if (rows.length > maxItems) {
    const top = rows.slice(0, maxItems - 1);
    const rest = rows.slice(maxItems - 1);
    const othersValue = rest.reduce((sum, d) => sum + d.value, 0);
    if (othersValue > 0) top.push({ name: "Others", value: othersValue });
    rows = top;
  }

  const total = rows.reduce((sum, d) => sum + d.value, 0);
  const maxNameLength = Math.max(...rows.map((d) => d.name.length), 0);
  const yAxisWidth = Math.min(150, Math.max(84, maxNameLength * 7 + 14));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 48 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            formatter={(value) => {
              const singular = unit.replace(/s$/, "");
              const label = Number(value) === 1 ? singular : unit;
              return [`${Number(value).toLocaleString()} ${label}`, "Count"];
            }}
            contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px" }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {rows.map((entry, i) => {
              const color = BAG_COLORS[entry.name] || palette[i % palette.length];
              return <Cell key={entry.name} fill={color} />;
            })}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value) =>
                `${Number(value).toLocaleString()}${total > 0 ? ` (${((Number(value) / total) * 100).toFixed(0)}%)` : ""}`
              }
              style={{ fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}