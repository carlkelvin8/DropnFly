"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

const BAG_COLORS: Record<string, string> = {
  "Extra Small": "#d1d5db",
  Small: "#3b7ac7",
  Standard: "#ea7d3d",
  Large: "#9ca3af",
};
const BAG_FALLBACK_COLORS = ["#ea7d3d", "#3b7ac7", "#9ca3af", "#e3f0fb"];

export default function RechartsBagBar({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
          <Tooltip
            formatter={(value, _name, props) => [
              `${value} bag${Number(value) !== 1 ? "s" : ""}`,
              `Type: ${props?.payload?.name || ""}`,
            ]}
            contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px" }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={BAG_COLORS[entry.name] || BAG_FALLBACK_COLORS[i % BAG_FALLBACK_COLORS.length]} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value) => {
                const total = data.reduce((s, b) => s + b.value, 0);
                const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0;
                return `${value} (${pct}%)`;
              }}
              style={{ fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
