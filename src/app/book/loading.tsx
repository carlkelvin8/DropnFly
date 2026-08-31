export default function BookLoading() {
  return (
    <div className="min-h-screen bg-blue-50/50">
      <div className="sticky top-0 z-50 border-b bg-background/90 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2 text-xl font-bold">
            <span className="text-blue-600">Drop</span><span className="text-orange-500">nfly</span>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="mx-auto mt-2 h-4 w-64 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="mb-8">
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-2 w-1/4 rounded-full bg-orange-500/30" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-8 shadow-lg">
          <div className="space-y-4">
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted/60" />
            <div className="space-y-3 pt-4">
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted/40" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted/40" />
              <div className="h-10 w-3/4 animate-pulse rounded-lg bg-muted/40" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
