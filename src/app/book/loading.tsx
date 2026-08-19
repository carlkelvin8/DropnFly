export default function BookLoading() {
  return (
    <div className="min-h-screen bg-blue-50/50 dark:bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto h-9 w-48 animate-pulse rounded bg-muted" />
          <div className="mx-auto mt-2 h-5 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="mb-8">
          <div className="h-2 w-full rounded-full bg-muted" />
          <div className="mt-3 flex justify-between">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                <div className="mt-1.5 h-3 w-12 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
