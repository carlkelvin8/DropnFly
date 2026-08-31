export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <div className="h-7 w-36 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-4 w-48 animate-pulse rounded bg-muted/60" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
              <div className="h-8 w-8 animate-pulse rounded-lg bg-muted/40" />
            </div>
            <div className="h-7 w-16 animate-pulse rounded bg-muted mt-2" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted/40 mt-1" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="h-5 w-32 animate-pulse rounded bg-muted mb-4" />
            <div className="h-48 animate-pulse rounded-lg bg-muted/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
