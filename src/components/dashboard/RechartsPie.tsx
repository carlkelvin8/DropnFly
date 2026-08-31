"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "#ea7d3d",
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#6366f1",
];

export default function RechartsPie({
  data,
  isDonut = false,
  currency = false,
}: {
  data: { name: string; value: number }[];
  isDonut?: boolean;
  currency?: boolean;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={isDonut ? 55 : 0}
            outerRadius={85}
            paddingAngle={data.length > 1 ? 2 : 0}
            label={({ name, percent }) =>
              `${name}: ${((percent as number) * 100).toFixed(0)}%`
            }
            labelLine={false}
            fontSize={11}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              currency ? [`₱${Number(value).toLocaleString()}`, ""] : `${value}`
            }
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "12px",
            }}
          />
          <Legend fontSize={11} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
