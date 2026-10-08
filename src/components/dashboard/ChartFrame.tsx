"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Measures its own box and renders the chart with explicit pixel dimensions.
 * Recharts' ResponsiveContainer rendered at width/height -1 on first paint and did not always
 * recover, which left charts blank or squeezed into a few pixels. Rendering only once the real
 * size is known (and on every resize) avoids that.
 */
export function ChartFrame({ className = "h-64 w-full", children }: { className?: string; children: (size: { width: number; height: number }) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}
