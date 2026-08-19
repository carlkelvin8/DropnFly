export default function TrackLoading() {
  return (
    <div className="min-h-screen bg-blue-50/50 dark:bg-background">
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <div className="mx-auto h-9 w-48 animate-pulse rounded bg-muted" />
        <div className="mx-auto mt-2 h-5 w-64 animate-pulse rounded bg-muted" />
        <div className="mx-auto mt-8 h-12 w-full max-w-md animate-pulse rounded bg-muted" />
        <div className="mx-auto mt-4 h-12 w-full max-w-md animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
