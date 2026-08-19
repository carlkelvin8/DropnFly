export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between pb-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-6 grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-6 h-48 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
