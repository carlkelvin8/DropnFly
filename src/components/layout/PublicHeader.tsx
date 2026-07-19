"use client";

import Link from "next/link";
import { Home } from "lucide-react";

interface PublicHeaderProps {
  showBackToHome?: boolean;
}

export function PublicHeader({ showBackToHome }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-blue-600">
          Dropnfly
        </Link>
        <nav className="flex items-center gap-4">
          {showBackToHome && (
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-blue-600"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
          )}
          <Link
            href="/book"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600"
          >
            Book
          </Link>
          <Link
            href="/track"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600"
          >
            Track
          </Link>
          <Link
            href="/my-account"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600"
          >
            My Account
          </Link>
        </nav>
      </div>
    </header>
  );
}
