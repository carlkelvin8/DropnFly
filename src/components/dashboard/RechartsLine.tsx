"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export default function RechartsLine({
  data,
  dataKeys,
  labels,
  colors,
  currencyKeys = [],
}: {
  data: { date: string; [key: string]: string | number }[];
  dataKeys: string[];
  labels: string[];
  colors: string[];
  /** Series measured in pesos. They get their own right-hand axis so counts are not flattened. */
  currencyKeys?: string[];
}) {
  const currencyLabels = new Set(dataKeys.flatMap((key, i) => (currencyKeys.includes(key) ? [labels[i]] : [])));
  const hasCurrency = currencyKeys.length > 0;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => {
              const d = new Date(`${value}T00:00:00`);
              return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
            }}
            interval="preserveStartEnd"
          />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
          {hasCurrency && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `₱${Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(1)}k` : value}`}
            />
          )}
          <Tooltip
            labelFormatter={(label) => {
              const d = new Date(`${label}T00:00:00`);
              return d.toLocaleDateString("en-PH", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
            }}
            formatter={(value, name) => {
              const isCurrency = hasCurrency ? currencyLabels.has(String(name)) : name === labels[1];
              return isCurrency ? [formatCurrency(Number(value)), String(name)] : [String(value), String(name)];
            }}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "12px",
            }}
          />
          {dataKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              yAxisId={currencyKeys.includes(key) ? "right" : "left"}
              name={labels[i]}
              stroke={colors[i] || "#ea7d3d"}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          ))}
          <Legend fontSize={11} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
