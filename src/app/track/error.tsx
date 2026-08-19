"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function TrackError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-blue-50/50 dark:bg-background flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">Tracking Error</h1>
        <p className="mt-2 text-muted-foreground">{error.message || "Something went wrong while loading the tracking page."}</p>
      </div>
      <div className="flex gap-3">
        <button onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
        <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-lg border px-6 text-sm font-medium hover:bg-accent">Go Home</Link>
      </div>
    </div>
  );
}
