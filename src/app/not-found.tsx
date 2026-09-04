import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 to-blue-500/10">
        <span className="text-5xl font-bold text-orange-500">404</span>
      </div>
      <div>
        <h1 className="text-3xl font-bold">Page Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-blue-500 px-6 text-sm font-medium text-white shadow-lg transition-all hover:brightness-110"
        >
          Go Home
        </Link>
        <Link
          href="/book"
          className="inline-flex h-10 items-center gap-2 rounded-lg border px-6 text-sm font-medium transition-colors hover:bg-accent"
        >
          Book Now
        </Link>
      </div>
    </div>
  );
}
