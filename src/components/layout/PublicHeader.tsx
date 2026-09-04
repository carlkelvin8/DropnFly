"use client";

import Link from "next/link";
import { Luggage, Home, ArrowRight } from "lucide-react";

interface PublicHeaderProps {
  showBackToHome?: boolean;
}

export function PublicHeader({ showBackToHome }: PublicHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-transparent bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 shadow-lg">
            <Luggage className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold">
            <span className="text-blue-600">Drop</span><span className="text-orange-500">nfly</span>
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {showBackToHome && (
            <Link
              href="/"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Home className="mr-1.5 inline h-4 w-4" />
              Home
            </Link>
          )}
          <Link href="/track" className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            Track
          </Link>
          <Link
            href="/book"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-5 text-sm font-medium text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-500/30"
          >
            Book Now
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
