export default function TrackLoading() {
  return (
    <div className="min-h-screen bg-blue-50/50">
      <div className="sticky top-0 z-50 border-b bg-background/90 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2 text-xl font-bold">
            <span className="text-blue-600">Drop</span><span className="text-orange-500">nfly</span>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-xl px-4 py-16">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 shadow-lg shadow-blue-200">
            <div className="h-7 w-7 animate-pulse rounded bg-blue-200" />
          </div>
          <div className="mx-auto h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="mx-auto mt-2 h-4 w-72 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="rounded-xl border-t-4 border-t-blue-500 bg-card p-6 shadow-lg">
          <div className="space-y-4">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-56 animate-pulse rounded bg-muted/60" />
            <div className="space-y-3 pt-2">
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted/40" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted/40" />
              <div className="h-12 w-full animate-pulse rounded-xl bg-orange-500/20" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
