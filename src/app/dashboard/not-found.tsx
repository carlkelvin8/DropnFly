import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
        <span className="text-4xl font-bold text-orange-500">404</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Dashboard Page Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          The dashboard page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-blue-500 px-6 text-sm font-medium text-white shadow-lg transition-all hover:brightness-110"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
