"use client";

import { ChartFrame } from "@/components/dashboard/ChartFrame";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

export default function RechartsBar({
  data,
  labelMap,
}: {
  data: { name: string; value: number }[];
  labelMap: Record<string, string>;
}) {
  return (
    <ChartFrame className="h-64 w-full">
      {({ width, height }) => (
        <BarChart width={width} height={height} data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip
            formatter={(value, _name, props) => [
              `${value} booking${Number(value) !== 1 ? "s" : ""}`,
              `Duration: ${props?.payload ? labelMap[props.payload.name] || props.payload.name : ""}`,
            ]}
            labelFormatter={(label) => `Storage: ${labelMap[label as string] || label}`}
            contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px" }}
          />
          <Bar dataKey="value" fill="#ea7d3d" radius={[4, 4, 0, 0]} />
        </BarChart>
      )}
    </ChartFrame>
  );
}
