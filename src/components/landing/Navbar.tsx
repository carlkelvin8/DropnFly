"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { Luggage, Menu, X, ArrowRight } from "lucide-react";
import { MobileNav } from "./MobileNav";

const navLinks = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#why-choose-us", label: "Why Choose Us" },
  { href: "#testimonials", label: "Testimonials" },
];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleClose = useCallback(() => setMobileOpen(false), []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-transparent bg-background/80 backdrop-blur-xl"
      style={{ animation: "slide-down 0.5s cubic-bezier(0.21, 0.47, 0.32, 0.98)" }}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 shadow-lg">
            <Luggage className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold">
            <span className="text-blue-600">Drop</span><span className="text-orange-500">nfly</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/book"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-5 text-sm font-medium text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-500/30"
          >
            Book Now
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <style>{`
        @keyframes slide-down {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <MobileNav open={mobileOpen} onClose={handleClose} links={navLinks} />
    </header>
  );
}
