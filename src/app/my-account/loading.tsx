export default function MyAccountLoading() {
  return (
    <div className="min-h-screen bg-blue-50/50 dark:bg-background">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="h-9 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border bg-card p-6" />
          ))}
        </div>
      </div>
    </div>
  );
}
