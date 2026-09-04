"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const LocationPlaybackInner = dynamic(() => import("./LocationPlaybackInner"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading map component...</p>
      </div>
      <div className="relative overflow-hidden rounded-xl border shadow-sm">
        <div className="flex h-[450px] w-full items-center justify-center bg-muted/30">
          <div className="text-center space-y-2">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      </div>
    </div>
  ),
});

export function LocationPlayback(props: React.ComponentProps<typeof LocationPlaybackInner>) {
  return (
    <Suspense fallback={null}>
      <LocationPlaybackInner {...props} />
    </Suspense>
  );
}
