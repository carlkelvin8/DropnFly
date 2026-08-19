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
          Drop<span className="text-blue-600">nfly</span>
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
            className="rounded-lg bg-gradient-to-r from-orange-500 to-blue-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:brightness-110"
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
            Login/Register
          </Link>
        </nav>
      </div>
    </header>
  );
}
