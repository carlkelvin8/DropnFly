"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const LiveMapInner = dynamic(() => import("./LiveMapInner"), {
  ssr: false,
  loading: () => (
    <div className="relative">
      <div className="flex h-96 w-full items-center justify-center rounded-lg border bg-muted/30">
        <div className="text-center space-y-2">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    </div>
  ),
});

export function LiveMap(props: React.ComponentProps<typeof LiveMapInner>) {
  return (
    <Suspense fallback={null}>
      <LiveMapInner {...props} />
    </Suspense>
  );
}
