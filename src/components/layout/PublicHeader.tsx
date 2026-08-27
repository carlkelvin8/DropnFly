"use client";

import Link from "next/link";
import { Home } from "lucide-react";

interface PublicHeaderProps {
  showBackToHome?: boolean;
}

export function PublicHeader({ showBackToHome }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <span className="text-blue-600">Drop</span><span className="text-orange-500">nfly</span>
        </Link>
        <nav className="flex items-center gap-4">
          {showBackToHome && (
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-blue-600"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
          )}
          <Link
            href="/book"
            className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-orange-600"
          >
            Book
          </Link>
          <Link
            href="/track"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-blue-600"
          >
            Track
          </Link>
          <Link
            href="/my-account/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-blue-600"
          >
            Passenger Login
          </Link>
          <Link
            href="/my-account/register"
            className="hidden rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent sm:inline-flex"
          >
            Create Account
          </Link>

        </nav>
      </div>
    </header>
  );
}
